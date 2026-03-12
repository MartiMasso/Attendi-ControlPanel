import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalTaskPriority } from "@/types";

interface Payload {
  title?: string;
  description?: string | null;
  assigneeUserId?: string | null;
  priority?: InternalTaskPriority;
  dueDate?: string | null;
}

const PRIORITIES = new Set<InternalTaskPriority>(["low", "medium", "high", "urgent"]);

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalDate(value: unknown) {
  const text = normalizeOptionalText(value);
  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const title = normalizeOptionalText(payload.title);

  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  if (payload.priority && !PRIORITIES.has(payload.priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  if (payload.dueDate && !normalizeOptionalDate(payload.dueDate)) {
    return NextResponse.json({ error: "Invalid due date format." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("internal_hub_tasks")
    .insert({
      title,
      description: normalizeOptionalText(payload.description),
      assignee_user_id: normalizeOptionalText(payload.assigneeUserId),
      priority: payload.priority ?? "medium",
      due_date: normalizeOptionalDate(payload.dueDate),
      created_by_user_id: session.userId
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const taskId = String(data?.id ?? "");

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_task_created",
    entityType: "internal_task",
    entityId: taskId || null,
    metadata: {
      assigneeUserId: normalizeOptionalText(payload.assigneeUserId),
      priority: payload.priority ?? "medium",
      dueDate: normalizeOptionalDate(payload.dueDate)
    }
  });

  return NextResponse.json({ success: true, id: taskId || null });
}
