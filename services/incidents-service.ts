import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getProfilesMap } from "@/services/profile-helpers";
import type { IncidentRow } from "@/types";

interface ListIncidentsInput {
  status?: string;
  priority?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

export async function listIncidents({ status, priority, query, page = 1, pageSize = 25 }: ListIncidentsInput) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let statement = supabase
    .from("incidents")
    .select("id,reservation_id,reporter_user_id,affected_user_id,title,description,status,priority,assigned_admin_user_id,created_at,updated_at", {
      count: "exact"
    })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status?.trim()) {
    statement = statement.eq("status", status);
  }

  if (priority?.trim()) {
    statement = statement.eq("priority", priority);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);
    statement = statement.or(`title.ilike.%${token}%,description.ilike.%${token}%`);
  }

  const { data, error, count } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return {
        rows: [] as IncidentRow[],
        total: 0
      };
    }

    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as IncidentRow[],
    total: count ?? 0
  };
}

export async function getIncidentDetail(incidentId: string) {
  const supabase = createSupabaseServerClient();

  const { data: incident, error: incidentError } = await supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle();

  if (incidentError) {
    if (isMissingDatabaseObject(incidentError)) {
      return null;
    }

    throw new Error(incidentError.message);
  }

  if (!incident) {
    return null;
  }

  const userIds = [incident.reporter_user_id, incident.affected_user_id].filter(Boolean) as string[];

  const [profiles, reservation, notes, flags] = await Promise.all([
    getProfilesMap(userIds),
    incident.reservation_id
      ? supabase
          .from("reservations")
          .select("id,status,start_date,end_date,created_at,user_id,product_id")
          .eq("id", incident.reservation_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    getAdminNotes("incident", incidentId),
    getAdminFlags("incident", incidentId)
  ]);

  if (reservation.error && !isMissingDatabaseObject(reservation.error)) {
    throw new Error(reservation.error.message);
  }

  return {
    incident: incident as IncidentRow,
    reporter: incident.reporter_user_id ? profiles.get(incident.reporter_user_id as string) ?? null : null,
    affected: incident.affected_user_id ? profiles.get(incident.affected_user_id as string) ?? null : null,
    reservation: (reservation.data as Record<string, unknown> | null) ?? null,
    notes,
    flags
  };
}

export async function updateIncidentStatus(incidentId: string, status: string, priority: string) {
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("incidents")
    .update({
      status,
      priority,
      updated_at: new Date().toISOString()
    })
    .eq("id", incidentId);

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return;
    }

    throw new Error(error.message);
  }
}
