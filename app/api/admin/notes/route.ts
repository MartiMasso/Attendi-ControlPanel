import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { insertAdminNote } from "@/services/admin-meta-service";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  entityType?: string;
  entityId?: string;
  note?: string;
}

export async function GET(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType")?.trim();
  const entityId = url.searchParams.get("entityId")?.trim();

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "Missing entityType/entityId" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id,entity_type,entity_id,note,created_by_admin_id,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
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

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  try {
    const note = await insertAdminNote(supabase, {
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

    return NextResponse.json({ success: true, note });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save note" }, { status: 500 });
  }
}
