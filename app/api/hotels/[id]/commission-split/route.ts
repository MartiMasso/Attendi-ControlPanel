import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  kHotelPct?: number;
}

function normalizePercent(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const kHotelPct = normalizePercent(payload.kHotelPct);

  if (kHotelPct === null || kHotelPct < 0 || kHotelPct > 100) {
    return NextResponse.json({ error: "k_hotel must be a percentage between 0 and 100." }, { status: 400 });
  }

  const kHotel = Number((kHotelPct / 100).toFixed(6));
  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  const { data: hotel, error: hotelError } = await supabase
    .from("profiles")
    .select("id,account_type")
    .eq("id", params.id)
    .maybeSingle();

  if (hotelError) {
    return NextResponse.json({ error: hotelError.message }, { status: 500 });
  }

  if (!hotel || hotel.account_type !== "hotel") {
    return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  }

  const { data: current } = await supabase
    .from("hotel_commission_split_settings")
    .select("hotel_id,k_hotel")
    .eq("hotel_id", params.id)
    .maybeSingle();

  const { error: upsertError } = await supabase
    .from("hotel_commission_split_settings")
    .upsert(
      {
        hotel_id: params.id,
        hotel_location_id: null,
        k_hotel: kHotel,
        updated_at: new Date().toISOString()
      },
      { onConflict: "hotel_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "hotel_commission_split_updated",
    entityType: "hotel",
    entityId: params.id,
    metadata: {
      previousKHotel: current?.k_hotel ?? null,
      nextKHotel: kHotel
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, kHotel, kHotelPct });
}
