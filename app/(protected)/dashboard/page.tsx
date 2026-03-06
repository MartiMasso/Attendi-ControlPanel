import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatRelativeDate, toTitleCase } from "@/lib/utils";
import { getDashboardMetrics, getRecentActivity } from "@/services/dashboard-service";

function getEntityHref(entityType: string, entityId: string) {
  if (entityType === "user") return `/users/${entityId}`;
  if (entityType === "reservation") return `/reservations/${entityId}`;
  if (entityType === "verification") return `/verifications/${entityId}`;
  if (entityType === "incident") return `/incidents/${entityId}`;
  return "/audit-logs";
}

export default async function DashboardPage() {
  const [metrics, recentActivity] = await Promise.all([getDashboardMetrics(), getRecentActivity(14)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Global platform metrics and recent operational activity across Attendi."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Users" value={metrics.totalUsers} />
        <MetricCard title="Businesses" value={metrics.totalBusinesses} />
        <MetricCard title="Hotels" value={metrics.totalHotels} />
        <MetricCard title="Total Reservations" value={metrics.totalReservations} />
        <MetricCard title="Active Reservations" value={metrics.activeReservations} />
        <MetricCard title="Pending Verifications" value={metrics.pendingVerifications} />
        <MetricCard title="Open Incidents" value={metrics.openIncidents} />
      </section>

      <section className="space-y-3">
        <Card className="p-4">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest admin and platform events for quick monitoring.</CardDescription>
        </Card>

        {recentActivity.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {recentActivity.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{toTitleCase(entry.action)}</TableCell>
                  <TableCell>{toTitleCase(entry.entity_type)}</TableCell>
                  <TableCell>{formatRelativeDate(entry.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={getEntityHref(entry.entity_type, entry.entity_id)} className="text-sm font-medium text-primary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Admin audit logs are empty. Once actions are performed, recent events will appear here."
          />
        )}
      </section>
    </div>
  );
}
