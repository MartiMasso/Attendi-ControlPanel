import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
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
const DEFAULT_K_HOTEL = 0.4;
const DEFAULT_STANDARD_COMMISSION_PCT = 12.5;

function toOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizePercentage(value: unknown, fallback = 0) {
  return Math.max(0, toNumber(value, fallback));
}

function normalizeK(value: unknown, fallback = DEFAULT_K_HOTEL) {
  return Math.min(1, Math.max(0, toNumber(value, fallback)));
}

function roundTwo(value: number) {
  return Number(value.toFixed(2));
}

function isRecoverableReadError(error: { code?: string; message?: string } | null) {
  return isMissingDatabaseObject(error as never) || isPermissionError(error as never);
}

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
    .select("id,full_name,username,profile_photo_url,account_type,verification_status,created_at", { count: "exact" })
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
    profile_photo_url: string | null;
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
    .select("id,full_name,username,profile_photo_url,account_type,verification_status,created_at,comision_hotel")
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
  const isHotel = String(profile.account_type ?? "").toLowerCase() === "hotel";
  let hotelCommissionOverview: UserDetail["hotelCommissionOverview"] = null;
  let hotelRevenueOverview: UserDetail["hotelRevenueOverview"] = null;

  if (isHotel) {
    const [settingsResult, partnerLinksResult, revenueResult] = await Promise.all([
      supabase.from("platform_commission_settings").select("k_hotel").eq("id", 1).maybeSingle(),
      supabase
        .from("hotel_company_partners")
        .select("company_user_id,created_at,updated_at")
        .eq("hotel_user_id", userId)
        .eq("is_partner", true)
        .order("created_at", { ascending: false }),
      supabase.from("reservation_hotel_attributions").select("hotel_amount,attendi_amount,currency").eq("hotel_id", userId)
    ]);

    if (settingsResult.error && !isRecoverableReadError(settingsResult.error)) {
      throw new Error(settingsResult.error.message);
    }

    if (partnerLinksResult.error && !isRecoverableReadError(partnerLinksResult.error)) {
      throw new Error(partnerLinksResult.error.message);
    }

    if (revenueResult.error && !isRecoverableReadError(revenueResult.error)) {
      throw new Error(revenueResult.error.message);
    }

    const kHotel = normalizeK((settingsResult.data as { k_hotel?: number | null } | null)?.k_hotel, DEFAULT_K_HOTEL);
    const ownServicesCommissionPct = normalizePercentage(
      (profile as { comision_hotel?: number | null }).comision_hotel,
      DEFAULT_STANDARD_COMMISSION_PCT
    );

    const partnerLinks = (partnerLinksResult.data ?? []) as Array<{
      company_user_id: string;
      created_at: string | null;
      updated_at: string | null;
    }>;

    const partnerIds = Array.from(
      new Set(
        partnerLinks
          .map((row) => row.company_user_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const partnerLinkByCompany = new Map<string, { created_at: string | null; updated_at: string | null }>();
    partnerLinks.forEach((row) => {
      if (!row.company_user_id) {
        return;
      }

      partnerLinkByCompany.set(row.company_user_id, {
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });

    let partnerProfileRows: Array<{
      id: string;
      full_name: string | null;
      username: string | null;
      account_type: string | null;
      comision_propietario: number | null;
      comision_hotel: number | null;
    }> = [];
    let partnerBusinessRows: Array<{ user_id: string; business_name: string | null }> = [];
    let partnerOverrideRows: Array<{ company_id: string; ce_p_pct: number | null }> = [];
    let partnerEmailMap = new Map<string, string>();

    if (partnerIds.length) {
      const [profilesResult, businessDetailsResult, overridesResult, emails] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,username,account_type,comision_propietario,comision_hotel")
          .in("id", partnerIds),
        supabase.from("business_details").select("user_id,business_name").in("user_id", partnerIds),
        supabase
          .from("hotel_company_commission_overrides")
          .select("company_id,ce_p_pct,active")
          .eq("hotel_id", userId)
          .eq("active", true)
          .in("company_id", partnerIds),
        getEmailMapByUserIds(partnerIds)
      ]);

      if (profilesResult.error && !isRecoverableReadError(profilesResult.error)) {
        throw new Error(profilesResult.error.message);
      }

      if (businessDetailsResult.error && !isRecoverableReadError(businessDetailsResult.error)) {
        throw new Error(businessDetailsResult.error.message);
      }

      if (overridesResult.error && !isRecoverableReadError(overridesResult.error)) {
        throw new Error(overridesResult.error.message);
      }

      partnerProfileRows = (profilesResult.data ?? []) as typeof partnerProfileRows;
      partnerBusinessRows = (businessDetailsResult.data ?? []) as typeof partnerBusinessRows;
      partnerOverrideRows = (overridesResult.data ?? []) as typeof partnerOverrideRows;
      partnerEmailMap = emails;
    }

    const partnerProfileById = new Map(partnerProfileRows.map((row) => [row.id, row]));
    const partnerBusinessNameById = new Map(
      partnerBusinessRows.map((row) => [row.user_id, toOptionalText(row.business_name)])
    );
    const partnerOverrideByCompanyId = new Map(
      partnerOverrideRows.map((row) => [row.company_id, normalizePercentage(row.ce_p_pct, 0)])
    );

    const partners = partnerIds.map((companyId) => {
      const partnerProfile = partnerProfileById.get(companyId);
      const accountType = toOptionalText(partnerProfile?.account_type);
      const standardCommissionPct =
        accountType === "hotel"
          ? normalizePercentage(partnerProfile?.comision_hotel, DEFAULT_STANDARD_COMMISSION_PCT)
          : normalizePercentage(partnerProfile?.comision_propietario, DEFAULT_STANDARD_COMMISSION_PCT);
      const overridePct = partnerOverrideByCompanyId.get(companyId) ?? null;
      const effectivePct = overridePct ?? standardCommissionPct;
      const commissionMode: "standard" | "custom" = overridePct === null ? "standard" : "custom";
      const linkMeta = partnerLinkByCompany.get(companyId);
      const name =
        partnerBusinessNameById.get(companyId) ??
        toOptionalText(partnerProfile?.full_name) ??
        toOptionalText(partnerProfile?.username) ??
        companyId;

      return {
        company_user_id: companyId,
        company_name: name,
        company_email: partnerEmailMap.get(companyId) ?? null,
        account_type: accountType,
        commission_standard_pct: roundTwo(standardCommissionPct),
        commission_effective_pct: roundTwo(effectivePct),
        commission_override_pct: overridePct === null ? null : roundTwo(overridePct),
        commission_mode: commissionMode,
        linked_at: linkMeta?.created_at ?? null,
        updated_at: linkMeta?.updated_at ?? null
      };
    });

    hotelCommissionOverview = {
      own_services_commission_pct: roundTwo(ownServicesCommissionPct),
      k_hotel: roundTwo(kHotel),
      k_hotel_pct: roundTwo(kHotel * 100),
      partners
    };

    const revenueRows = (revenueResult.data ?? []) as Array<{
      hotel_amount: number | string | null;
      attendi_amount: number | string | null;
      currency: string | null;
    }>;

    const totals = revenueRows.reduce(
      (acc, row) => {
        acc.totalHotel += toNumber(row.hotel_amount, 0);
        acc.totalAttendi += toNumber(row.attendi_amount, 0);
        if (!acc.currency) {
          acc.currency = toOptionalText(row.currency);
        }
        return acc;
      },
      {
        totalHotel: 0,
        totalAttendi: 0,
        currency: null as string | null
      }
    );

    hotelRevenueOverview = {
      total_hotel_received: roundTwo(totals.totalHotel),
      total_attendi_earned: roundTwo(totals.totalAttendi),
      operations: revenueRows.length,
      currency: totals.currency ?? "EUR"
    };
  }

  return {
    profile: {
      id: profile.id as string,
      full_name: profile.full_name as string | null,
      username: profile.username as string,
      profile_photo_url: (profile as { profile_photo_url?: string | null }).profile_photo_url ?? null,
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
    hotelCommissionOverview,
    hotelRevenueOverview,
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
