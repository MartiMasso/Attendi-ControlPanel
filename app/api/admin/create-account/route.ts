import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  email?: string;
  fullName?: string;
  username?: string;
  accountType?: "hotel" | "business";
  profilePhotoUrl?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  postalCode?: string | null;
  preciseLocation?: string | null;
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Payload;

    if (!payload.email?.trim() || !payload.username?.trim() || !payload.accountType) {
      return NextResponse.json({ error: "Missing required fields: email, username, accountType" }, { status: 400 });
    }

    if (payload.accountType !== "hotel" && payload.accountType !== "business") {
      return NextResponse.json({ error: "accountType must be hotel or business" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: payload.email.trim(),
      password: "Attendi12345@",
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName?.trim() ?? null,
        username: payload.username.trim()
      }
    });

    if (authError || !authData?.user) {
      const msg = authError?.message || "Auth user creation failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: payload.fullName?.trim() ?? null,
          username: payload.username.trim(),
          account_type: payload.accountType,
          verification_status: "approved",
          ...(payload.profilePhotoUrl ? { profile_photo_url: payload.profilePhotoUrl } : {})
        },
        { onConflict: "id" }
      );

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 500 });
    }

    const businessName = payload.fullName?.trim() || payload.username.trim();

    const businessData: Record<string, unknown> = {
      user_id: userId,
      organization_type: payload.accountType,
      business_name: businessName
    };
    if (payload.street) businessData.street = payload.street;
    if (payload.streetNumber) businessData.street_number = payload.streetNumber;
    if (payload.city) businessData.city = payload.city;
    if (payload.postalCode) businessData.postal_code = payload.postalCode;
    if (payload.preciseLocation) businessData.precise_location = payload.preciseLocation;

    const { error: businessError } = await supabase
      .from("business_details")
      .upsert(businessData, { onConflict: "user_id" });

    if (businessError) {
      console.warn("[create-account] business_details upsert failed:", businessError.message || businessError.code);
    }

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_create_account",
        entityType: "user",
        entityId: userId,
        metadata: {
          email: payload.email.trim(),
          username: payload.username.trim(),
          accountType: payload.accountType,
          fullName: payload.fullName?.trim() ?? null
        }
      });
    } catch (auditErr) {
      console.warn("[create-account] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true, userId, email: payload.email.trim() });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[create-account] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
