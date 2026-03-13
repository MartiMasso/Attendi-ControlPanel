import { notFound } from "next/navigation";

import { AddFlagForm } from "@/components/forms/add-flag-form";
import { AddNoteForm } from "@/components/forms/add-note-form";
import { VerificationReviewForm } from "@/components/forms/verification-review-form";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EntityPreview } from "@/components/ui/entity-preview";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyValueList } from "@/components/ui/key-value-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getVerificationRequestDetail } from "@/services/verifications-service";

function normalizeRequestId(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export default async function VerificationDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolvedParams = await Promise.resolve(params);
  const requestId = normalizeRequestId(String(resolvedParams.id ?? ""));

  if (!requestId) {
    notFound();
  }

  const detail = await getVerificationRequestDetail(requestId);

  if (!detail) {
    notFound();
  }

  const request = detail.request;
  const profile = detail.profile;
  const parsed = request.parsed_payload;

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(request.legal_name ?? "Verification Request")}
        description={`Verification request ID: ${String(request.id)}`}
      />

      <KeyValueList
        items={[
          { label: "User", value: String(request.user_full_name ?? request.user_username ?? request.user_id) },
          { label: "User ID", value: String(request.user_id) },
          { label: "Login Email", value: String(request.login_email ?? profile?.login_email ?? "-") },
          { label: "Request Status", value: <StatusBadge value={String(request.status)} /> },
          { label: "Tipo de perfil solicitado", value: String(request.requested_account_type) },
          { label: "Tipo de perfil actual", value: String(request.current_account_type ?? profile?.account_type ?? "-") },
          { label: "Nombre legal de la empresa", value: String(request.legal_name ?? "-") },
          { label: "NIF / CIF", value: String(request.tax_id ?? "-") },
          { label: "Correo corporativo", value: String(request.company_email ?? "-") },
          { label: "Teléfono", value: String(request.company_phone ?? "-") }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <VerificationReviewForm requestId={String(request.id)} />
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Payload (parsed)</h2>
          <KeyValueList
            items={[
              { label: "Source", value: parsed.source || "-" },
              { label: "Request Kind", value: parsed.request_kind ?? "-" },
              { label: "Category", value: parsed.category ?? "-" },
              { label: "Address Street", value: parsed.address.street ?? "-" },
              { label: "Address Number", value: parsed.address.street_number ?? "-" },
              { label: "Postal Code", value: parsed.address.postal_code ?? "-" },
              { label: "City", value: parsed.address.city ?? "-" },
              { label: "Opening Hours (Mon-Fri)", value: parsed.opening_hours.mon_fri ?? "-" },
              { label: "Opening Hours (Saturday)", value: parsed.opening_hours.saturday ?? "-" },
              { label: "Opening Hours (Sunday)", value: parsed.opening_hours.sunday ?? "-" },
              { label: "Contact Phone", value: parsed.contact.phone ?? "-" }
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Current Profile State</h2>
          <KeyValueList
            items={[
              { label: "Profile Account Type", value: profile?.account_type ?? "-" },
              { label: "Profile Verification Status", value: <StatusBadge value={profile?.verification_status ?? "-"} /> },
              { label: "Can Publish", value: String(profile?.can_publish ?? "-") }
            ]}
          />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Timeline</h2>
          <KeyValueList
            items={[
              { label: "Created At", value: formatDate(request.created_at) },
              { label: "Updated At", value: formatDate(request.updated_at) },
              { label: "Last Submitted At", value: formatDate(request.last_submitted_at) },
              { label: "Last Admin Email Sent", value: formatDate(request.last_admin_email_sent_at) },
              { label: "Reminder Count", value: String(request.reminder_count) },
              { label: "Last Email Action", value: request.last_email_action ?? "-" },
              { label: "Reviewed At", value: formatDate(request.reviewed_at) },
              { label: "Reviewed By", value: request.reviewed_by ?? "-" },
              { label: "Review Notes", value: request.review_notes ?? request.review_note ?? "-" }
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityPreview title="Current business_details" value={detail.businessDetailsCurrent} />
        <EntityPreview title="Original verification payload (raw)" value={request.payload} />
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Uploaded documents</h2>
        {detail.documents.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Link</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {detail.documents.map((doc) => (
                <TableRow key={String(doc.id)}>
                  <TableCell>{String(doc.document_name ?? "-")}</TableCell>
                  <TableCell>{String(doc.document_type ?? "-")}</TableCell>
                  <TableCell>
                    <StatusBadge value={String(doc.verified ? "approved" : "pending")} />
                  </TableCell>
                  <TableCell>{formatDate(String(doc.uploaded_at ?? ""))}</TableCell>
                  <TableCell>
                    {doc.public_url ? (
                      <a href={String(doc.public_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Open
                      </a>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState title="No documents found" description="No related files were found in business_documents for this user." />
        )}
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <AddNoteForm entityType="verification" entityId={String(request.id)} />
        <AddFlagForm entityType="verification" entityId={String(request.id)} />
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
            <p className="text-sm text-text-muted">No admin notes yet.</p>
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
            <p className="text-sm text-text-muted">No flags set.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
