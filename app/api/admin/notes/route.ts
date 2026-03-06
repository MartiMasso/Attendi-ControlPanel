import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertAdminNote } from "@/services/admin-meta-service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  entityType?: string;
  entityId?: string;
  note?: string;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;

  if (!payload.entityType || !payload.entityId || !payload.note?.trim()) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  try {
    await insertAdminNote(supabase, {
      entityType: payload.entityType,
      entityId: payload.entityId,
      note: payload.note.trim(),
      createdByAdminId: session.admin.id
    });

    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "admin_note_created",
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: {
        noteLength: payload.note.trim().length
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note" }, { status: 500 });
  }
}
