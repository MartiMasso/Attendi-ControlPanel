import Link from "next/link";

import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { listVerificationRequests } from "@/services/verifications-service";

interface VerificationsPageProps {
  searchParams: {
    q?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function VerificationsPage({ searchParams }: VerificationsPageProps) {
  const query = firstParam(searchParams.q) ?? "";

  const [pending, reviewed] = await Promise.all([
    listVerificationRequests({ status: "pending", query, pageSize: 30 }),
    listVerificationRequests({ status: "reviewed", query, pageSize: 30 })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifications"
        description="Review legal verification flows for business and hotel profiles."
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-[1fr_auto]" method="GET">
        <Input name="q" defaultValue={query} placeholder="Search by legal name or tax ID" />
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-strong">
          Search
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Pending requests</h2>
        {pending.rows.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>Applicant</TableHead>
                <TableHead>Requested Type</TableHead>
                <TableHead>Legal Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {pending.rows.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>{request.user_full_name || request.user_username || request.user_id}</div>
                    <div className="text-xs text-text-muted">{request.user_id}</div>
                  </TableCell>
                  <TableCell>{request.requested_account_type}</TableCell>
                  <TableCell>{request.legal_name}</TableCell>
                  <TableCell>
                    <StatusBadge value={request.status} />
                  </TableCell>
                  <TableCell>{formatDate(request.submitted_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/verifications/${request.id}`} className="text-sm font-medium text-primary hover:underline">
                      Review
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState title="No pending verification requests" description="All submitted requests are already reviewed." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Reviewed requests</h2>
        {reviewed.rows.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>Applicant</TableHead>
                <TableHead>Requested Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {reviewed.rows.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.user_full_name || request.user_username || request.user_id}</TableCell>
                  <TableCell>{request.requested_account_type}</TableCell>
                  <TableCell>
                    <StatusBadge value={request.status} />
                  </TableCell>
                  <TableCell>{formatDate(request.reviewed_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/verifications/${request.id}`} className="text-sm font-medium text-primary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState title="No reviewed requests" description="Reviewed requests will appear here." />
        )}
      </section>
    </div>
  );
}
