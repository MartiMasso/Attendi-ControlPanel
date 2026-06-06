import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type {
  InternalCompanyEventType,
  InternalCompanyNextStep,
  InternalCompanyPriority,
  InternalCompanyStatus
} from "@/types";

interface CompanyPayload {
  id?: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  location?: string;
  category?: string;
  status?: InternalCompanyStatus;
  priority?: InternalCompanyPriority;
  ownerId?: string;
  nextStep?: InternalCompanyNextStep;
  followUpDate?: string | null;
}

interface EventPayload {
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

interface Payload {
  companies?: CompanyPayload[];
  companyEvents?: EventPayload[];
}

const STATUSES = new Set<InternalCompanyStatus>(["Por contactar", "Contactado", "Interesado", "En negociación", "Cerrado", "Descartado"]);
const PRIORITIES = new Set<InternalCompanyPriority>(["Baja", "Media", "Alta"]);
const NEXT_STEPS = new Set<InternalCompanyNextStep>(["Enviar email", "Llamar", "Agendar demo", "Enviar propuesta", "Esperar respuesta", "Cerrar"]);
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

function normalizeLeadDays(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(365, Math.max(0, Math.trunc(parsed))) : 1;
}

function normalizeCompany(company: CompanyPayload, userId: string) {
  const id = normalizeText(company.id);
  if (!id) return null;

  return {
    id,
    company_name: normalizeText(company.companyName),
    email: normalizeText(company.email),
    phone: normalizeText(company.phone),
    category: normalizeText(company.category, "Hotel/Hub") || "Hotel/Hub",
    status: STATUSES.has(company.status as InternalCompanyStatus) ? company.status : "Por contactar",
    priority: PRIORITIES.has(company.priority as InternalCompanyPriority) ? company.priority : "Media",
    owner_member_id: normalizeText(company.ownerId),
    next_step: NEXT_STEPS.has(company.nextStep as InternalCompanyNextStep) ? company.nextStep : "Enviar email",
    follow_up_date: normalizeDate(company.followUpDate),
    metadata: {
      contactName: normalizeText(company.contactName),
      location: normalizeText(company.location)
    },
    updated_by_user_id: userId,
    deleted_at: null,
    deleted_by_user_id: null
  };
}

function normalizeEvent(event: EventPayload, userId: string) {
  const id = normalizeText(event.id);
  const date = normalizeDate(event.date);
  if (!id || !date) return null;

  return {
    id,
    company_id: normalizeText(event.companyId) || null,
    event_date: date,
    event_time: normalizeTime(event.time),
    event_type: EVENT_TYPES.has(event.type as InternalCompanyEventType) ? event.type : "Llamada",
    title: normalizeText(event.title),
    notes: normalizeText(event.notes),
    reminder_enabled: event.reminderEnabled !== false,
    reminder_lead_days: normalizeLeadDays(event.reminderLeadDays),
    reminder_email: normalizeText(event.reminderEmail, "attendi.rent.app@gmail.com") || "attendi.rent.app@gmail.com",
    updated_by_user_id: userId,
    deleted_at: null,
    deleted_by_user_id: null
  };
}

type NormalizedCompany = NonNullable<ReturnType<typeof normalizeCompany>>;
type NormalizedEvent = NonNullable<ReturnType<typeof normalizeEvent>>;

function isNormalizedCompany(value: ReturnType<typeof normalizeCompany>): value is NormalizedCompany {
  return value !== null;
}

function isNormalizedEvent(value: ReturnType<typeof normalizeEvent>): value is NormalizedEvent {
  return value !== null;
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const companies = (payload.companies ?? []).slice(0, 1000).map((company) => normalizeCompany(company, session.userId)).filter(isNormalizedCompany);
  const companyEvents = (payload.companyEvents ?? []).slice(0, 2000).map((event) => normalizeEvent(event, session.userId)).filter(isNormalizedEvent);
  const supabase = createSupabaseServerClient();
  const result = {
    companiesInserted: 0,
    companiesRestored: 0,
    companiesSkipped: 0,
    eventsInserted: 0,
    eventsRestored: 0,
    eventsSkipped: 0
  };

  for (const company of companies) {
    const { data: existing, error: existingError } = await supabase
      .from("internal_hub_company_contacts")
      .select("id,deleted_at")
      .eq("id", company.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existing) {
      const { error } = await supabase.from("internal_hub_company_contacts").insert({
        ...company,
        created_by_user_id: session.userId
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result.companiesInserted += 1;
    } else if (existing.deleted_at) {
      const { error } = await supabase.from("internal_hub_company_contacts").update(company).eq("id", company.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result.companiesRestored += 1;
    } else {
      result.companiesSkipped += 1;
    }
  }

  for (const event of companyEvents) {
    const { data: existing, error: existingError } = await supabase
      .from("internal_hub_company_events")
      .select("id,deleted_at")
      .eq("id", event.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (!existing) {
      const { error } = await supabase.from("internal_hub_company_events").insert({
        ...event,
        created_by_user_id: session.userId
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result.eventsInserted += 1;
    } else if (existing.deleted_at) {
      const { error } = await supabase.from("internal_hub_company_events").update(event).eq("id", event.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result.eventsRestored += 1;
    } else {
      result.eventsSkipped += 1;
    }
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_company_contacts_imported",
    entityType: "internal_company_contact",
    metadata: result
  }).catch(() => undefined);

  return NextResponse.json({ success: true, ...result });
}
