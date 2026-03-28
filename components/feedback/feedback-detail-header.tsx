"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PlatformFeedbackStatus } from "@/types";

const STATUSES: PlatformFeedbackStatus[] = ["new", "in_review", "resolved", "closed"];

export function FeedbackDetailHeader({
  feedbackId,
  subject,
  initialStatus
}: {
  feedbackId: string;
  subject: string;
  initialStatus: PlatformFeedbackStatus | string;
}) {
  const [status, setStatus] = useState<PlatformFeedbackStatus | string>(initialStatus);
  const [savedStatus, setSavedStatus] = useState<PlatformFeedbackStatus | string>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccess(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const hasChanges = useMemo(() => status !== savedStatus, [status, savedStatus]);

  const handleSave = () => {
    if (!hasChanges) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to save changes.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        feedback?: {
          status?: string;
        };
      } | null;

      const nextStatus = payload?.feedback?.status ?? status;
      setStatus(nextStatus);
      setSavedStatus(nextStatus);
      setSuccess("Changes saved");
    });
  };

  return (
    <header className="space-y-3 border-b border-border pb-4">
      <Link href="/feedback" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft size={16} />
        Back to feedback
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{subject}</h1>
            <StatusBadge value={status} />
          </div>
          <p className="mt-1 text-sm text-text-muted">Feedback ID: {feedbackId}</p>
        </div>

        <div className="w-full space-y-2 sm:w-auto">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={status} onChange={(event) => setStatus(event.target.value as PlatformFeedbackStatus)} className="sm:w-[180px]">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace("_", " ")}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant={hasChanges ? "primary" : "secondary"}
              size="sm"
              onClick={handleSave}
              disabled={isPending || !hasChanges}
              className={hasChanges ? "ring-2 ring-primary/35" : undefined}
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>

          {error ? <p className="text-xs text-danger sm:text-right">{error}</p> : null}
          {success ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-success sm:justify-end">
              <CheckCircle2 size={14} />
              {success}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
