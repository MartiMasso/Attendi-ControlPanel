import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { getSupabaseConfig, getServiceRoleKey } from "@/lib/config";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  email?: string;
  generateEmail?: boolean;
  verifyEmail?: boolean;
  fullName?: string;
  username?: string;
  accountType?: "hotel" | "business";
  profilePhotoUrl?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  city?: string | null;
  postalCode?: string | null;
  preciseLocation?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
}

async function generateUniqueYopmailEmail(supabase: ReturnType<typeof import("@/lib/supabase/service").createSupabaseServiceClient>): Promise<string> {
  const { url } = getSupabaseConfig();
  const serviceKey = getServiceRoleKey();

  for (let attempt = 0; attempt < 20; attempt++) {
    const number = Math.floor(100000 + Math.random() * 900000); // 6-digit
    const candidate = `attendi${number}@yopmail.com`;

    // Check auth users via GoTrue
    if (serviceKey) {
      const res = await fetch(
        `${url}/auth/v1/admin/users?filter=${encodeURIComponent(candidate)}&per_page=10`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { users?: Array<{ email?: string }> } | null;
        const taken = (body?.users ?? []).some((u) => u.email?.toLowerCase() === candidate);
        if (!taken) return candidate;
        continue;
      }
    }

    // Fallback: check profiles table via email (less reliable but safe)
    if (supabase) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email", candidate);
      if ((count ?? 0) === 0) return candidate;
    } else {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique yopmail email after 20 attempts");
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as Payload;

    if (!payload.generateEmail && !payload.email?.trim()) {
      return NextResponse.json({ error: "Missing required fields: email (or enable generateEmail)" }, { status: 400 });
    }
    if (!payload.username?.trim() || !payload.accountType) {
      return NextResponse.json({ error: "Missing required fields: username, accountType" }, { status: 400 });
    }

    if (payload.accountType !== "hotel" && payload.accountType !== "business") {
      return NextResponse.json({ error: "accountType must be hotel or business" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    let resolvedEmail: string;
    if (payload.generateEmail) {
      try {
        resolvedEmail = await generateUniqueYopmailEmail(supabase);
      } catch (genErr) {
        return NextResponse.json({ error: genErr instanceof Error ? genErr.message : "Email generation failed" }, { status: 500 });
      }
    } else {
      resolvedEmail = payload.email!.trim();
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: resolvedEmail,
      password: "Attendi12345@",
      email_confirm: payload.verifyEmail !== false,
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
          verification_status: payload.verifyEmail !== false ? "approved" : "pending",
          ...(payload.profilePhotoUrl ? { profile_photo_url: payload.profilePhotoUrl } : {}),
          ...(payload.locationLat != null ? { latitude: payload.locationLat } : {}),
          ...(payload.locationLng != null ? { longitude: payload.locationLng } : {}),
          ...(payload.preciseLocation ? { precise_location: payload.preciseLocation } : {})
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
      business_name: businessName,
      business_nif: "PENDING"
    };
    if (payload.street) businessData.street = payload.street;
    if (payload.streetNumber) businessData.street_number = payload.streetNumber;
    if (payload.city) businessData.city = payload.city;
    if (payload.postalCode) businessData.postal_code = payload.postalCode;
    if (payload.preciseLocation) {
      businessData.precise_location = payload.preciseLocation;
      businessData.hotel_public_address = payload.preciseLocation;
    }
    if (payload.publicPhone != null) businessData.hotel_public_phone = payload.publicPhone;
    if (payload.publicEmail != null) businessData.hotel_public_email = payload.publicEmail;

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
          email: resolvedEmail,
          username: payload.username.trim(),
          accountType: payload.accountType,
          fullName: payload.fullName?.trim() ?? null,
          autoGenerated: !!payload.generateEmail
        }
      });
    } catch (auditErr) {
      console.warn("[create-account] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true, userId, email: resolvedEmail });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[create-account] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
