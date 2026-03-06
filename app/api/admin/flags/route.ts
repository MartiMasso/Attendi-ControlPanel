import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertAdminFlag } from "@/services/admin-meta-service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  entityType?: string;
  entityId?: string;
  flagType?: string;
  severity?: "low" | "medium" | "high";
  reason?: string;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;

  if (!payload.entityType || !payload.entityId || !payload.flagType || !payload.severity || !payload.reason?.trim()) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    await insertAdminFlag(supabase, {
      entityType: payload.entityType,
      entityId: payload.entityId,
      flagType: payload.flagType,
      severity: payload.severity,
      reason: payload.reason.trim(),
      createdByAdminId: session.admin.id
    });

    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "admin_flag_created",
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: {
        flagType: payload.flagType,
        severity: payload.severity
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create flag" }, { status: 500 });
  }
}
