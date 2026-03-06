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
import { getUserDetail } from "@/services/users-service";

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  const detail = await getUserDetail(params.id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.profile.full_name || detail.profile.username}
        description={`User ID: ${detail.profile.id}`}
      />

      <KeyValueList
        items={[
          { label: "Email", value: detail.profile.email ?? "Not exposed" },
          { label: "Username", value: detail.profile.username },
          { label: "Account Type", value: detail.profile.account_type },
          { label: "Verification", value: <StatusBadge value={detail.profile.verification_status} /> },
          { label: "Created", value: formatDate(detail.profile.created_at) },
          { label: "Last Seen", value: formatDate(detail.profile.last_seen_at) }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityPreview title="Business details" value={detail.businessDetails} />
        <EntityPreview title="Hotel details" value={detail.hotelDetails} />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Related products</h2>
          {detail.products.length ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {detail.products.map((product) => (
                  <TableRow key={String(product.id)}>
                    <TableCell>{String(product.title ?? "-")}</TableCell>
                    <TableCell>{String(product.category ?? "-")}</TableCell>
                    <TableCell>{formatDate(String(product.created_at ?? ""))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState title="No products" description="This user has no related products in the current schema." />
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Related reservations</h2>
          {detail.reservations.length ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Range</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {detail.reservations.map((reservation) => (
                  <TableRow key={String(reservation.id)}>
                    <TableCell>{String(reservation.id)}</TableCell>
                    <TableCell>
                      <StatusBadge value={String(reservation.status ?? "unknown")} />
                    </TableCell>
                    <TableCell>
                      {String(reservation.start_date ?? "-")} - {String(reservation.end_date ?? "-")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState title="No reservations" description="No reservations are linked to this user yet." />
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AddNoteForm entityType="user" entityId={detail.profile.id} />
        <AddFlagForm entityType="user" entityId={detail.profile.id} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Admin notes</h2>
          {detail.notes.length ? (
            <ul className="space-y-2 text-sm">
              {detail.notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <p className="text-text">{note.note}</p>
                  <p className="mt-1 text-xs text-text-muted">{formatDate(note.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No admin notes yet.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Internal flags</h2>
          {detail.flags.length ? (
            <ul className="space-y-2 text-sm">
              {detail.flags.map((flag) => (
                <li key={flag.id} className="rounded-lg border border-border bg-surface-muted p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text">{flag.flag_type}</span>
                    <StatusBadge value={flag.severity} />
                  </div>
                  <p className="mt-1 text-text-muted">{flag.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No flags for this user.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
