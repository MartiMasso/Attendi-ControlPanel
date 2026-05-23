import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalCompanyEventType } from "@/types";

interface Payload {
  companyId?: string | null;
  date?: string;
  time?: string;
  type?: InternalCompanyEventType;
  title?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderLeadDays?: number;
  reminderEmail?: string;
}

const EVENT_TYPES = new Set<InternalCompanyEventType>(["Llamada", "Correo pendiente", "Demo", "Follow-up", "Recordatorio", "Otro"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTime(value: unknown) {
  const text = normalizeText(value);
  return /^\d{2}:\d{2}$/.test(text) ? text : null;
}

function normalizeLeadDays(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(365, Math.max(0, Math.trunc(parsed))) : 1;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const update: Record<string, unknown> = {
    updated_by_user_id: session.userId
  };

  if (payload.companyId !== undefined) update.company_id = normalizeText(payload.companyId) || null;

  if (payload.date !== undefined) {
    const date = normalizeDate(payload.date);
    if (!date) {
      return NextResponse.json({ error: "Invalid event date." }, { status: 400 });
    }

    update.event_date = date;
  }

  if (payload.time !== undefined) {
    const time = normalizeTime(payload.time);
    if (!time) {
      return NextResponse.json({ error: "Invalid event time." }, { status: 400 });
    }

    update.event_time = time;
  }

  if (payload.type !== undefined) {
    if (!EVENT_TYPES.has(payload.type)) {
      return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
    }

    update.event_type = payload.type;
  }

  if (payload.title !== undefined) update.title = normalizeText(payload.title);
  if (payload.notes !== undefined) update.notes = normalizeText(payload.notes);
  if (payload.reminderEnabled !== undefined) update.reminder_enabled = Boolean(payload.reminderEnabled);
  if (payload.reminderLeadDays !== undefined) update.reminder_lead_days = normalizeLeadDays(payload.reminderLeadDays);
  if (payload.reminderEmail !== undefined) update.reminder_email = normalizeText(payload.reminderEmail) || "attendi.rent.app@gmail.com";

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("internal_hub_company_events")
    .update(update)
    .eq("id", params.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Company event not found." }, { status: 404 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_company_event_updated",
    entityType: "internal_company_event",
    entityId: params.id,
    metadata: update
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("internal_hub_company_events")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_user_id: session.userId,
      updated_by_user_id: session.userId
    })
    .eq("id", params.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Company event not found." }, { status: 404 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_company_event_deleted",
    entityType: "internal_company_event",
    entityId: params.id
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}
