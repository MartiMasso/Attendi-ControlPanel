"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AddFlagForm({ entityType, entityId }: { entityType: string; entityId: string }) {
  const router = useRouter();
  const [flagType, setFlagType] = useState("manual_review");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/flags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entityType,
          entityId,
          flagType,
          severity,
          reason: reason.trim()
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to create flag.");
        return;
      }

      setReason("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-text">Add flag</h3>
      <Input value={flagType} onChange={(event) => setFlagType(event.target.value)} placeholder="Flag type" />
      <Select value={severity} onChange={(event) => setSeverity(event.target.value as "low" | "medium" | "high")}> 
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </Select>
      <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for this flag" />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "Saving..." : "Create flag"}
      </Button>
    </form>
  );
}
