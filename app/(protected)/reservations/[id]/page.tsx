import { notFound } from "next/navigation";

import { AddFlagForm } from "@/components/forms/add-flag-form";
import { AddNoteForm } from "@/components/forms/add-note-form";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EntityPreview } from "@/components/ui/entity-preview";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValueList } from "@/components/ui/key-value-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getReservationDetail } from "@/services/reservations-service";

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const detail = await getReservationDetail(params.id);

  if (!detail) {
    notFound();
  }

  const reservation = detail.reservation;

  return (
    <div className="space-y-6">
      <PageHeader title="Reservation detail" description={`Reservation ID: ${String(reservation.id)}`} />

      <KeyValueList
        items={[
          { label: "Status", value: <StatusBadge value={String(reservation.status ?? "unknown")} /> },
          { label: "User ID", value: String(reservation.user_id ?? "-") },
          { label: "Product ID", value: String(reservation.product_id ?? "-") },
          { label: "Start", value: String(reservation.start_date ?? "-") },
          { label: "End", value: String(reservation.end_date ?? "-") },
          {
            label: "Amount",
            value:
              reservation.importe !== null && reservation.importe !== undefined
                ? `€${Number(reservation.importe).toFixed(2)}`
                : "-"
          },
          { label: "Payment Intent", value: String(reservation.payment_intent_id ?? "-") },
          { label: "Created", value: formatDate(String(reservation.created_at ?? "")) }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityPreview title="Creator profile" value={detail.creator as Record<string, unknown> | null} />
        <EntityPreview title="Product" value={detail.product} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityPreview title="Hotel attribution" value={detail.attribution} />
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Payments</h2>
          {detail.payments.length ? (
            <div className="space-y-2 text-xs">
              {detail.payments.map((payment, index) => (
                <pre key={index} className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-text-muted">
                  {JSON.stringify(payment, null, 2)}
                </pre>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No payment rows"
              description="The optional payments table is empty or unavailable for this reservation."
            />
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Related incidents</h2>
        {detail.relatedIncidents.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {detail.relatedIncidents.map((incident) => (
                <TableRow key={String(incident.id)}>
                  <TableCell className="font-mono text-xs">{String(incident.id)}</TableCell>
                  <TableCell>{String(incident.title ?? "-")}</TableCell>
                  <TableCell>
                    <StatusBadge value={String(incident.status ?? "unknown")} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={String(incident.priority ?? "unknown")} />
                  </TableCell>
                  <TableCell>{formatDate(String(incident.created_at ?? ""))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState title="No incidents linked" description="No incidents currently reference this reservation." />
        )}
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <AddNoteForm entityType="reservation" entityId={String(reservation.id)} />
        <AddFlagForm entityType="reservation" entityId={String(reservation.id)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Admin notes</h2>
          {detail.notes.length ? (
            <ul className="space-y-2 text-sm">
              {detail.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <p>{note.note}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatDate(note.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No notes for this reservation yet.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Flags</h2>
          {detail.flags.length ? (
            <ul className="space-y-2 text-sm">
              {detail.flags.map((flag) => (
                <li key={flag.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{flag.flag_type}</p>
                    <StatusBadge value={flag.severity} />
                  </div>
                  <p className="mt-1 text-text-muted">{flag.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No flags on this reservation.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
