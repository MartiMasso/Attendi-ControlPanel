"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { AdminNote } from "@/types";

export function FeedbackManagementForm({
  feedbackId,
  notes,
  legacyAdminNotes
}: {
  feedbackId: string;
  notes: AdminNote[];
  legacyAdminNotes?: string | null;
}) {
  const [note, setNote] = useState("");
  const [notesList, setNotesList] = useState<AdminNote[]>(notes);
  const [legacyNote, setLegacyNote] = useState<string | null>(legacyAdminNotes ?? null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isDeletingLegacyNote, setIsDeletingLegacyNote] = useState(false);

  useEffect(() => {
    setNotesList(notes);
  }, [notes]);

  useEffect(() => {
    setLegacyNote(legacyAdminNotes ?? null);
  }, [legacyAdminNotes]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeout = window.setTimeout(() => setSuccess(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const syncNotesFromServer = useCallback(async () => {
    const params = new URLSearchParams({
      entityType: "platform_feedback",
      entityId: feedbackId
    });

    const response = await fetch(`/api/admin/notes?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    }).catch(() => null);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to sync notes thread.");
      return false;
    }

    const payload = (await response.json().catch(() => null)) as { notes?: AdminNote[] } | null;
    if (!payload?.notes) {
      setError("Unable to sync notes thread.");
      return false;
    }

    setNotesList(payload.notes);
    return true;
  }, [feedbackId]);

  const handleCreateNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!note.trim()) {
      setError("Note cannot be empty.");
      return;
    }

    startTransition(async () => {
      const noteText = note.trim();
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticNote: AdminNote = {
        id: optimisticId,
        entity_type: "platform_feedback",
        entity_id: feedbackId,
        note: noteText,
        created_by_admin_id: "pending",
        created_at: new Date().toISOString()
      };

      setNotesList((current) => [optimisticNote, ...current]);
      setNote("");

      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          entityType: "platform_feedback",
          entityId: feedbackId,
          note: noteText
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setNotesList((current) => current.filter((item) => item.id !== optimisticId));
        setNote(noteText);
        setError(payload?.error ?? "Unable to save note.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as { note?: AdminNote | null } | null;

      if (payload?.note?.id) {
        setNotesList((current) => {
          const withoutOptimistic = current.filter((item) => item.id !== optimisticId);
          return [payload.note as AdminNote, ...withoutOptimistic.filter((item) => item.id !== payload.note?.id)];
        });
      } else {
        const synced = await syncNotesFromServer();
        if (!synced) {
          setNotesList((current) => current.filter((item) => item.id !== optimisticId));
          setNote(noteText);
          setError("Note saved, but the thread could not refresh. Reload once to sync.");
          return;
        }
      }

      setSuccess("Note added");
    });
  };

  const handleDeleteNote = (noteId: string) => {
    setError(null);
    setSuccess(null);
    setDeletingNoteId(noteId);

    startTransition(async () => {
      const response = await fetch(`/api/admin/notes/${noteId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to delete note.");
        setDeletingNoteId(null);
        return;
      }

      setNotesList((current) => current.filter((item) => item.id !== noteId));
      setDeletingNoteId(null);
      setSuccess("Note deleted");
    });
  };

  const handleDeleteLegacyNote = () => {
    setError(null);
    setSuccess(null);
    setIsDeletingLegacyNote(true);

    startTransition(async () => {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          adminNotes: null
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to delete legacy note.");
        setIsDeletingLegacyNote(false);
        return;
      }

      setLegacyNote(null);
      setIsDeletingLegacyNote(false);
      setSuccess("Legacy note deleted");
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4">
      <h2 className="text-sm font-semibold text-text">Internal notes thread</h2>

      <form onSubmit={handleCreateNote} className="space-y-3">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Write a new internal comment..."
        />
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? "Adding..." : "Add note"}
        </Button>
      </form>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 size={14} />
          {success}
        </p>
      ) : null}

      <div className="space-y-3">
        {legacyNote ? (
          <article className="rounded-lg border border-border bg-[#fff8ec] p-3">
            <p className="text-xs uppercase tracking-[0.06em] text-text-muted">Legacy note</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-text">{legacyNote}</p>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteLegacyNote}
                disabled={isPending && isDeletingLegacyNote}
                className="text-danger hover:bg-[#fdebed] hover:text-danger"
              >
                {isPending && isDeletingLegacyNote ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </article>
        ) : null}

        {notesList.length ? (
          <ul className="space-y-3">
            {notesList.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-surface-muted p-3">
                <p className="whitespace-pre-wrap text-sm text-text">{item.note}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-text-muted">{formatDate(item.created_at)}</p>
                  {item.id.startsWith("optimistic-") ? (
                    <p className="text-xs text-text-muted">Syncing...</p>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(item.id)}
                      disabled={isPending && deletingNoteId === item.id}
                      className="text-danger hover:bg-[#fdebed] hover:text-danger"
                    >
                      {isPending && deletingNoteId === item.id ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No comments yet. Add the first internal note.</p>
        )}
      </div>
    </section>
  );
}
