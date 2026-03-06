import Link from "next/link";

import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { listIncidents } from "@/services/incidents-service";

interface IncidentsPageProps {
  searchParams: {
    q?: string;
    status?: string;
    priority?: string;
    page?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildPageHref(searchParams: IncidentsPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();

  const q = firstParam(searchParams.q);
  const status = firstParam(searchParams.status);
  const priority = firstParam(searchParams.priority);

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  params.set("page", String(page));

  return `/incidents?${params.toString()}`;
}

export default async function IncidentsPage({ searchParams }: IncidentsPageProps) {
  const query = firstParam(searchParams.q) ?? "";
  const status = firstParam(searchParams.status) ?? "";
  const priority = firstParam(searchParams.priority) ?? "";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  const { rows, total } = await listIncidents({ query, status, priority, page: currentPage, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Manage open support and operational incidents related to users and reservations."
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-4" method="GET">
        <Input name="q" defaultValue={query} placeholder="Search by title or description" />
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
        </Select>
        <Select name="priority" defaultValue={priority}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-strong">
          Apply
        </button>
      </form>

      {rows.length ? (
        <DataTable>
          <TableHeader>
            <tr>
              <TableHead>Title</TableHead>
              <TableHead>Reservation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-xs text-text-muted">{incident.id}</p>
                </TableCell>
                <TableCell>{incident.reservation_id ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge value={incident.status} />
                </TableCell>
                <TableCell>
                  <StatusBadge value={incident.priority} />
                </TableCell>
                <TableCell>{formatDate(incident.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/incidents/${incident.id}`} className="text-sm font-medium text-primary hover:underline">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        <EmptyState
          title="No incidents available"
          description="Run the admin migrations to enable incidents, or incidents are currently empty."
        />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
        <p className="text-text-muted">
          Page {currentPage} of {totalPages} ({total} incidents)
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
