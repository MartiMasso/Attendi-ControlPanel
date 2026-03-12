import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalNoteCategory } from "@/types";

interface Payload {
  title?: string;
  body?: string;
  category?: InternalNoteCategory;
  pinned?: boolean;
}

const CATEGORIES = new Set<InternalNoteCategory>(["announcement", "decision", "reminder", "resource"]);

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const title = normalizeRequiredText(payload.title);
  const body = normalizeRequiredText(payload.body);

  if (!title || !body) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }

  if (payload.category && !CATEGORIES.has(payload.category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("internal_hub_notes")
    .insert({
      title,
      body,
      category: payload.category ?? "announcement",
      pinned: Boolean(payload.pinned),
      created_by_user_id: session.userId
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const noteId = String(data?.id ?? "");

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_note_created",
    entityType: "internal_note",
    entityId: noteId || null,
    metadata: {
      category: payload.category ?? "announcement",
      pinned: Boolean(payload.pinned)
    }
  });

  return NextResponse.json({ success: true, id: noteId || null });
}
