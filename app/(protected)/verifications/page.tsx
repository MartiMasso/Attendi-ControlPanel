import Link from "next/link";

import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getRequestLastActivityDate } from "@/lib/verification-requests";
import { listVerificationRequests } from "@/services/verifications-service";

interface VerificationsPageProps {
  searchParams: {
    q?: string;
    accountType?: string;
    verificationStatus?: string;
    source?: string;
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

function buildPageHref(searchParams: VerificationsPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  const q = firstParam(searchParams.q);
  const accountType = firstParam(searchParams.accountType);
  const verificationStatus = firstParam(searchParams.verificationStatus);
  const source = firstParam(searchParams.source);
  const dateFrom = firstParam(searchParams.dateFrom);
  const dateTo = firstParam(searchParams.dateTo);

  if (q) params.set("q", q);
  if (accountType) params.set("accountType", accountType);
  if (verificationStatus) params.set("verificationStatus", verificationStatus);
  if (source) params.set("source", source);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  params.set("page", String(page));

  return `/verifications?${params.toString()}`;
}

export default async function VerificationsPage({ searchParams }: VerificationsPageProps) {
  const q = firstParam(searchParams.q) ?? "";
  const accountType = firstParam(searchParams.accountType) ?? "";
  const verificationStatus = firstParam(searchParams.verificationStatus) ?? "";
  const source = firstParam(searchParams.source) ?? "";
  const dateFrom = firstParam(searchParams.dateFrom) ?? "";
  const dateTo = firstParam(searchParams.dateTo) ?? "";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const pageSize = 20;

  const { rows, total } = await listVerificationRequests({
    query: q,
    accountType,
    verificationStatus,
    source,
    dateFrom,
    dateTo,
    page: currentPage,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifications"
        description="Manual verification queue and audit history for business/hotel upgrades."
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-3 xl:grid-cols-4" method="GET">
        <Input name="q" defaultValue={q} placeholder="Search name, email, request ID or user ID" />
        <Select name="accountType" defaultValue={accountType}>
          <option value="">All requested account types</option>
          <option value="business">Business</option>
          <option value="hotel">Hotel</option>
        </Select>
        <Select name="verificationStatus" defaultValue={verificationStatus}>
          <option value="">All request statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_changes">Needs changes</option>
          <option value="not_required">Not required</option>
        </Select>
        <Select name="source" defaultValue={source}>
          <option value="">All sources</option>
          <option value="settings_upgrade">settings_upgrade</option>
          <option value="settings_verified_update">settings_verified_update</option>
          <option value="register">register</option>
          <option value="other">other</option>
        </Select>
        <Input type="date" name="dateFrom" defaultValue={dateFrom} />
        <Input type="date" name="dateTo" defaultValue={dateTo} />
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong"
        >
          Apply filters
        </button>
      </form>

      {rows.length ? (
        <DataTable>
          <TableHeader>
            <tr>
              <TableHead>Request ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Login Email</TableHead>
              <TableHead>Current Type</TableHead>
              <TableHead>Requested Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last Submitted</TableHead>
              <TableHead>Reminder Count</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((request) => {
              const lastActivity = getRequestLastActivityDate(request.last_submitted_at, request.updated_at, request.submitted_at);

              return (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="font-medium">{request.id}</div>
                    <div className="text-xs text-text-muted">{request.user_id}</div>
                  </TableCell>
                  <TableCell>{request.user_full_name || request.user_username || request.user_id}</TableCell>
                  <TableCell>{request.login_email ?? <span className="text-text-muted">Not exposed</span>}</TableCell>
                  <TableCell>{request.current_account_type ?? <span className="text-text-muted">-</span>}</TableCell>
                  <TableCell>{request.requested_account_type}</TableCell>
                  <TableCell>
                    <StatusBadge value={request.status} />
                  </TableCell>
                  <TableCell>{request.source || "other"}</TableCell>
                  <TableCell>{formatDate(lastActivity)}</TableCell>
                  <TableCell>{request.reminder_count}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/verifications/${encodeURIComponent(String(request.id))}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      ) : (
        <EmptyState
          title="No verification requests found"
          description="Try different filters. Pending legacy register requests are excluded from the review queue."
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
        <p className="text-text-muted">
          Page {currentPage} of {totalPages} ({total} requests)
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
    </div>
  );
}
