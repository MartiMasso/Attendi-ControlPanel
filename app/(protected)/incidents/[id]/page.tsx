import { notFound } from "next/navigation";

import { AddFlagForm } from "@/components/forms/add-flag-form";
import { AddNoteForm } from "@/components/forms/add-note-form";
import { IncidentUpdateForm } from "@/components/forms/incident-update-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValueList } from "@/components/ui/key-value-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getIncidentDetail } from "@/services/incidents-service";

export default async function IncidentDetailPage({ params }: { params: { id: string } }) {
  const detail = await getIncidentDetail(params.id);

  if (!detail) {
    notFound();
  }

  const incident = detail.incident;

  return (
    <div className="space-y-6">
      <PageHeader title={incident.title} description={`Incident ID: ${incident.id}`} />

      <KeyValueList
        items={[
          { label: "Status", value: <StatusBadge value={incident.status} /> },
          { label: "Priority", value: <StatusBadge value={incident.priority} /> },
          { label: "Reservation ID", value: incident.reservation_id ?? "-" },
          { label: "Reporter User", value: incident.reporter_user_id ?? "-" },
          { label: "Affected User", value: incident.affected_user_id ?? "-" },
          { label: "Assigned Admin", value: incident.assigned_admin_user_id ?? "-" },
          { label: "Created", value: formatDate(incident.created_at) },
          { label: "Updated", value: formatDate(incident.updated_at) }
        ]}
      />

      <Card>
        <h2 className="text-sm font-semibold text-text">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{incident.description}</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <IncidentUpdateForm incidentId={incident.id} currentStatus={incident.status} currentPriority={incident.priority} />
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-text">Linked reservation summary</h2>
          {detail.reservation ? (
            <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
              {JSON.stringify(detail.reservation, null, 2)}
            </pre>
          ) : (
            <EmptyState title="No linked reservation" description="This incident does not include reservation context." />
          )}
        </Card>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <AddNoteForm entityType="incident" entityId={incident.id} />
        <AddFlagForm entityType="incident" entityId={incident.id} />
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
            <p className="text-sm text-text-muted">No notes registered.</p>
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
            <p className="text-sm text-text-muted">No flags set for this incident.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
