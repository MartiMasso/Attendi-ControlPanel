import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseConfig, getServiceRoleKey } from "@/lib/config";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  ownerEmail?: string;
  ownerUserId?: string;
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

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { url } = getSupabaseConfig();
  const serviceKey = getServiceRoleKey();

  if (!serviceKey) return null;

  const res = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=50`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    }
  );

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as { users?: Array<{ id: string; email?: string }> } | null;
  const user = (body?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());

  return user?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Payload;

    const hasEmail = !!payload.ownerEmail?.trim();
    const hasUserId = !!payload.ownerUserId?.trim();

    if (!hasEmail && !hasUserId) {
      return NextResponse.json({ error: "ownerEmail or ownerUserId is required" }, { status: 400 });
    }
    if (!payload.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!payload.category?.trim()) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

    let userId: string;

    if (hasUserId) {
      userId = payload.ownerUserId!.trim();
    } else {
      const found = await findUserIdByEmail(payload.ownerEmail!.trim());
      if (!found) {
        return NextResponse.json({ error: "No account found with that email address" }, { status: 404 });
      }
      userId = found;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const stockTotal = payload.stockTotal ?? 1;
    const stockLabels = Array.from({ length: stockTotal }, (_, i) => `Unidad ${i + 1}`);

    const productData: Record<string, unknown> = {
      user_id: userId,
      title: payload.title.trim(),
      category: payload.category.trim(),
      conditions_accepted: true,
      rental_type: payload.rentalType ?? "daily",
      stock_total: stockTotal,
      stock_unit_labels: stockLabels,
      stock_manual_rented: 0,
      stock_manual_maintenance: 0,
      stock_manual_unavailable: 0,
      is_hidden: payload.isHidden ?? false,
      insured: payload.insured ?? false,
      fianza_required: payload.fianzaRequired ?? false,
      company_deposit: false,
      title_translations: {},
      description_translations: {}
    };

    if (payload.description?.trim()) productData.description = payload.description.trim();
    if (payload.subcategory?.trim()) productData.subcategory = payload.subcategory.trim();
    if (payload.pricePerDay != null) productData.price_per_day = payload.pricePerDay;
    if (payload.pricePerWeek != null) productData.price_per_week = payload.pricePerWeek;
    if (payload.pricePerMonth != null) productData.price_per_month = payload.pricePerMonth;
    if (payload.pricePerHour != null) productData.price_per_hour = payload.pricePerHour;
    if (payload.fianzaRequired && payload.fianza != null) productData.fianza = payload.fianza;
    if (Array.isArray(payload.imageUrls) && payload.imageUrls.length > 0) {
      productData.image_url = payload.imageUrls;
    }
    if (payload.locationDisplay) productData.location_display = payload.locationDisplay;
    if (payload.locationLat != null) productData.location_lat = payload.locationLat;
    if (payload.locationLng != null) productData.location_lng = payload.locationLng;

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert(productData)
      .select("id,title,category,subcategory,price_per_day,rental_type,created_at")
      .single();

    if (productError) {
      return NextResponse.json({ error: productError.message }, { status: 500 });
    }

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_create_product",
        entityType: "product",
        entityId: (product as { id: string }).id,
        metadata: {
          ...(hasEmail ? { ownerEmail: payload.ownerEmail!.trim() } : {}),
          userId,
          title: payload.title.trim(),
          category: payload.category.trim(),
          subcategory: payload.subcategory ?? null
        }
      });
    } catch (auditErr) {
      console.warn("[create-product] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true, product });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[create-product] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
