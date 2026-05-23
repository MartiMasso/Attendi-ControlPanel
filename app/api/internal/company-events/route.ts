import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalCompanyEventType } from "@/types";

interface Payload {
  id?: string;
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

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTime(value: unknown) {
  const text = normalizeText(value, "09:00");
  return /^\d{2}:\d{2}$/.test(text) ? text : "09:00";
}

function normalizeType(value: unknown) {
  return EVENT_TYPES.has(value as InternalCompanyEventType) ? (value as InternalCompanyEventType) : "Llamada";
}

function normalizeLeadDays(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(365, Math.max(0, Math.trunc(parsed))) : 1;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const id = normalizeText(payload.id) || crypto.randomUUID();
  const date = normalizeDate(payload.date);

  if (!date) {
    return NextResponse.json({ error: "Event date is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const row = {
    id,
    company_id: normalizeText(payload.companyId) || null,
    event_date: date,
    event_time: normalizeTime(payload.time),
    event_type: normalizeType(payload.type),
    title: normalizeText(payload.title),
    notes: normalizeText(payload.notes),
    reminder_enabled: payload.reminderEnabled !== false,
    reminder_lead_days: normalizeLeadDays(payload.reminderLeadDays),
    reminder_email: normalizeText(payload.reminderEmail, "attendi.rent.app@gmail.com") || "attendi.rent.app@gmail.com",
    updated_by_user_id: session.userId,
    deleted_at: null,
    deleted_by_user_id: null
  };

  const { data: existing, error: existingError } = await supabase
    .from("internal_hub_company_events")
    .select("id,deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const mutation = existing
    ? supabase.from("internal_hub_company_events").update(row).eq("id", id)
    : supabase.from("internal_hub_company_events").insert({
        ...row,
        created_by_user_id: session.userId
      });

  const { error } = await mutation;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: existing ? "internal_company_event_updated" : "internal_company_event_created",
    entityType: "internal_company_event",
    entityId: id,
    metadata: {
      restored: Boolean(existing?.deleted_at),
      companyId: row.company_id,
      date: row.event_date
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, id });
}
