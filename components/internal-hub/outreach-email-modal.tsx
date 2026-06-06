"use client";

import { Check, Copy, Inbox, Loader2, Mail, Paperclip, PenLine, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildGmailComposeUrl,
  buildGmailConversationUrl,
  OUTREACH_MAILBOX,
  type OutreachContact
} from "@/components/internal-hub/outreach-shared";
import {
  findTemplate,
  KIND_LABEL,
  LANG_LABEL,
  PDF_FILES,
  renderPlain,
  renderSubject,
  type OutreachLang,
  type OutreachTemplateKind
} from "@/components/internal-hub/outreach-templates";

interface OutreachEmailModalProps {
  contact: OutreachContact;
  gmailConnected: boolean;
  onSent: (contactId: string, companyName: string) => void;
  onConnectGmail: () => void;
  onClose: () => void;
}

const LANG_OPTIONS: Array<{ value: OutreachLang; label: string }> = [
  { value: "ca", label: LANG_LABEL.ca },
  { value: "es", label: LANG_LABEL.es }
];

const KIND_OPTIONS: Array<{ value: OutreachTemplateKind; label: string }> = [
  { value: "first", label: KIND_LABEL.first },
  { value: "follow_up", label: KIND_LABEL.follow_up }
];

export function OutreachEmailModal({ contact, gmailConnected, onSent, onConnectGmail, onClose }: OutreachEmailModalProps) {
  const ctx = { companyName: contact.companyName };
  const [lang, setLang] = useState<OutreachLang>("ca");
  const [kind, setKind] = useState<OutreachTemplateKind>("first");
  const initial = findTemplate(contact.listType, "ca", "first");
  const [subject, setSubject] = useState(renderSubject(initial, ctx));
  const [body, setBody] = useState(renderPlain(initial, ctx));
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const template = findTemplate(contact.listType, lang, kind);
  const recipient = contact.email.trim();
  const composeUrl = buildGmailComposeUrl(recipient, { subject, body });
  const conversationUrl = buildGmailConversationUrl(recipient);
  const attachment = template.attachment ? PDF_FILES[template.attachment] : null;

  function applyTemplate(nextLang: OutreachLang, nextKind: OutreachTemplateKind) {
    const next = findTemplate(contact.listType, nextLang, nextKind);
    setSubject(renderSubject(next, ctx));
    setBody(renderPlain(next, ctx));
  }

  function changeLang(next: OutreachLang) {
    setLang(next);
    applyTemplate(next, kind);
  }

  function changeKind(next: OutreachTemplateKind) {
    setKind(next);
    applyTemplate(lang, next);
  }

  function openCompose() {
    window.open(composeUrl, "_blank", "noopener,noreferrer");
  }

  function openConversation() {
    window.open(conversationUrl, "_blank", "noopener,noreferrer");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function sendEmail() {
    if (!recipient || sending) return;
    setSending(true);
    setSendError(null);

    try {
      const response = await fetch("/api/internal/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact.id, subject, body, lang, kind })
      });

      if (response.status === 409) {
        setSendError("Gmail no está conectado. Conéctalo para poder enviar.");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSendError(payload?.error === "send_failed" ? "No se pudo enviar (revisa la conexión de Gmail)." : "No se pudo enviar el correo.");
        return;
      }

      onSent(contact.id, contact.companyName);
      onClose();
    } catch {
      setSendError("No se pudo enviar el correo. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Borrador de correo"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text">Enviar email</h2>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {contact.companyName || "Contacto"} · {recipient || "sin email"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented label="Idioma" value={lang} options={LANG_OPTIONS} onChange={changeLang} />
            <Segmented label="Plantilla" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Desde</label>
            <Input value={OUTREACH_MAILBOX} readOnly aria-label="Remitente" className="bg-surface-muted/50 text-text-muted" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Para</label>
            <Input value={recipient} readOnly aria-label="Destinatario" className="bg-surface-muted/50 text-text-muted" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Asunto</label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Asunto" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Mensaje</label>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Cuerpo del correo" className="min-h-56" />
          </div>

          {attachment ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Lleva PDF adjunto: <strong className="font-semibold">{attachment.label}</strong> (se adjunta al enviar).
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border bg-surface-muted/30 px-5 py-3">
          {sendError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{sendError}</p>
          ) : null}

          {!gmailConnected ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-xs text-blue-800">Conecta Gmail para enviar el correo con el PDF adjunto y los títulos en negrita.</span>
              <Button type="button" size="sm" onClick={onConnectGmail}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Conectar Gmail
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={copyDraft}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar texto"}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={openConversation} disabled={!recipient}>
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Ver conversación
              </Button>
              {gmailConnected ? (
                <Button type="button" onClick={sendEmail} disabled={!recipient || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
              ) : (
                <Button type="button" onClick={openCompose} disabled={!recipient}>
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Redactar en Gmail
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="inline-flex rounded-lg border border-border bg-surface-muted/50 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              value === option.value ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
