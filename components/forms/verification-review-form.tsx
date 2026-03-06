"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function VerificationReviewForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAction = (decision: "approve" | "reject") => {
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
        setError(payload?.error ?? "Unable to process verification request.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-text">Review request</h3>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional internal reason / review note"
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => runAction("approve")} disabled={isPending}>
          Approve
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={() => runAction("reject")} disabled={isPending}>
          Reject
        </Button>
      </div>
    </div>
  );
}
