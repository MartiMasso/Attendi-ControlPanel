import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";
import { deriveEffectiveVerificationStatus, isRealPendingVerificationRequest } from "@/lib/verification-requests";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getEmailMapByUserIds, getLastSeenMap } from "@/services/profile-helpers";
import type { AccountType, UserDetail, UserRow, VerificationStatus } from "@/types";

interface ListUsersInput {
  query?: string;
  accountType?: string;
  verificationStatus?: string;
  page?: number;
  pageSize?: number;
}

const UPGRADABLE_TYPES: AccountType[] = ["consumer", "business", "hotel"];

async function getRealPendingVerificationUserIdSet(userIds?: string[]) {
  if (userIds && !userIds.length) {
    return new Set<string>();
  }

  const supabase = createSupabaseServerClient();
  let statement = supabase.from("verification_requests").select("user_id,status,payload").eq("status", "pending");

  if (userIds?.length) {
    statement = statement.in("user_id", userIds);
  }

  const { data, error } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return new Set<string>();
    }

    throw new Error(error.message);
  }

  const set = new Set<string>();
  (data ?? []).forEach((row) => {
    const userId = String(row.user_id ?? "");
    if (!userId) {
      return;
    }

    if (isRealPendingVerificationRequest(row.status, row.payload as Record<string, unknown> | null)) {
      set.add(userId);
    }
  });

  return set;
}

export async function listUsers({
  query,
  accountType,
  verificationStatus,
  page = 1,
  pageSize = 30
}: ListUsersInput) {
  const supabase = createSupabaseServerClient();
  const normalizedVerificationStatus = verificationStatus ? verificationStatus.toLowerCase() : "";
  const needsRealPendingFilter = normalizedVerificationStatus === "pending";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const realPendingUserIds = needsRealPendingFilter ? await getRealPendingVerificationUserIdSet() : new Set<string>();

  if (needsRealPendingFilter && realPendingUserIds.size === 0) {
    return {
      rows: [] as UserRow[],
      total: 0
    };
  }

  let statement = supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (needsRealPendingFilter) {
    statement = statement.in("id", Array.from(realPendingUserIds));
  }

  if (accountType) {
    statement = statement.eq("account_type", accountType);
  }

  if (verificationStatus && !needsRealPendingFilter) {
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
  const [emailMap, lastSeenMap, realPendingForRows] = await Promise.all([
    getEmailMapByUserIds(userIds),
    getLastSeenMap(userIds),
    getRealPendingVerificationUserIdSet(userIds)
  ]);

  const mappedRows: UserRow[] = rows.map((row) => {
    const hasRealPending = realPendingForRows.has(row.id);
    const effectiveVerificationStatus = deriveEffectiveVerificationStatus(row.verification_status, hasRealPending);

    return {
      ...row,
      email: emailMap.get(row.id) ?? null,
      verification_status: effectiveVerificationStatus,
      effective_verification_status: effectiveVerificationStatus,
      has_real_pending_verification_request: hasRealPending,
      last_seen_at: lastSeenMap.get(row.id) ?? null
    };
  });

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

  const [emailMap, lastSeenMap, realPendingForUser] = await Promise.all([
    getEmailMapByUserIds([userId]),
    getLastSeenMap([userId]),
    getRealPendingVerificationUserIdSet([userId])
  ]);

  const hasRealPending = realPendingForUser.has(userId);
  const effectiveVerificationStatus = deriveEffectiveVerificationStatus(profile.verification_status, hasRealPending);

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
      verification_status: effectiveVerificationStatus,
      effective_verification_status: effectiveVerificationStatus,
      has_real_pending_verification_request: hasRealPending,
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

export async function updateUserAccountType(userId: string, nextAccountType: AccountType) {
  if (!UPGRADABLE_TYPES.includes(nextAccountType)) {
    throw new Error("Invalid account type.");
  }

  const supabase = createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,account_type,verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("User not found.");
  }

  const previousAccountType = profile.account_type as AccountType;
  const previousVerificationStatus = profile.verification_status as VerificationStatus;

  let nextVerificationStatus: VerificationStatus = previousVerificationStatus;

  if (nextAccountType === "consumer") {
    nextVerificationStatus = "not_required";
  } else if (previousVerificationStatus === "not_required") {
    // Manual upgrade from consumer to business/hotel implies explicit admin approval.
    nextVerificationStatus = "approved";
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      account_type: nextAccountType,
      verification_status: nextVerificationStatus
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (nextAccountType === "business" || nextAccountType === "hotel") {
    const { error: businessDetailsError } = await supabase
      .from("business_details")
      .update({ organization_type: nextAccountType })
      .eq("user_id", userId);

    if (businessDetailsError && !isMissingDatabaseObject(businessDetailsError)) {
      throw new Error(businessDetailsError.message);
    }
  }

  return {
    previousAccountType,
    nextAccountType,
    previousVerificationStatus,
    nextVerificationStatus
  };
}
