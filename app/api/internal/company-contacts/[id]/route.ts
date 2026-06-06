import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { InternalCompanyListType, InternalCompanyNextStep, InternalCompanyPriority, InternalCompanyStatus } from "@/types";

interface Payload {
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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown) {
  if (value === null) {
    return null;
  }

  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  if (payload.listType !== undefined) {
    if (!LIST_TYPES.has(payload.listType)) {
      return NextResponse.json({ error: "Invalid list type." }, { status: 400 });
    }

    update.list_type = payload.listType;
  }

  if (payload.companyName !== undefined) update.company_name = normalizeText(payload.companyName);
  if (payload.email !== undefined) update.email = normalizeText(payload.email);
  if (payload.phone !== undefined) update.phone = normalizeText(payload.phone);
  if (payload.category !== undefined) update.category = normalizeText(payload.category) || "Hotel/Hub";

  if (payload.status !== undefined) {
    if (!STATUSES.has(payload.status)) {
      return NextResponse.json({ error: "Invalid company status." }, { status: 400 });
    }

    update.status = payload.status;
  }

  if (payload.priority !== undefined) {
    if (!PRIORITIES.has(payload.priority)) {
      return NextResponse.json({ error: "Invalid company priority." }, { status: 400 });
    }

    update.priority = payload.priority;
  }

  if (payload.ownerId !== undefined) update.owner_member_id = normalizeText(payload.ownerId);

  if (payload.nextStep !== undefined) {
    if (!NEXT_STEPS.has(payload.nextStep)) {
      return NextResponse.json({ error: "Invalid next step." }, { status: 400 });
    }

    update.next_step = payload.nextStep;
  }

  if (payload.followUpDate !== undefined) {
    if (payload.followUpDate && !normalizeDate(payload.followUpDate)) {
      return NextResponse.json({ error: "Invalid follow-up date." }, { status: 400 });
    }

    update.follow_up_date = normalizeDate(payload.followUpDate);
  }

  const supabase = createSupabaseServerClient();
  if (payload.contactName !== undefined || payload.location !== undefined) {
    const { data: current, error: metadataError } = await supabase
      .from("internal_hub_company_contacts")
      .select("metadata")
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (metadataError) {
      return NextResponse.json({ error: metadataError.message }, { status: 500 });
    }

    if (!current) {
      return NextResponse.json({ error: "Company contact not found." }, { status: 404 });
    }

    const metadata = isRecord(current.metadata) ? current.metadata : {};
    update.metadata = {
      ...metadata,
      ...(payload.contactName !== undefined ? { contactName: normalizeText(payload.contactName) } : {}),
      ...(payload.location !== undefined ? { location: normalizeText(payload.location) } : {})
    };
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("internal_hub_company_contacts")
    .update(update)
    .eq("id", params.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Company contact not found." }, { status: 404 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_company_contact_updated",
    entityType: "internal_company_contact",
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
    .from("internal_hub_company_contacts")
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
    return NextResponse.json({ error: "Company contact not found." }, { status: 404 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_company_contact_deleted",
    entityType: "internal_company_contact",
    entityId: params.id
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}
