import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ stripe_account_id: null, company_setup_complete: false })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_reset_stripe",
        entityType: "user",
        entityId: userId,
        metadata: { cleared: ["stripe_account_id", "company_setup_complete"] }
      });
    } catch (auditErr) {
      console.warn("[reset-stripe] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[reset-stripe] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
