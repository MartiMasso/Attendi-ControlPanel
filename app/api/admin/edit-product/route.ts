import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  productId?: string;
  title?: string;
  description?: string | null;
  category?: string;
  subcategory?: string | null;
  rentalType?: "daily" | "hourly";
  pricePerDay?: number | null;
  pricePerWeek?: number | null;
  pricePerMonth?: number | null;
  pricePerHour?: number | null;
  fianzaRequired?: boolean;
  fianza?: number | null;
  stockTotal?: number;
  isHidden?: boolean;
  insured?: boolean;
  imageUrls?: string[];
  locationDisplay?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Payload;

    if (!payload.productId?.trim()) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();
    const productId = payload.productId.trim();

    const update: Record<string, unknown> = {};

    if (payload.title?.trim()) update.title = payload.title.trim();
    if (payload.category?.trim()) update.category = payload.category.trim();
    if (payload.description !== undefined) update.description = payload.description?.trim() || null;
    if (payload.subcategory !== undefined) update.subcategory = payload.subcategory?.trim() || null;
    if (payload.rentalType) update.rental_type = payload.rentalType;
    if (payload.pricePerDay !== undefined) update.price_per_day = payload.pricePerDay;
    if (payload.pricePerWeek !== undefined) update.price_per_week = payload.pricePerWeek;
    if (payload.pricePerMonth !== undefined) update.price_per_month = payload.pricePerMonth;
    if (payload.pricePerHour !== undefined) update.price_per_hour = payload.pricePerHour;
    if (payload.fianzaRequired !== undefined) update.fianza_required = payload.fianzaRequired;
    if (payload.fianza !== undefined) update.fianza = payload.fianza;
    if (payload.stockTotal !== undefined && payload.stockTotal >= 1) {
      update.stock_total = payload.stockTotal;
      update.stock_unit_labels = Array.from({ length: payload.stockTotal }, (_, i) => `Unidad ${i + 1}`);
    }
    if (payload.isHidden !== undefined) update.is_hidden = payload.isHidden;
    if (payload.insured !== undefined) update.insured = payload.insured;
    if (payload.imageUrls !== undefined) update.image_url = payload.imageUrls;
    if (payload.locationDisplay !== undefined) update.location_display = payload.locationDisplay || null;
    if (payload.locationLat !== undefined) update.location_lat = payload.locationLat;
    if (payload.locationLng !== undefined) update.location_lng = payload.locationLng;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: product, error: updateError } = await supabase
      .from("products")
      .update(update)
      .eq("id", productId)
      .select("id,title,category")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_edit_product",
        entityType: "product",
        entityId: productId,
        metadata: { fields: Object.keys(update), title: payload.title }
      });
    } catch (auditErr) {
      console.warn("[edit-product] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true, product });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[edit-product] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
