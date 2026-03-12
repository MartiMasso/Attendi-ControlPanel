"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InternalNoteCategory } from "@/types";

const CATEGORIES: InternalNoteCategory[] = ["announcement", "decision", "reminder", "resource"];

export function InternalNoteCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<InternalNoteCategory>("announcement");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim() || !body.trim()) {
      setError("Title and note body are required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/internal/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          category,
          pinned
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to create internal note.");
        return;
      }

      setTitle("");
      setBody("");
      setCategory("announcement");
      setPinned(false);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-[#8cb0e8] bg-gradient-to-br from-[#dbeafe] via-[#e7f1ff] to-[#f7fbff] p-4 shadow-[0_12px_24px_rgba(30,64,175,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]"
    >
      <h3 className="text-sm font-semibold text-[#0d2f63]">Post Internal Note</h3>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Announcement, decision, reminder..." />
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Select value={category} onChange={(event) => setCategory(event.target.value as InternalNoteCategory)}>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          Pin
        </label>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Publishing..." : "Publish note"}
      </Button>
    </form>
  );
}
