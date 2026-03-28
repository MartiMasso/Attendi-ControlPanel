import Link from "next/link";

import { FeedbackDateRangeField } from "@/components/feedback/feedback-date-range-field";
import { FeedbackLiveUpdates } from "@/components/feedback/feedback-live-updates";
import { FeedbackTable } from "@/components/feedback/feedback-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import {
  countNewPlatformFeedback,
  getLatestPlatformFeedbackCreatedAt,
  listPlatformFeedback
} from "@/services/platform-feedback-service";

interface FeedbackPageProps {
  searchParams: {
    q?: string;
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildPageHref(searchParams: FeedbackPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  const q = firstParam(searchParams.q);
  const status = firstParam(searchParams.status);
  const category = firstParam(searchParams.category);
  const dateFrom = firstParam(searchParams.dateFrom);
  const dateTo = firstParam(searchParams.dateTo);

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("page", String(page));

  return `/feedback?${params.toString()}`;
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const q = firstParam(searchParams.q) ?? "";
  const status = firstParam(searchParams.status) ?? "";
  const category = firstParam(searchParams.category) ?? "";
  const dateFrom = firstParam(searchParams.dateFrom) ?? "";
  const dateTo = firstParam(searchParams.dateTo) ?? "";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const pageSize = 20;

  let rows: Awaited<ReturnType<typeof listPlatformFeedback>>["rows"] = [];
  let total = 0;
  let pendingNewCount = 0;
  let latestCreatedAt: string | null = null;
  let loadError: string | null = null;

  try {
    const [listResult, pendingCount, latest] = await Promise.all([
      listPlatformFeedback({
        query: q,
        status,
        category,
        dateFrom,
        dateTo,
        page: currentPage,
        pageSize
      }),
      countNewPlatformFeedback(),
      getLatestPlatformFeedbackCreatedAt()
    ]);

    rows = listResult.rows;
    total = listResult.total;
    pendingNewCount = pendingCount;
    latestCreatedAt = latest;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load feedback messages.";
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="User suggestions and bug reports sent from the Contact screen."
        rightSlot={
          <Badge color={pendingNewCount > 0 ? "warning" : "neutral"}>
            {pendingNewCount} new
          </Badge>
        }
      />

      {loadError ? <ErrorState message={loadError} /> : null}

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-2 xl:grid-cols-5" method="GET">
        <Input name="q" defaultValue={q} placeholder="Search subject, message, email or name" className="xl:col-span-2" />
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select name="category" defaultValue={category}>
          <option value="">All categories</option>
          <option value="suggestion">Suggestion</option>
          <option value="bug">Bug</option>
          <option value="other">Other</option>
        </Select>
        <FeedbackDateRangeField defaultDateFrom={dateFrom} defaultDateTo={dateTo} nameFrom="dateFrom" nameTo="dateTo" />
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong md:col-span-2 xl:col-span-1"
        >
          Apply filters
        </button>
      </form>

      <FeedbackLiveUpdates initialLatestCreatedAt={latestCreatedAt} />

      {loadError ? null : rows.length ? (
        <FeedbackTable rows={rows} />
      ) : (
        <EmptyState
          title="No feedback found"
          description="Try adjusting the filters or wait for new feedback to be submitted from the app."
        />
      )}

      {!loadError ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
          <p className="text-text-muted">
            Page {currentPage} of {totalPages} ({total} messages)
          </p>
          <div className="flex items-center gap-3">
            {currentPage > 1 ? (
              <Link href={buildPageHref(searchParams, currentPage - 1)} className="font-medium text-primary hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-text-muted">Previous</span>
            )}
            {currentPage < totalPages ? (
              <Link href={buildPageHref(searchParams, currentPage + 1)} className="font-medium text-primary hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-text-muted">Next</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
