import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  commissionPct?: number;
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
  const commissionPct = normalizePercent(payload.commissionPct);

  if (commissionPct === null || commissionPct < 0 || commissionPct > 100) {
    return NextResponse.json({ error: "Commission must be a number between 0 and 100." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id,account_type,comision_propietario")
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Entity not found." }, { status: 404 });
  }

  if (!["business", "hotel"].includes(String(current.account_type))) {
    return NextResponse.json({ error: "Commission can only be edited for businesses or hotels." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ comision_propietario: commissionPct })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "entity_standard_owner_commission_updated",
    entityType: "business_performance_entity",
    entityId: params.id,
    metadata: {
      previousCommissionPct: current.comision_propietario,
      nextCommissionPct: commissionPct
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, commissionPct });
}
