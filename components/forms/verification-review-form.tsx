"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Mail, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createVerificationEmailPreview } from "@/lib/verification-email";
import { cn } from "@/lib/utils";
import type { VerificationRequestDecision } from "@/types";

type ReviewEmailResult = {
  requested?: boolean;
  sent?: boolean;
  status?: string;
  recipient?: string | null;
  subject?: string | null;
  error?: string | null;
};

type ReviewResponsePayload = {
  error?: string;
  status?: string;
  profileAccountType?: string | null;
  profileVerificationStatus?: string | null;
  email?: ReviewEmailResult;
  warnings?: string[];
};

interface VerificationReviewFormProps {
  requestId: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  companyName?: string | null;
  requestedAccountType?: string | null;
}

const decisionOptions: Array<{
  value: VerificationRequestDecision;
  label: string;
  icon: typeof CheckCircle2;
  activeClassName: string;
}> = [
  {
    value: "approve",
    label: "Validar",
    icon: CheckCircle2,
    activeClassName: "border-primary bg-primary text-white"
  },
  {
    value: "reject",
    label: "Rechazar",
    icon: XCircle,
    activeClassName: "border-danger bg-danger text-white"
  },
  {
    value: "needs_changes",
    label: "Pedir cambios",
    icon: AlertCircle,
    activeClassName: "border-warning bg-[#fff4df] text-warning"
  }
];

const decisionSubmitLabel: Record<VerificationRequestDecision, string> = {
  approve: "Confirmar validación",
  reject: "Rechazar solicitud",
  needs_changes: "Solicitar cambios"
};

function getEmailStatusLabel(email?: ReviewEmailResult) {
  if (!email?.requested && email?.status === "skipped") {
    return "No solicitado";
  }

  if (email?.sent || email?.status === "sent") {
    return "Enviado";
  }

  if (email?.status === "not_configured") {
    return "No enviado: email no configurado";
  }

  if (email?.status === "failed") {
    return "No enviado: fallo del proveedor";
  }

  if (email?.status === "skipped") {
    return "No enviado";
  }

  return "Sin confirmación";
}

function getEmailStatusTone(email?: ReviewEmailResult): "success" | "warning" | "error" {
  if (email?.sent || email?.status === "sent") {
    return "success";
  }

  if (email?.status === "not_configured" || email?.status === "skipped") {
    return "warning";
  }

  return "error";
}

async function readReviewResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!text) {
    return null;
  }

  const trimmed = text.trim();

  if (!contentType.includes("application/json")) {
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return {
        error:
          response.status === 401 || response.status === 403
            ? "Tu sesión no tiene permisos para procesar esta revisión. Vuelve a iniciar sesión."
            : "El servidor devolvió una página de error. Revisa el log del servidor para ver el detalle."
      };
    }

    return { error: trimmed.slice(0, 240) };
  }

  try {
    return JSON.parse(trimmed) as ReviewResponsePayload;
  } catch {
    return { error: "La respuesta del servidor no se pudo leer como JSON." };
  }
}

export function VerificationReviewForm({
  requestId,
  recipientEmail,
  recipientName,
  companyName,
  requestedAccountType
}: VerificationReviewFormProps) {
  const router = useRouter();
  const [selectedDecision, setSelectedDecision] = useState<VerificationRequestDecision>("approve");
  const defaultEmailPreview = useMemo(
    () =>
      createVerificationEmailPreview({
        decision: selectedDecision,
        recipientName,
        companyName,
        requestedAccountType
      }),
    [companyName, recipientName, requestedAccountType, selectedDecision]
  );
  const [sendEmail, setSendEmail] = useState(Boolean(recipientEmail));
  const [emailSubject, setEmailSubject] = useState(defaultEmailPreview.subject);
  const [emailHeading, setEmailHeading] = useState(defaultEmailPreview.heading);
  const [emailBodyText, setEmailBodyText] = useState(defaultEmailPreview.bodyText);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ReviewResponsePayload | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [toast]);

  useEffect(() => {
    if (!recipientEmail) {
      setSendEmail(false);
    }
  }, [recipientEmail]);

  useEffect(() => {
    setEmailSubject(defaultEmailPreview.subject);
    setEmailHeading(defaultEmailPreview.heading);
    setEmailBodyText(defaultEmailPreview.bodyText);
  }, [defaultEmailPreview.bodyText, defaultEmailPreview.heading, defaultEmailPreview.subject]);

  const resetEmailPreview = () => {
    setEmailSubject(defaultEmailPreview.subject);
    setEmailHeading(defaultEmailPreview.heading);
    setEmailBodyText(defaultEmailPreview.bodyText);
  };

  const runAction = () => {
    setError(null);
    setLastResult(null);

    startTransition(async () => {
      const response = await fetch(`/api/verifications/${requestId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decision: selectedDecision,
          note: null,
          sendEmail,
          emailSubject: emailSubject.trim() || defaultEmailPreview.subject,
          emailHeading: emailHeading.trim() || defaultEmailPreview.heading,
          emailBodyText: emailBodyText.trim() || defaultEmailPreview.bodyText
        })
      });

      const payload = await readReviewResponse(response);

      if (!response.ok) {
        const message = payload?.error ?? "No se ha podido procesar la revisión.";
        setError(message);
        setToast({ tone: "error", message });
        return;
      }

      const status = payload?.status ? String(payload.status).replace(/_/g, " ") : "updated";
      const profileStatus = payload?.profileVerificationStatus ? String(payload.profileVerificationStatus).replace(/_/g, " ") : null;
      const profileType = payload?.profileAccountType ? String(payload.profileAccountType) : null;
      const warning = payload?.warnings?.[0] ?? (payload?.email?.error ? `Email: ${payload.email.error}` : null);
      setLastResult(payload);

      if (warning) {
        setToast({
          tone: "warning",
          message: `Solicitud ${status}. ${warning}`
        });
      } else if (profileStatus || profileType) {
        setToast({
          tone: "success",
          message: `Solicitud ${status}. Perfil: ${profileType ?? "-"} / ${profileStatus ?? "-"}. Email ${payload?.email?.sent ? "enviado" : "sin enviar"}.`
        });
      } else {
        setToast({ tone: "success", message: `Solicitud ${status}.` });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-text">Revisar solicitud</h3>
        <div className="flex flex-wrap gap-2">
          {decisionOptions.map((option) => {
            const Icon = option.icon;
            const isActive = selectedDecision === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedDecision(option.value)}
                disabled={isPending}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                  isActive ? option.activeClassName : "bg-surface-muted text-text-muted hover:bg-[#dbe6f3]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
            Preview del email
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text">
              <input
                type="checkbox"
                checked={sendEmail}
                disabled={!recipientEmail || isPending}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Enviar email al usuario
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={resetEmailPreview} disabled={isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restablecer
            </Button>
          </div>
        </div>
        <div className="space-y-3 p-3 text-sm">
          <div className="grid gap-2 text-xs text-text-muted">
            <p>
              <span className="font-semibold text-text">Para:</span> {recipientEmail ?? "-"}
            </p>
            <label className="grid gap-1">
              <span className="font-semibold text-text">Asunto</span>
              <Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} disabled={isPending} />
            </label>
          </div>
          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <Input
              value={emailHeading}
              onChange={(event) => setEmailHeading(event.target.value)}
              disabled={isPending}
              className="mb-3 h-9 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus:border-primary"
            />
            <Textarea
              value={emailBodyText}
              onChange={(event) => setEmailBodyText(event.target.value)}
              disabled={isPending}
              className="min-h-72 resize-y border-transparent bg-transparent px-0 text-sm leading-6 shadow-none focus:border-primary"
            />
          </div>
          {!recipientEmail ? <p className="text-xs text-warning">No hay email de destino expuesto para este usuario.</p> : null}
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {lastResult ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-3 text-sm",
            getEmailStatusTone(lastResult.email) === "success"
              ? "border-success/30 bg-[#e6f5ed] text-success"
              : getEmailStatusTone(lastResult.email) === "warning"
                ? "border-warning/30 bg-[#fff4df] text-warning"
                : "border-danger/30 bg-[#fdebed] text-danger"
          )}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">
            Solicitud guardada: {String(lastResult.status ?? "updated").replace(/_/g, " ")}. Email: {getEmailStatusLabel(lastResult.email)}.
          </p>
          {lastResult.email?.recipient ? <p className="mt-1">Destinatario: {lastResult.email.recipient}</p> : null}
          {lastResult.email?.subject ? <p className="mt-1">Asunto: {lastResult.email.subject}</p> : null}
          {lastResult.email?.error ? <p className="mt-1">{lastResult.email.error}</p> : null}
          {lastResult.warnings?.length ? <p className="mt-1">{lastResult.warnings[0]}</p> : null}
        </div>
      ) : null}
      <Button
        type="button"
        variant={selectedDecision === "reject" ? "danger" : "primary"}
        size="sm"
        onClick={runAction}
        disabled={isPending}
      >
        {decisionSubmitLabel[selectedDecision]}
      </Button>
      {isPending ? <p className="text-xs text-text-muted">Guardando revisión...</p> : null}
      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.tone === "success"
              ? "bg-[#e6f5ed] text-success"
              : toast.tone === "warning"
                ? "bg-[#fff4df] text-warning"
                : "bg-[#fdebed] text-danger"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
