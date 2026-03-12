"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InternalHubMember, InternalTaskPriority } from "@/types";

const PRIORITIES: InternalTaskPriority[] = ["low", "medium", "high", "urgent"];

export function InternalTaskCreateForm({ members }: { members: InternalHubMember[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [priority, setPriority] = useState<InternalTaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/internal/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assigneeUserId: assigneeUserId || null,
          priority,
          dueDate: dueDate || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to create internal task.");
        return;
      }

      setTitle("");
      setDescription("");
      setAssigneeUserId("");
      setPriority("medium");
      setDueDate("");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-[#8cb0e8] bg-gradient-to-br from-[#dbeafe] via-[#e7f1ff] to-[#f7fbff] p-4 shadow-[0_12px_24px_rgba(30,64,175,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]"
    >
      <h3 className="text-sm font-semibold text-[#0d2f63]">Create Team Task</h3>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
      <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Context and acceptance criteria..." />
      <div className="grid gap-3 md:grid-cols-3">
        <Select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name || member.username || member.user_id}
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
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating..." : "Create task"}
      </Button>
    </form>
  );
}
