import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { createAuditLogEntry } from "@/services/audit-log-service";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();
  const { data: note, error: noteError } = await supabase
    .from("admin_notes")
    .select("id,entity_type,entity_id,note")
    .eq("id", params.id)
    .maybeSingle();

  if (noteError) {
    if (isMissingDatabaseObject(noteError)) {
      return NextResponse.json(
        {
          error:
            "Missing admin_notes table/policies. Run migration supabase/migrations/20260306160000_admin_panel_core.sql."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: noteError.message }, { status: 500 });
  }

  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("admin_notes").delete().eq("id", params.id);

  if (deleteError) {
    if (isMissingDatabaseObject(deleteError)) {
      return NextResponse.json(
        {
          error:
            "Missing admin_notes table/policies. Run migration supabase/migrations/20260306160000_admin_panel_core.sql."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "admin_note_deleted",
    entityType: String(note.entity_type),
    entityId: String(note.entity_id),
    metadata: {
      noteId: note.id,
      noteLength: String(note.note ?? "").length
    }
  });

  return NextResponse.json({ success: true });
}
