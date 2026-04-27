import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isUUID } from "@/lib/utils";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  mode?: "custom" | "standard";
  cePPct?: number;
  kHotelPct?: number;
  locationId?: string | null;
}

interface OverrideRow {
  id: number;
  ce_p_pct: number | string | null;
  k_hotel: number | string | null;
  hotel_location_id: string | null;
}

function normalizePercent(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocationId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "profile") {
    return null;
  }

  return trimmed;
}

function sameLocation(row: OverrideRow, locationId: string | null) {
  return locationId ? row.hotel_location_id === locationId : !row.hotel_location_id;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; companyId: string } }
) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const mode = payload.mode === "standard" ? "standard" : "custom";
  const locationId = normalizeLocationId(payload.locationId);

  if (locationId && !isUUID(locationId)) {
    return NextResponse.json({ error: "Invalid hotel location ID." }, { status: 400 });
  }

  const cePPct = normalizePercent(payload.cePPct);
  if (mode === "custom" && (cePPct === null || cePPct < 0 || cePPct > 100)) {
    return NextResponse.json({ error: "Partner commission must be a percentage between 0 and 100." }, { status: 400 });
  }

  const kHotelPct = normalizePercent(payload.kHotelPct);
  if (mode === "custom" && (kHotelPct === null || kHotelPct < 0 || kHotelPct > 100)) {
    return NextResponse.json({ error: "Partner hotel share must be a percentage between 0 and 100." }, { status: 400 });
  }

  const kHotel = kHotelPct === null ? null : Number((kHotelPct / 100).toFixed(6));
  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  const [hotelResult, companyResult] = await Promise.all([
    supabase.from("profiles").select("id,account_type").eq("id", params.id).maybeSingle(),
    supabase.from("profiles").select("id,account_type,comision_propietario").eq("id", params.companyId).maybeSingle()
  ]);

  if (hotelResult.error) {
    return NextResponse.json({ error: hotelResult.error.message }, { status: 500 });
  }

  if (companyResult.error) {
    return NextResponse.json({ error: companyResult.error.message }, { status: 500 });
  }

  if (!hotelResult.data || hotelResult.data.account_type !== "hotel") {
    return NextResponse.json({ error: "Hotel not found." }, { status: 404 });
  }

  if (!companyResult.data || companyResult.data.account_type !== "business") {
    return NextResponse.json({ error: "Partner company not found." }, { status: 404 });
  }

  let supportsPartnerKHotel = true;
  let existingRowsResult: { data: unknown[] | null; error: { message: string; code?: string } | null } = await supabase
    .from("hotel_company_commission_overrides")
    .select("id,ce_p_pct,k_hotel,hotel_location_id")
    .eq("hotel_id", params.id)
    .eq("company_id", params.companyId)
    .eq("active", true);

  if (existingRowsResult.error?.code === "42703") {
    supportsPartnerKHotel = false;
    existingRowsResult = await supabase
      .from("hotel_company_commission_overrides")
      .select("id,ce_p_pct,hotel_location_id")
      .eq("hotel_id", params.id)
      .eq("company_id", params.companyId)
      .eq("active", true);
  }

  if (existingRowsResult.error) {
    return NextResponse.json({ error: existingRowsResult.error.message }, { status: 500 });
  }

  const overrides = ((existingRowsResult.data ?? []) as OverrideRow[]).sort((left, right) => left.id - right.id);
  const exactOverride = overrides.find((row) => sameLocation(row, locationId)) ?? null;

  if (mode === "standard") {
    let statement = supabase
      .from("hotel_company_commission_overrides")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("hotel_id", params.id)
      .eq("company_id", params.companyId)
      .eq("active", true);

    statement = locationId ? statement.eq("hotel_location_id", locationId) : statement.is("hotel_location_id", null);

    const { error: resetError } = await statement;

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 });
    }

    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "hotel_partner_commission_override_reset",
      entityType: "hotel_partner_commission",
      entityId: `${params.id}:${params.companyId}`,
      metadata: {
        hotelId: params.id,
        companyId: params.companyId,
        hotelLocationId: locationId,
        previousOverridePct: exactOverride?.ce_p_pct ?? null,
        previousKHotel: exactOverride?.k_hotel ?? null,
        standardCommissionPct: companyResult.data.comision_propietario
      }
    }).catch(() => undefined);

    return NextResponse.json({ success: true, mode: "standard" });
  }

  const now = new Date().toISOString();
  let previousOverridePct: number | string | null = exactOverride?.ce_p_pct ?? null;
  let mutationError: { message: string; code?: string } | null = null;

  if (exactOverride) {
    const { error } = await supabase
      .from("hotel_company_commission_overrides")
      .update({
        ce_p_pct: cePPct,
        ...(supportsPartnerKHotel ? { k_hotel: kHotel } : {}),
        updated_at: now
      })
      .eq("id", exactOverride.id);

    mutationError = error;
  } else {
    const { error } = await supabase.from("hotel_company_commission_overrides").insert({
      hotel_id: params.id,
      company_id: params.companyId,
      ce_p_pct: cePPct,
      ...(supportsPartnerKHotel ? { k_hotel: kHotel } : {}),
      hotel_location_id: locationId,
      active: true,
      updated_at: now
    });

    mutationError = error;

    if (error?.code === "23505" && overrides[0]) {
      previousOverridePct = overrides[0].ce_p_pct;
      const { error: fallbackUpdateError } = await supabase
        .from("hotel_company_commission_overrides")
        .update({
          ce_p_pct: cePPct,
          ...(supportsPartnerKHotel ? { k_hotel: kHotel } : {}),
          hotel_location_id: locationId,
          active: true,
          updated_at: now
        })
        .eq("id", overrides[0].id);

      mutationError = fallbackUpdateError;
    }
  }

  if (mutationError) {
    return NextResponse.json({ error: mutationError.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "hotel_partner_commission_override_updated",
    entityType: "hotel_partner_commission",
    entityId: `${params.id}:${params.companyId}`,
    metadata: {
      hotelId: params.id,
      companyId: params.companyId,
      hotelLocationId: locationId,
      previousOverridePct,
      previousKHotel: exactOverride?.k_hotel ?? null,
      nextOverridePct: cePPct,
      nextKHotel: kHotel
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, mode: "custom", cePPct, kHotel, kHotelPct, supportsPartnerKHotel });
}
