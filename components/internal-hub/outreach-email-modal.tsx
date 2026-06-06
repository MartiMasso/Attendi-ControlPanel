"use client";

import { Check, Copy, Inbox, PenLine, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDefaultDraft,
  buildGmailComposeUrl,
  buildGmailConversationUrl,
  OUTREACH_MAILBOX,
  type OutreachContact
} from "@/components/internal-hub/outreach-shared";

interface OutreachEmailModalProps {
  contact: OutreachContact;
  onClose: () => void;
}

export function OutreachEmailModal({ contact, onClose }: OutreachEmailModalProps) {
  const defaultDraft = buildDefaultDraft(contact);
  const [subject, setSubject] = useState(defaultDraft.subject);
  const [body, setBody] = useState(defaultDraft.body);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const recipient = contact.email.trim();
  const composeUrl = buildGmailComposeUrl(recipient, { subject, body });
  const conversationUrl = buildGmailConversationUrl(recipient);

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
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-xl">
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
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Cuerpo del correo" className="min-h-48" />
          </div>
        </div>

        <div className="space-y-3 border-t border-border bg-surface-muted/30 px-5 py-3">
          <p className="text-xs text-text-muted">
            <strong className="font-medium text-text">Redactar</strong> abre el borrador en una ventana de Gmail (1er contacto).{" "}
            <strong className="font-medium text-text">Ver conversación</strong> abre tu bandeja con los correos de este contacto para seguir el hilo.
          </p>
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
              <Button type="button" onClick={openCompose} disabled={!recipient}>
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Redactar en Gmail
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
