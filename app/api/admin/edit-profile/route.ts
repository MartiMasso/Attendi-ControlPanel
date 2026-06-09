import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  userId?: string;
  fullName?: string | null;
  username?: string | null;
  accountType?: string | null;
  profilePhotoUrl?: string | null;
  backgroundImageUrl?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationDisplay?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  postalCode?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  // Email update
  newEmail?: string | null;
  verifyNewEmail?: boolean;
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Payload;

    if (!payload.userId?.trim()) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const userId = payload.userId.trim();

    // ── Update auth email if requested ──────────────────────────────────────
    if (payload.newEmail?.trim()) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
        email: payload.newEmail.trim(),
        email_confirm: payload.verifyNewEmail !== false
      });
      if (emailError) {
        return NextResponse.json({ error: `Email update error: ${emailError.message}` }, { status: 400 });
      }
    }

    // ── Update profiles table ────────────────────────────────────────────────
    const profileUpdate: Record<string, unknown> = {};
    if (payload.fullName !== undefined) profileUpdate.full_name = payload.fullName?.trim() || null;
    if (payload.username?.trim()) profileUpdate.username = payload.username.trim();
    if (payload.accountType?.trim()) profileUpdate.account_type = payload.accountType.trim();
    if (payload.profilePhotoUrl !== undefined) profileUpdate.profile_photo_url = payload.profilePhotoUrl || null;
    if (payload.locationLat !== undefined) profileUpdate.latitude = payload.locationLat;
    if (payload.locationLng !== undefined) profileUpdate.longitude = payload.locationLng;
    if (payload.locationDisplay !== undefined) profileUpdate.precise_location = payload.locationDisplay || null;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json({ error: `Profile update error: ${profileError.message}` }, { status: 500 });
      }
    }

    // ── Update business_details ──────────────────────────────────────────────
    const hasBizUpdate =
      payload.backgroundImageUrl !== undefined ||
      payload.street !== undefined ||
      payload.streetNumber !== undefined ||
      payload.city !== undefined ||
      payload.postalCode !== undefined ||
      payload.locationDisplay !== undefined ||
      payload.publicPhone !== undefined ||
      payload.publicEmail !== undefined;

    if (hasBizUpdate) {
      // Load existing row first to preserve NOT NULL columns
      const { data: existingBiz } = await supabase
        .from("business_details")
        .select("business_name,business_nif")
        .eq("user_id", userId)
        .maybeSingle();

      const eb = (existingBiz ?? {}) as Record<string, unknown>;

      const bizUpdate: Record<string, unknown> = {
        user_id: userId,
        business_name: eb.business_name ?? userId,
        business_nif: eb.business_nif ?? "PENDING"
      };

      if (payload.backgroundImageUrl !== undefined) bizUpdate.hotel_header_image_url = payload.backgroundImageUrl || null;
      if (payload.street !== undefined) bizUpdate.street = payload.street || null;
      if (payload.streetNumber !== undefined) bizUpdate.street_number = payload.streetNumber || null;
      if (payload.city !== undefined) bizUpdate.city = payload.city || null;
      if (payload.postalCode !== undefined) bizUpdate.postal_code = payload.postalCode || null;
      if (payload.locationDisplay !== undefined) {
        bizUpdate.precise_location = payload.locationDisplay || null;
        bizUpdate.hotel_public_address = payload.locationDisplay || null;
      }
      if (payload.publicPhone !== undefined) bizUpdate.hotel_public_phone = payload.publicPhone || null;
      if (payload.publicEmail !== undefined) bizUpdate.hotel_public_email = payload.publicEmail || null;

      const { error: bizError } = await supabase
        .from("business_details")
        .upsert(bizUpdate, { onConflict: "user_id" });

      if (bizError) {
        return NextResponse.json({ error: `Business details error: ${bizError.message}` }, { status: 500 });
      }
    }

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_edit_profile",
        entityType: "user",
        entityId: userId,
        metadata: {
          profileFields: Object.keys(profileUpdate),
          backgroundChanged: payload.backgroundImageUrl !== undefined,
          emailChanged: !!payload.newEmail?.trim()
        }
      });
    } catch (auditErr) {
      console.warn("[edit-profile] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[edit-profile] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
