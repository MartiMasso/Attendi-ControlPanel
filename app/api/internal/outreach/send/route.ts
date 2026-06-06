import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";
import { OUTREACH_MAILBOX } from "@/components/internal-hub/outreach-shared";
import {
  findTemplate,
  htmlFromPlain,
  PDF_FILES,
  templateHeadings,
  type OutreachLang,
  type OutreachTemplateKind
} from "@/components/internal-hub/outreach-templates";
import { getAccessToken, sendGmailMessage, type GmailAttachment } from "@/lib/gmail";
import type { InternalCompanyListType } from "@/types";

export const runtime = "nodejs";

interface Payload {
  contactId?: string;
  subject?: string;
  body?: string;
  lang?: OutreachLang;
  kind?: OutreachTemplateKind;
}

function normalizeLang(value: unknown): OutreachLang {
  return value === "es" ? "es" : "ca";
}

function normalizeKind(value: unknown): OutreachTemplateKind {
  return value === "follow_up" ? "follow_up" : "first";
}

function normalizeListType(value: unknown): InternalCompanyListType {
  return value === "alojamiento" ? "alojamiento" : "empresa";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const contactId = typeof payload.contactId === "string" ? payload.contactId.trim() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const bodyText = typeof payload.body === "string" ? payload.body : "";
  const lang = normalizeLang(payload.lang);
  const kind = normalizeKind(payload.kind);

  if (!contactId || !subject || !bodyText.trim()) {
    return NextResponse.json({ error: "Faltan datos del correo." }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Servidor sin configurar (service role)." }, { status: 500 });
  }

  const { data: account } = await supabase
    .from("internal_hub_email_account")
    .select("refresh_token")
    .eq("id", "primary")
    .maybeSingle();

  if (!account?.refresh_token) {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  const { data: contact, error: contactError } = await supabase
    .from("internal_hub_company_contacts")
    .select("id,list_type,email,gmail_thread_id,metadata")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }
  if (!contact) {
    return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });
  }

  const to = typeof contact.email === "string" ? contact.email.trim() : "";
  if (!to) {
    return NextResponse.json({ error: "El contacto no tiene email." }, { status: 400 });
  }

  const template = findTemplate(normalizeListType(contact.list_type), lang, kind);
  const html = htmlFromPlain(bodyText, templateHeadings(template));

  const attachments: GmailAttachment[] = [];
  if (template.attachment) {
    const pdf = PDF_FILES[template.attachment];
    try {
      const buffer = await readFile(path.join(process.cwd(), "docs", pdf.fileName));
      attachments.push({
        filename: pdf.asciiName,
        contentType: "application/pdf",
        contentBase64: buffer.toString("base64")
      });
    } catch {
      return NextResponse.json({ error: `No se encontró el PDF adjunto (${pdf.label}).` }, { status: 500 });
    }
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(account.refresh_token);
  } catch {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  let result;
  try {
    result = await sendGmailMessage({
      accessToken,
      from: `Attendi <${OUTREACH_MAILBOX}>`,
      to,
      subject,
      html,
      attachments,
      threadId: typeof contact.gmail_thread_id === "string" && contact.gmail_thread_id ? contact.gmail_thread_id : undefined
    });
  } catch {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const metadata = isRecord(contact.metadata) ? contact.metadata : {};

  await supabase
    .from("internal_hub_company_contacts")
    .update({
      status: "Contactado",
      metadata: { ...metadata, lastEmailAt: sentAt },
      gmail_thread_id: result.threadId,
      updated_by_user_id: session.userId
    })
    .eq("id", contactId);

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: "internal_outreach_email_sent",
    entityType: "internal_company_contact",
    entityId: contactId,
    metadata: { to, subject, lang, kind, attached: Boolean(template.attachment) }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, threadId: result.threadId, sentAt });
}
