"use client";

import { useRouter } from "next/navigation";

import { FeedbackCategoryBadge } from "@/components/feedback/feedback-category-badge";
import { Badge } from "@/components/ui/badge";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { PlatformFeedbackRow } from "@/types";

function truncateMessage(value: string, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

export function FeedbackTable({ rows }: { rows: PlatformFeedbackRow[] }) {
  const router = useRouter();

  const openFeedback = (feedbackId: string) => {
    router.push(`/feedback/${encodeURIComponent(feedbackId)}`);
  };

  return (
    <DataTable>
      <TableHeader>
        <tr>
          <TableHead>Received</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>Sender</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {rows.map((feedback) => {
          const isNew = String(feedback.status).toLowerCase() === "new";

          return (
            <TableRow
              key={feedback.id}
              role="link"
              tabIndex={0}
              aria-label={`Open feedback ${feedback.subject}`}
              className={cn(
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                isNew ? "bg-[#fff8ec] hover:bg-[#fff2df]" : undefined
              )}
              onClick={() => openFeedback(feedback.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFeedback(feedback.id);
                }
              }}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {isNew ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-warning" /> : null}
                  <span>{formatDate(feedback.created_at)}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge value={feedback.status} />
              </TableCell>
              <TableCell>
                <FeedbackCategoryBadge value={feedback.category} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{feedback.subject}</p>
                  {isNew ? <Badge color="warning">new</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="max-w-[260px] text-sm text-text-muted">{truncateMessage(feedback.message)}</TableCell>
              <TableCell>
                <p className="font-medium">{feedback.display_name || feedback.email || "-"}</p>
                {feedback.display_name && feedback.email ? <p className="text-xs text-text-muted">{feedback.email}</p> : null}
                {feedback.user_id ? <p className="text-xs text-text-muted">{feedback.user_id}</p> : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </DataTable>
  );
}
