import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import { updateIncidentStatus } from "@/services/incidents-service";

interface Payload {
  status?: "open" | "in_review" | "resolved";
  priority?: "low" | "medium" | "high";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;

  if (!payload.status || !payload.priority) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await updateIncidentStatus(params.id, payload.status, payload.priority);

    const supabase = createSupabaseServerClient();
    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "incident_updated",
      entityType: "incident",
      entityId: params.id,
      metadata: {
        status: payload.status,
        priority: payload.priority
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update incident" }, { status: 500 });
  }
}
