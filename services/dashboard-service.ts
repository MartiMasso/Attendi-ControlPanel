import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import type { DashboardMetrics, RecentActivityItem } from "@/types";

const ACTIVE_RESERVATION_STATUSES = ["accepted", "active", "in_progress", "ongoing"];

async function countRows(
  table: string,
  apply?: (query: any) => any
) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  if (apply) {
    query = apply(query as never) as never;
  }

  const { count, error } = await query;

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return 0;
    }

    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [totalUsers, totalBusinesses, totalHotels, totalReservations, activeReservations, pendingVerifications, openIncidents] =
    await Promise.all([
      countRows("profiles"),
      countRows("profiles", (query) => query.eq("account_type", "business")),
      countRows("profiles", (query) => query.eq("account_type", "hotel")),
      countRows("reservations"),
      countRows("reservations", (query) => query.in("status", ACTIVE_RESERVATION_STATUSES)),
      countRows("verification_requests", (query) => query.eq("status", "pending")),
      countRows("incidents", (query) => query.in("status", ["open", "in_review"]))
    ]);

  return {
    totalUsers,
    totalBusinesses,
    totalHotels,
    totalReservations,
    activeReservations,
    pendingVerifications,
    openIncidents
  };
}

export async function getRecentActivity(limit = 12): Promise<RecentActivityItem[]> {
  const supabase = createSupabaseServerClient();

  const { data: auditRows, error: auditError } = await supabase
    .from("admin_audit_logs")
    .select("id,action,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (auditError && !isMissingDatabaseObject(auditError)) {
    throw new Error(auditError.message);
  }

  if (auditRows && auditRows.length) {
    return auditRows.map((row) => ({
      id: row.id as string,
      source: "audit",
      action: row.action as string,
      entity_type: row.entity_type as string,
      entity_id: (row.entity_id as string | null) ?? row.id,
      created_at: row.created_at as string,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined
    }));
  }

  const [verificationRows, reservationRows] = await Promise.all([
    supabase
      .from("verification_requests")
      .select("id,status,submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(limit),
    supabase.from("reservations").select("id,status,created_at").order("created_at", { ascending: false }).limit(limit)
  ]);

  const activity: RecentActivityItem[] = [];

  if (!verificationRows.error || isMissingDatabaseObject(verificationRows.error)) {
    (verificationRows.data ?? []).forEach((row) => {
      activity.push({
        id: `verification-${row.id}`,
        source: "verification",
        action: `verification_${row.status}`,
        entity_type: "verification",
        entity_id: row.id as string,
        created_at: row.submitted_at as string
      });
    });
  }

  if (!reservationRows.error || isMissingDatabaseObject(reservationRows.error)) {
    (reservationRows.data ?? []).forEach((row) => {
      activity.push({
        id: `reservation-${row.id}`,
        source: "reservation",
        action: `reservation_${row.status ?? "updated"}`,
        entity_type: "reservation",
        entity_id: row.id as string,
        created_at: row.created_at as string
      });
    });
  }

  return activity
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
