import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, toTitleCase } from "@/lib/utils";
import { listAuditLogs } from "@/services/audit-log-service";

export default async function AuditLogsPage() {
  const logs = await listAuditLogs(120);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Traceability for administrative actions performed inside Attendi Control Panel."
      />

      {logs.length ? (
        <DataTable>
          <TableHeader>
            <tr>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Admin User</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>Created</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{toTitleCase(log.action)}</TableCell>
                <TableCell>{toTitleCase(log.entity_type)}</TableCell>
                <TableCell className="font-mono text-xs">{log.entity_id ?? "-"}</TableCell>
                <TableCell className="font-mono text-xs">{log.admin_user_id}</TableCell>
                <TableCell>
                  {log.metadata ? (
                    <pre className="max-w-[280px] overflow-x-auto rounded bg-surface-muted p-2 text-xs text-text-muted">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-text-muted">-</span>
                  )}
                </TableCell>
                <TableCell>{formatDate(log.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        <EmptyState
          title="No audit logs"
          description="Run migrations and perform admin actions to populate this feed."
        />
      )}
    </div>
  );
}
