import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalCompanyListType, InternalCompanyNextStep, InternalCompanyPriority, InternalCompanyStatus } from "@/types";

interface Payload {
  id?: string;
  listType?: InternalCompanyListType;
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

const STATUSES = new Set<InternalCompanyStatus>(["Por contactar", "Contactado", "Interesado", "En negociación", "Cerrado", "Descartado"]);
const PRIORITIES = new Set<InternalCompanyPriority>(["Baja", "Media", "Alta"]);
const NEXT_STEPS = new Set<InternalCompanyNextStep>(["Enviar email", "Llamar", "Agendar demo", "Enviar propuesta", "Esperar respuesta", "Cerrar"]);
const LIST_TYPES = new Set<InternalCompanyListType>(["empresa", "alojamiento"]);

function normalizeListType(value: unknown) {
  return LIST_TYPES.has(value as InternalCompanyListType) ? (value as InternalCompanyListType) : "empresa";
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value, "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeStatus(value: unknown) {
  return STATUSES.has(value as InternalCompanyStatus) ? (value as InternalCompanyStatus) : "Por contactar";
}

function normalizePriority(value: unknown) {
  return PRIORITIES.has(value as InternalCompanyPriority) ? (value as InternalCompanyPriority) : "Media";
}

function normalizeNextStep(value: unknown) {
  return NEXT_STEPS.has(value as InternalCompanyNextStep) ? (value as InternalCompanyNextStep) : "Enviar email";
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const id = normalizeText(payload.id, "") || crypto.randomUUID();
  const supabase = createSupabaseServerClient();

  const row = {
    id,
    list_type: normalizeListType(payload.listType),
    company_name: normalizeText(payload.companyName),
    email: normalizeText(payload.email),
    phone: normalizeText(payload.phone),
    category: normalizeText(payload.category, "Hotel/Hub") || "Hotel/Hub",
    status: normalizeStatus(payload.status),
    priority: normalizePriority(payload.priority),
    owner_member_id: normalizeText(payload.ownerId),
    next_step: normalizeNextStep(payload.nextStep),
    follow_up_date: normalizeDate(payload.followUpDate),
    metadata: {
      contactName: normalizeText(payload.contactName),
      location: normalizeText(payload.location)
    },
    updated_by_user_id: session.userId,
    deleted_at: null,
    deleted_by_user_id: null
  };

  const { data: existing, error: existingError } = await supabase
    .from("internal_hub_company_contacts")
    .select("id,deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const mutation = existing
    ? supabase.from("internal_hub_company_contacts").update(row).eq("id", id)
    : supabase.from("internal_hub_company_contacts").insert({
        ...row,
        created_by_user_id: session.userId
      });

  const { error } = await mutation;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: existing ? "internal_company_contact_updated" : "internal_company_contact_created",
    entityType: "internal_company_contact",
    entityId: id,
    metadata: {
      restored: Boolean(existing?.deleted_at),
      companyName: row.company_name
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, id });
}
