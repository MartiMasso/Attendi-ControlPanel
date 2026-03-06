import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getEmailMapByUserIds, getLastSeenMap } from "@/services/profile-helpers";
import type { UserDetail, UserRow } from "@/types";

interface ListUsersInput {
  query?: string;
  accountType?: string;
  verificationStatus?: string;
  page?: number;
  pageSize?: number;
}

export async function listUsers({
  query,
  accountType,
  verificationStatus,
  page = 1,
  pageSize = 30
}: ListUsersInput) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let statement = supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (accountType) {
    statement = statement.eq("account_type", accountType);
  }

  if (verificationStatus) {
    statement = statement.eq("verification_status", verificationStatus);
  }

  if (query?.trim()) {
    const token = query.trim().replace(/[,()]/g, " ");

    if (isUUID(token)) {
      statement = statement.eq("id", token);
    } else {
      statement = statement.or(`full_name.ilike.%${token}%,username.ilike.%${token}%,business_name.ilike.%${token}%`);
    }
  }

  const { data, error, count } = await statement;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    username: string;
    account_type: "consumer" | "business" | "hotel";
    verification_status: string;
    created_at: string | null;
  }>;

  const userIds = rows.map((row) => row.id);
  const [emailMap, lastSeenMap] = await Promise.all([getEmailMapByUserIds(userIds), getLastSeenMap(userIds)]);

  const mappedRows: UserRow[] = rows.map((row) => ({
    ...row,
    email: emailMap.get(row.id) ?? null,
    verification_status: row.verification_status,
    last_seen_at: lastSeenMap.get(row.id) ?? null
  }));

  return {
    rows: mappedRows,
    total: count ?? 0
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    return null;
  }

  const [emailMap, lastSeenMap] = await Promise.all([getEmailMapByUserIds([userId]), getLastSeenMap([userId])]);

  const { data: businessDetails, error: businessError } = await supabase
    .from("business_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (businessError && !isMissingDatabaseObject(businessError)) {
    throw new Error(businessError.message);
  }

  const { data: hotelDetails, error: hotelError } = await supabase.from("hotel_details").select("*").eq("user_id", userId).maybeSingle();

  if (hotelError && !isMissingDatabaseObject(hotelError)) {
    throw new Error(hotelError.message);
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,title,category,created_at,price")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (productsError && !isMissingDatabaseObject(productsError)) {
    throw new Error(productsError.message);
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from("reservations")
    .select("id,status,start_date,end_date,created_at,importe,product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (reservationsError && !isMissingDatabaseObject(reservationsError)) {
    throw new Error(reservationsError.message);
  }

  const [notes, flags] = await Promise.all([getAdminNotes("user", userId), getAdminFlags("user", userId)]);

  return {
    profile: {
      id: profile.id as string,
      full_name: profile.full_name as string | null,
      username: profile.username as string,
      email: emailMap.get(userId) ?? null,
      account_type: profile.account_type as "consumer" | "business" | "hotel",
      verification_status: profile.verification_status as string,
      created_at: profile.created_at as string | null,
      last_seen_at: lastSeenMap.get(userId) ?? null
    },
    businessDetails: (businessDetails as Record<string, unknown> | null) ?? null,
    hotelDetails: (hotelDetails as Record<string, unknown> | null) ?? null,
    products: (products as Array<Record<string, unknown>> | null) ?? [],
    reservations: (reservations as Array<Record<string, unknown>> | null) ?? [],
    notes,
    flags
  };
}
