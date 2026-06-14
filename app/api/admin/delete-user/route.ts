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

    try {
      await createAuditLogEntry(supabase, {
        adminUserId: session.userId,
        action: "admin_delete_user",
        entityType: "user",
        entityId: userId,
        metadata: { deletedBy: session.userId }
      });
    } catch (auditErr) {
      console.warn("[delete-user] audit log failed:", auditErr instanceof Error ? auditErr.message : auditErr);
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected server error";
    console.error("[delete-user] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
