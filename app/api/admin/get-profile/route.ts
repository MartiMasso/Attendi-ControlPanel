import { NextRequest, NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSupabaseConfig, getServiceRoleKey } from "@/lib/config";

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { url } = getSupabaseConfig();
  const serviceKey = getServiceRoleKey();
  if (!serviceKey) return null;

  const res = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=50`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as { users?: Array<{ id: string; email?: string }> } | null;
  const user = (body?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

function isUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ error: "q parameter required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    let userId: string;
    let email: string | null = null;

    if (isUUID(q)) {
      userId = q;
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      email = authUser?.user?.email ?? null;
    } else {
      const found = await findUserIdByEmail(q);
      if (!found) {
        return NextResponse.json({ error: "No account found with that email" }, { status: 404 });
      }
      userId = found;
      email = q;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,username,account_type,profile_photo_url,verification_status,latitude,longitude,precise_location")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const p = profile as Record<string, unknown>;

    const { data: business } = await supabase
      .from("business_details")
      .select("hotel_header_image_url,business_name,street,street_number,city,postal_code,precise_location,hotel_public_address,hotel_public_phone,hotel_public_email")
      .eq("user_id", userId)
      .maybeSingle();

    const b = (business ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      userId,
      email,
      fullName: p.full_name ?? null,
      username: p.username ?? null,
      accountType: p.account_type ?? null,
      profilePhotoUrl: p.profile_photo_url ?? null,
      verificationStatus: p.verification_status ?? null,
      latitude: typeof p.latitude === "number" ? p.latitude : (p.latitude ? parseFloat(String(p.latitude)) : null),
      longitude: typeof p.longitude === "number" ? p.longitude : (p.longitude ? parseFloat(String(p.longitude)) : null),
      preciseLocation: (p.precise_location as string | null) ?? (b.precise_location as string | null) ?? null,
      hotelPublicAddress: (b.hotel_public_address as string | null) ?? null,
      backgroundImageUrl: (b.hotel_header_image_url as string | null) ?? null,
      businessName: (b.business_name as string | null) ?? null,
      street: (b.street as string | null) ?? null,
      streetNumber: (b.street_number as string | null) ?? null,
      city: (b.city as string | null) ?? null,
      postalCode: (b.postal_code as string | null) ?? null,
      publicPhone: (b.hotel_public_phone as string | null) ?? null,
      publicEmail: (b.hotel_public_email as string | null) ?? null
    });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected error";
    console.error("[get-profile]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
