"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { InternalHubMember, InternalTaskPriority, InternalTaskStatus } from "@/types";

const STATUSES: InternalTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const PRIORITIES: InternalTaskPriority[] = ["low", "medium", "high", "urgent"];

export function InternalTaskUpdateForm({
  taskId,
  currentStatus,
  currentPriority,
  currentAssigneeUserId,
  currentDueDate,
  members
}: {
  taskId: string;
  currentStatus: InternalTaskStatus;
  currentPriority: InternalTaskPriority;
  currentAssigneeUserId: string | null;
  currentDueDate: string | null;
  members: InternalHubMember[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<InternalTaskStatus>(currentStatus);
  const [priority, setPriority] = useState<InternalTaskPriority>(currentPriority);
  const [assigneeUserId, setAssigneeUserId] = useState(currentAssigneeUserId ?? "");
  const [dueDate, setDueDate] = useState(currentDueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/internal/tasks/${taskId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          priority,
          assigneeUserId: assigneeUserId || null,
          dueDate: dueDate || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to update task.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-border bg-surface-elevated p-3">
      <div className="grid gap-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value as InternalTaskStatus)}>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(event) => setPriority(event.target.value as InternalTaskPriority)}>
          {PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name || member.username || member.user_id}
            </option>
          ))}
        </Select>
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
