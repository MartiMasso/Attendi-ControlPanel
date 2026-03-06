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

export default async function VerificationDetailPage({ params }: { params: { id: string } }) {
  const detail = await getVerificationRequestDetail(params.id);

  if (!detail) {
    notFound();
  }

  const request = detail.request;

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(request.legal_name ?? "Verification Request")}
        description={`Verification request ID: ${String(request.id)}`}
      />

      <KeyValueList
        items={[
          { label: "User", value: String(request.user_full_name ?? request.user_username ?? request.user_id) },
          { label: "Requested Account Type", value: String(request.requested_account_type) },
          { label: "Tax ID", value: String(request.tax_id) },
          { label: "Company Email", value: String(request.company_email ?? "-") },
          { label: "Status", value: <StatusBadge value={String(request.status)} /> },
          { label: "Submitted", value: formatDate(String(request.submitted_at)) },
          { label: "Reviewed", value: formatDate(String(request.reviewed_at ?? "")) },
          { label: "Review Note", value: String(request.review_note ?? "-") }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <VerificationReviewForm requestId={String(request.id)} />
        <EntityPreview title="Business / legal details" value={detail.businessDetails} />
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
          <EmptyState
            title="No documents found"
            description="No related files were found in business_documents for this user."
          />
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
