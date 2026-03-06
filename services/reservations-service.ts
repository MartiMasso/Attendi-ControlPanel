import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getEmailMapByUserIds, getProfilesMap } from "@/services/profile-helpers";
import type { ReservationRow } from "@/types";

interface ListReservationsInput {
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

export async function listReservations({ status, query, page = 1, pageSize = 25 }: ListReservationsInput) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let statement = supabase
    .from("reservations")
    .select(
      "id,product_id,user_id,status,start_date,end_date,created_at,importe,payment_intent_id,payment_captured",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status?.trim()) {
    statement = statement.eq("status", status);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);

    if (isUUID(token)) {
      statement = statement.eq("id", token);
    } else {
      statement = statement.or(`payment_intent_id.ilike.%${token}%,status.ilike.%${token}%`);
    }
  }

  const { data, error, count } = await statement;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    product_id: string | null;
    user_id: string | null;
    status: string | null;
    start_date: string;
    end_date: string;
    created_at: string | null;
    importe: number | null;
    payment_intent_id: string | null;
    payment_captured: boolean | null;
  }>;

  const userIds = rows.map((row) => row.user_id).filter(Boolean) as string[];
  const productIds = rows.map((row) => row.product_id).filter(Boolean) as string[];

  const [profileMap, emailMap, products] = await Promise.all([
    getProfilesMap(userIds),
    getEmailMapByUserIds(userIds),
    productIds.length
      ? supabase.from("products").select("id,title").in("id", productIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (products.error && !isMissingDatabaseObject(products.error)) {
    throw new Error(products.error.message);
  }

  const productMap = new Map<string, string>();
  (products.data ?? []).forEach((product) => {
    productMap.set(product.id as string, product.title as string);
  });

  const mapped: ReservationRow[] = rows.map((row) => {
    const profile = row.user_id ? profileMap.get(row.user_id) : null;

    return {
      ...row,
      status: row.status,
      user_name: profile?.full_name ?? profile?.username ?? null,
      user_email: row.user_id ? emailMap.get(row.user_id) ?? null : null,
      product_title: row.product_id ? productMap.get(row.product_id) ?? null : null
    };
  });

  return {
    rows: mapped,
    total: count ?? 0
  };
}

export async function getReservationDetail(reservationId: string) {
  const supabase = createSupabaseServerClient();

  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError) {
    throw new Error(reservationError.message);
  }

  if (!reservation) {
    return null;
  }

  const [creatorProfileMap, product, attribution, payments, incidents, notes, flags] = await Promise.all([
    reservation.user_id ? getProfilesMap([reservation.user_id as string]) : Promise.resolve(new Map()),
    reservation.product_id
      ? supabase.from("products").select("id,title,user_id,category,price").eq("id", reservation.product_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("reservation_hotel_attributions").select("*").eq("reservation_id", reservation.id).maybeSingle(),
    supabase.from("payments").select("*").eq("reservation_id", reservation.id).order("created_at", { ascending: false }),
    supabase.from("incidents").select("id,title,status,priority,created_at").eq("reservation_id", reservation.id),
    getAdminNotes("reservation", reservationId),
    getAdminFlags("reservation", reservationId)
  ]);

  if (product.error && !isMissingDatabaseObject(product.error)) {
    throw new Error(product.error.message);
  }

  if (attribution.error && !isMissingDatabaseObject(attribution.error)) {
    throw new Error(attribution.error.message);
  }

  if (payments.error && !isMissingDatabaseObject(payments.error)) {
    throw new Error(payments.error.message);
  }

  if (incidents.error && !isMissingDatabaseObject(incidents.error)) {
    throw new Error(incidents.error.message);
  }

  const userId = reservation.user_id as string | null;
  const creator = userId ? creatorProfileMap.get(userId) ?? null : null;

  return {
    reservation: reservation as Record<string, unknown>,
    creator,
    product: (product.data as Record<string, unknown> | null) ?? null,
    attribution: (attribution.data as Record<string, unknown> | null) ?? null,
    payments: (payments.data as Array<Record<string, unknown>> | null) ?? [],
    relatedIncidents: (incidents.data as Array<Record<string, unknown>> | null) ?? [],
    notes,
    flags
  };
}
