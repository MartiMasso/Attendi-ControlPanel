import { UserCircle2 } from "lucide-react";
import { notFound } from "next/navigation";

import { FeedbackCategoryBadge } from "@/components/feedback/feedback-category-badge";
import { FeedbackDetailHeader } from "@/components/feedback/feedback-detail-header";
import { FeedbackManagementForm } from "@/components/forms/feedback-management-form";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { formatDate } from "@/lib/utils";
import { getAdminNotes } from "@/services/admin-meta-service";
import { getPlatformFeedbackById } from "@/services/platform-feedback-service";
import type { AdminNote } from "@/types";

function getSenderName(displayName: string | null, email: string | null) {
  return displayName || email || "Unknown sender";
}

function getSenderInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");

  return initials || null;
}

export default async function FeedbackDetailPage({ params }: { params: { id: string } }) {
  let feedback: Awaited<ReturnType<typeof getPlatformFeedbackById>> = null;
  let notes: AdminNote[] = [];
  let loadError: string | null = null;

  try {
    const [feedbackResult, feedbackNotes] = await Promise.all([
      getPlatformFeedbackById(params.id),
      getAdminNotes("platform_feedback", params.id)
    ]);

    feedback = feedbackResult;
    notes = feedbackNotes;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load feedback detail.";
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <header className="border-b border-border pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Feedback detail</h1>
          <p className="mt-1 text-sm text-text-muted">Feedback ID: {params.id}</p>
        </header>
        <ErrorState message={loadError} />
      </div>
    );
  }

  if (!feedback) {
    notFound();
  }

  const senderName = getSenderName(feedback.display_name, feedback.email);
  const senderInitials = getSenderInitials(senderName);

  return (
    <div className="space-y-6">
      <FeedbackDetailHeader feedbackId={feedback.id} subject={feedback.subject} initialStatus={feedback.status} />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text">User details</h2>
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface-muted text-sm">
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">Sender</dt>
            <dd className="font-medium text-text">{senderName}</dd>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">Email</dt>
            <dd className="font-medium text-text">{feedback.email || "-"}</dd>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">User ID</dt>
            <dd className="font-medium text-text">{feedback.user_id || "-"}</dd>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">Category</dt>
            <dd>
              <FeedbackCategoryBadge value={feedback.category} />
            </dd>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">Received</dt>
            <dd className="font-medium text-text">{formatDate(feedback.created_at)}</dd>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs uppercase tracking-[0.06em] text-text-muted">Handled</dt>
            <dd className="font-medium text-text">
              {feedback.handled_at ? `${formatDate(feedback.handled_at)}${feedback.handled_by ? ` · ${feedback.handled_by}` : ""}` : "-"}
            </dd>
          </div>
        </dl>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Message</h2>
        <Card className="space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5f0ff] text-primary">
              {senderInitials ? (
                <span className="text-sm font-semibold">{senderInitials}</span>
              ) : (
                <UserCircle2 size={20} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{senderName}</p>
              <p className="text-xs text-text-muted">{feedback.email || feedback.user_id || formatDate(feedback.created_at)}</p>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-text">{feedback.message}</p>
        </Card>
      </section>

      <FeedbackManagementForm feedbackId={feedback.id} notes={notes} legacyAdminNotes={feedback.admin_notes} />
    </div>
  );
}
