import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalTaskPriority, InternalTaskStatus } from "@/types";

interface Payload {
  status?: InternalTaskStatus;
  priority?: InternalTaskPriority;
  assigneeUserId?: string | null;
  dueDate?: string | null;
}

const STATUSES = new Set<InternalTaskStatus>(["todo", "in_progress", "blocked", "done"]);
const PRIORITIES = new Set<InternalTaskPriority>(["low", "medium", "high", "urgent"]);

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalDate(value: unknown) {
  if (value === null) {
    return null;
  }

  const text = normalizeOptionalText(value);
  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (payload.status !== undefined) {
    if (!STATUSES.has(payload.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    update.status = payload.status;
  }

  if (payload.priority !== undefined) {
    if (!PRIORITIES.has(payload.priority)) {
      return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    }

    update.priority = payload.priority;
  }

  if (payload.assigneeUserId !== undefined) {
    update.assignee_user_id = normalizeOptionalText(payload.assigneeUserId);
  }

  if (payload.dueDate !== undefined) {
    if (payload.dueDate && !normalizeOptionalDate(payload.dueDate)) {
      return NextResponse.json({ error: "Invalid due date format." }, { status: 400 });
    }

    update.due_date = normalizeOptionalDate(payload.dueDate);
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("internal_hub_tasks").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_task_updated",
    entityType: "internal_task",
    entityId: params.id,
    metadata: {
      status: update.status ?? null,
      priority: update.priority ?? null,
      assigneeUserId: update.assignee_user_id ?? null,
      dueDate: update.due_date ?? null
    }
  });

  return NextResponse.json({ success: true });
}
