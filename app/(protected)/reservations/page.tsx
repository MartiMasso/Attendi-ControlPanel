import Link from "next/link";

import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { listReservations } from "@/services/reservations-service";

interface ReservationsPageProps {
  searchParams: {
    q?: string;
    status?: string;
    page?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildPageHref(searchParams: ReservationsPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();

  const q = firstParam(searchParams.q);
  const status = firstParam(searchParams.status);

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("page", String(page));

  return `/reservations?${params.toString()}`;
}

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const query = firstParam(searchParams.q) ?? "";
  const status = firstParam(searchParams.status) ?? "";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  const { rows, total } = await listReservations({ query, status, page: currentPage, pageSize: 25 });
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Track booking lifecycle, payment context, and affected users/entities."
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-3" method="GET">
        <Input name="q" defaultValue={query} placeholder="Search by reservation ID or payment intent" />
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rejected">Rejected</option>
        </Select>
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-strong">
          Apply
        </button>
      </form>

      {rows.length ? (
        <DataTable>
          <TableHeader>
            <tr>
              <TableHead>ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell className="font-mono text-xs">{reservation.id}</TableCell>
                <TableCell>
                  <p className="font-medium">{reservation.user_name ?? reservation.user_id ?? "-"}</p>
                  <p className="text-xs text-text-muted">{reservation.user_email ?? "No email exposed"}</p>
                </TableCell>
                <TableCell>{reservation.product_title ?? reservation.product_id ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge value={reservation.status} />
                </TableCell>
                <TableCell>
                  <p>{reservation.start_date}</p>
                  <p className="text-xs text-text-muted">to {reservation.end_date}</p>
                </TableCell>
                <TableCell>
                  {reservation.importe !== null && reservation.importe !== undefined ? `€${Number(reservation.importe).toFixed(2)}` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/reservations/${reservation.id}`} className="text-sm font-medium text-primary hover:underline">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        <EmptyState title="No reservations found" description="Try changing filters or searching by reservation UUID." />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
        <p className="text-text-muted">
          Page {currentPage} of {totalPages} ({total} reservations)
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
