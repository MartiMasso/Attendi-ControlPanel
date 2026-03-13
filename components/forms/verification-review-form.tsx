"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VerificationRequestDecision } from "@/types";

export function VerificationReviewForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
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

  const runAction = (decision: VerificationRequestDecision) => {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/verifications/${requestId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ decision, note: note.trim() || null })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const message = payload?.error ?? "Unable to process verification request.";
        setError(message);
        setToast({ tone: "error", message });
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        profileAccountType?: string | null;
        profileVerificationStatus?: string | null;
      } | null;
      const status = payload?.status ? String(payload.status).replace(/_/g, " ") : "updated";
      const profileStatus = payload?.profileVerificationStatus ? String(payload.profileVerificationStatus).replace(/_/g, " ") : null;
      const profileType = payload?.profileAccountType ? String(payload.profileAccountType) : null;

      if (profileStatus || profileType) {
        setToast({
          tone: "success",
          message: `Solicitud ${status}. Perfil: ${profileType ?? "-"} / ${profileStatus ?? "-"}.`
        });
      } else {
        setToast({ tone: "success", message: `Verification request ${status}.` });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-text">Revisar solicitud</h3>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Motivo interno opcional"
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="button" variant="primary" size="sm" onClick={() => runAction("approve")} disabled={isPending}>
          Confirmar validación
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={() => runAction("reject")} disabled={isPending}>
          Rechazar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => runAction("needs_changes")} disabled={isPending}>
          Solicitar cambios
        </Button>
      </div>
      {isPending ? <p className="text-xs text-text-muted">Guardando revisión...</p> : null}
      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.tone === "success" ? "bg-[#e6f5ed] text-success" : "bg-[#fdebed] text-danger"
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
