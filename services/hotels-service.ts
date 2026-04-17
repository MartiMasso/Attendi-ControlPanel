import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";

interface GetHotelsCommissionDirectoryInput {
  query?: string;
  selectedHotelId?: string;
}

interface HotelProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
  business_name: string | null;
  created_at: string | null;
}

interface HotelBusinessDetailRow {
  user_id: string;
  business_name: string | null;
  hotel_display_name: string | null;
  email: string | null;
}

interface HotelSplitSettingRow {
  hotel_id: string;
  k_hotel: number | null;
}

interface RpcHotelPartnerCountRow {
  hotel_id: string;
  partners_count: number | string | null;
}

interface RpcHotelPartnerRow {
  company_id: string;
  company_name: string | null;
  company_email: string | null;
  ce_p_standard_pct: number | string | null;
  ce_p_effective_pct: number | string | null;
  ce_p_override_pct: number | string | null;
  has_custom_ce_p: boolean | null;
}

interface LegacyPartnerLinkRow {
  company_user_id: string;
}

interface LegacyPartnerProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  business_name: string | null;
  account_type: string | null;
  comision_propietario: number | null;
}

interface LegacyPartnerBusinessRow {
  user_id: string;
  business_name: string | null;
  email: string | null;
}

interface LegacyOverrideRow {
  company_id: string;
  ce_p_pct: number | null;
}

export interface HotelDirectoryRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  profile_photo_url: string | null;
  k_hotel: number;
  k_hotel_pct: number;
  partners_count: number;
  created_at: string | null;
}

export interface HotelPartnerCommissionDetailRow {
  company_id: string;
  company_name: string;
  company_email: string | null;
  ce_p_standard_pct: number;
  ce_p_effective_pct: number;
  ce_p_override_pct: number | null;
  has_custom_ce_p: boolean;
}

export interface HotelDirectoryDetail extends HotelDirectoryRow {
  standard_ce_p_pct: number;
  standard_hotel_pct: number;
  standard_attendi_pct: number;
  partners: HotelPartnerCommissionDetailRow[];
}

export interface HotelsCommissionDirectoryData {
  query: string;
  hotels: HotelDirectoryRow[];
  selectedHotelId: string | null;
  selectedHotel: HotelDirectoryDetail | null;
  default_standard_commission_pct: number;
}

const DEFAULT_K_HOTEL = 0.4;
const DEFAULT_STANDARD_COMMISSION_PCT = 12.5;

function sanitizeSearchQuery(value: string) {
  return value.replace(/[,()]/g, " ").trim();
}

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

function isMissingRpcFunctionError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  const message = error.message ?? "";
  return error.code === "PGRST202" || /could not find.*function|function .* does not exist/i.test(message);
}

function resolveHotelName(profile: HotelProfileRow, businessDetails: HotelBusinessDetailRow | null) {
  return (
    toOptionalText(businessDetails?.hotel_display_name) ??
    toOptionalText(businessDetails?.business_name) ??
    toOptionalText(profile.business_name) ??
    toOptionalText(profile.full_name) ??
    toOptionalText(profile.username) ??
    profile.id
  );
}

function resolveCompanyName(
  profile: Pick<LegacyPartnerProfileRow, "id" | "full_name" | "username" | "business_name"> | undefined,
  businessDetails: Pick<LegacyPartnerBusinessRow, "business_name"> | null,
  fallbackId: string
) {
  return (
    toOptionalText(businessDetails?.business_name) ??
    toOptionalText(profile?.business_name) ??
    toOptionalText(profile?.full_name) ??
    toOptionalText(profile?.username) ??
    fallbackId
  );
}

function sortPartners(rows: HotelPartnerCommissionDetailRow[]) {
  return [...rows].sort((left, right) => {
    const customDelta = Number(right.has_custom_ce_p) - Number(left.has_custom_ce_p);
    if (customDelta !== 0) {
      return customDelta;
    }

    return left.company_name.localeCompare(right.company_name);
  });
}

async function getLegacyPartnerCountsByHotelId(hotelIds: string[]) {
  if (!hotelIds.length) {
    return new Map<string, number>();
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("hotel_company_partners")
    .select("hotel_user_id,company_user_id")
    .eq("is_partner", true)
    .in("hotel_user_id", hotelIds);

  if (error) {
    if (isRecoverableReadError(error)) {
      return new Map<string, number>();
    }

    throw new Error(error.message);
  }

  const pairs = (data ?? []) as Array<{ hotel_user_id: string; company_user_id: string }>;
  const uniqueCompaniesByHotel = new Map<string, Set<string>>();

  pairs.forEach((row) => {
    if (!row.hotel_user_id || !row.company_user_id) {
      return;
    }

    const current = uniqueCompaniesByHotel.get(row.hotel_user_id) ?? new Set<string>();
    current.add(row.company_user_id);
    uniqueCompaniesByHotel.set(row.hotel_user_id, current);
  });

  return new Map(Array.from(uniqueCompaniesByHotel.entries()).map(([hotelId, companies]) => [hotelId, companies.size]));
}

async function getLegacyPartnersForHotel(hotelId: string): Promise<HotelPartnerCommissionDetailRow[]> {
  const supabase = createSupabaseServerClient();

  const { data: linksData, error: linksError } = await supabase
    .from("hotel_company_partners")
    .select("company_user_id")
    .eq("hotel_user_id", hotelId)
    .eq("is_partner", true);

  if (linksError) {
    if (isRecoverableReadError(linksError)) {
      return [];
    }

    throw new Error(linksError.message);
  }

  const linkRows = (linksData ?? []) as LegacyPartnerLinkRow[];
  const companyIds = Array.from(
    new Set(
      linkRows
        .map((row) => row.company_user_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (!companyIds.length) {
    return [];
  }

  const [profilesResult, businessResult, overridesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,username,business_name,account_type,comision_propietario")
      .in("id", companyIds),
    supabase
      .from("business_details")
      .select("user_id,business_name,email")
      .in("user_id", companyIds),
    supabase
      .from("hotel_company_commission_overrides")
      .select("company_id,ce_p_pct")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .in("company_id", companyIds)
  ]);

  if (profilesResult.error && !isRecoverableReadError(profilesResult.error)) {
    throw new Error(profilesResult.error.message);
  }

  if (businessResult.error && !isRecoverableReadError(businessResult.error)) {
    throw new Error(businessResult.error.message);
  }

  if (overridesResult.error && !isRecoverableReadError(overridesResult.error)) {
    throw new Error(overridesResult.error.message);
  }

  const profiles = (profilesResult.data ?? []) as LegacyPartnerProfileRow[];
  const businesses = (businessResult.data ?? []) as LegacyPartnerBusinessRow[];
  const overrides = (overridesResult.data ?? []) as LegacyOverrideRow[];

  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const businessById = new Map(businesses.map((row) => [row.user_id, row]));
  const overrideByCompanyId = new Map(overrides.map((row) => [row.company_id, normalizePercentage(row.ce_p_pct, DEFAULT_STANDARD_COMMISSION_PCT)]));

  const rows: HotelPartnerCommissionDetailRow[] = [];

  companyIds.forEach((companyId) => {
    const profile = profileById.get(companyId);

    if (toOptionalText(profile?.account_type) !== "business") {
      return;
    }

    const business = businessById.get(companyId) ?? null;
    const standard = normalizePercentage(profile?.comision_propietario, DEFAULT_STANDARD_COMMISSION_PCT);
    const override = overrideByCompanyId.get(companyId);

    rows.push({
      company_id: companyId,
      company_name: resolveCompanyName(profile, business, companyId),
      company_email: toOptionalText(business?.email) ?? toOptionalText(profile?.username),
      ce_p_standard_pct: roundTwo(standard),
      ce_p_effective_pct: roundTwo(override ?? standard),
      ce_p_override_pct: override === undefined ? null : roundTwo(override),
      has_custom_ce_p: override !== undefined
    });
  });

  return sortPartners(rows);
}

export async function getHotelsCommissionDirectory({
  query,
  selectedHotelId
}: GetHotelsCommissionDirectoryInput): Promise<HotelsCommissionDirectoryData> {
  const supabase = createSupabaseServerClient();
  const normalizedQuery = toOptionalText(query) ?? "";

  let hotelsStatement = supabase
    .from("profiles")
    .select("id,full_name,username,profile_photo_url,business_name,created_at")
    .eq("account_type", "hotel")
    .order("created_at", { ascending: false });

  if (normalizedQuery) {
    const token = sanitizeSearchQuery(normalizedQuery);

    if (isUUID(token)) {
      hotelsStatement = hotelsStatement.eq("id", token);
    } else {
      hotelsStatement = hotelsStatement.or(`full_name.ilike.%${token}%,username.ilike.%${token}%,business_name.ilike.%${token}%`);
    }
  }

  const { data: hotelProfilesResult, error: hotelProfilesError } = await hotelsStatement;

  if (hotelProfilesError) {
    throw new Error(hotelProfilesError.message);
  }

  const hotelProfiles = (hotelProfilesResult ?? []) as HotelProfileRow[];

  if (!hotelProfiles.length) {
    return {
      query: normalizedQuery,
      hotels: [],
      selectedHotelId: null,
      selectedHotel: null,
      default_standard_commission_pct: DEFAULT_STANDARD_COMMISSION_PCT
    };
  }

  const hotelIds = hotelProfiles.map((row) => row.id);

  const [platformSettingsResult, hotelBusinessResult, splitSettingsResult, partnerCountsResult] = await Promise.all([
    supabase.from("platform_commission_settings").select("k_hotel").eq("id", 1).maybeSingle(),
    supabase.from("business_details").select("user_id,business_name,hotel_display_name,email").in("user_id", hotelIds),
    supabase.from("hotel_commission_split_settings").select("hotel_id,k_hotel").in("hotel_id", hotelIds),
    supabase.rpc("get_hotels_partner_counts", { p_hotel_ids: hotelIds })
  ]);

  if (platformSettingsResult.error && !isRecoverableReadError(platformSettingsResult.error)) {
    throw new Error(platformSettingsResult.error.message);
  }

  if (hotelBusinessResult.error && !isRecoverableReadError(hotelBusinessResult.error)) {
    throw new Error(hotelBusinessResult.error.message);
  }

  if (splitSettingsResult.error && !isRecoverableReadError(splitSettingsResult.error)) {
    throw new Error(splitSettingsResult.error.message);
  }

  const shouldFallbackPartnerCounts = Boolean(
    partnerCountsResult.error && (isRecoverableReadError(partnerCountsResult.error) || isMissingRpcFunctionError(partnerCountsResult.error))
  );

  if (partnerCountsResult.error && !shouldFallbackPartnerCounts) {
    throw new Error(partnerCountsResult.error.message);
  }

  const globalKHotel = normalizeK(
    (platformSettingsResult.data as { k_hotel?: number | null } | null)?.k_hotel,
    DEFAULT_K_HOTEL
  );

  const hotelBusinessRows = (hotelBusinessResult.data ?? []) as HotelBusinessDetailRow[];
  const splitSettingRows = (splitSettingsResult.data ?? []) as HotelSplitSettingRow[];
  const partnerCountRows = ((partnerCountsResult.data ?? []) as RpcHotelPartnerCountRow[]);

  const hotelBusinessById = new Map(hotelBusinessRows.map((row) => [row.user_id, row]));
  const splitByHotelId = new Map(splitSettingRows.map((row) => [row.hotel_id, normalizeK(row.k_hotel, globalKHotel)]));

  const partnerCountsByHotelId = new Map(
    partnerCountRows
      .filter((row): row is RpcHotelPartnerCountRow => Boolean(row.hotel_id))
      .map((row) => [row.hotel_id, Math.max(0, Math.trunc(toNumber(row.partners_count, 0)))])
  );

  if (shouldFallbackPartnerCounts) {
    const legacyCounts = await getLegacyPartnerCountsByHotelId(hotelIds);
    legacyCounts.forEach((value, key) => {
      partnerCountsByHotelId.set(key, value);
    });
  }

  const hotels: HotelDirectoryRow[] = hotelProfiles
    .map((profile) => {
      const business = hotelBusinessById.get(profile.id) ?? null;
      const kHotel = splitByHotelId.get(profile.id) ?? globalKHotel;

      return {
        id: profile.id,
        name: resolveHotelName(profile, business),
        email: toOptionalText(business?.email) ?? toOptionalText(profile.username),
        username: toOptionalText(profile.username),
        profile_photo_url: toOptionalText(profile.profile_photo_url),
        k_hotel: roundTwo(kHotel),
        k_hotel_pct: roundTwo(kHotel * 100),
        partners_count: partnerCountsByHotelId.get(profile.id) ?? 0,
        created_at: profile.created_at
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const selectedId = selectedHotelId && hotels.some((hotelRow) => hotelRow.id === selectedHotelId)
    ? selectedHotelId
    : hotels[0]?.id ?? null;

  let selectedHotel: HotelDirectoryDetail | null = null;

  if (selectedId) {
    const selectedSummary = hotels.find((hotelRow) => hotelRow.id === selectedId) ?? null;

    const partnerRpcResult = await supabase.rpc("get_hotel_partner_companies_with_commissions", {
      p_hotel_id: selectedId
    });

    const shouldFallbackPartners = Boolean(
      partnerRpcResult.error && (isRecoverableReadError(partnerRpcResult.error) || isMissingRpcFunctionError(partnerRpcResult.error))
    );

    if (partnerRpcResult.error && !shouldFallbackPartners) {
      throw new Error(partnerRpcResult.error.message);
    }

    const rpcRows = (partnerRpcResult.data ?? []) as RpcHotelPartnerRow[];

    const partnersFromRpc = rpcRows.map((row) => {
      const companyId = String(row.company_id ?? "");
      const companyName = toOptionalText(row.company_name) ?? companyId;
      const cePStandard = normalizePercentage(row.ce_p_standard_pct, DEFAULT_STANDARD_COMMISSION_PCT);
      const cePEffective = normalizePercentage(row.ce_p_effective_pct, cePStandard);
      const cePOverrideValue = row.ce_p_override_pct;
      const cePOverride = cePOverrideValue === null || cePOverrideValue === undefined
        ? null
        : roundTwo(normalizePercentage(cePOverrideValue, cePEffective));

      return {
        company_id: companyId,
        company_name: companyName,
        company_email: toOptionalText(row.company_email),
        ce_p_standard_pct: roundTwo(cePStandard),
        ce_p_effective_pct: roundTwo(cePEffective),
        ce_p_override_pct: cePOverride,
        has_custom_ce_p: Boolean(row.has_custom_ce_p)
      } satisfies HotelPartnerCommissionDetailRow;
    });

    const partners = shouldFallbackPartners
      ? await getLegacyPartnersForHotel(selectedId)
      : sortPartners(partnersFromRpc);

    if (selectedSummary) {
      selectedHotel = {
        ...selectedSummary,
        partners_count: partners.length,
        standard_ce_p_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT),
        standard_hotel_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT * selectedSummary.k_hotel),
        standard_attendi_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT * (1 - selectedSummary.k_hotel)),
        partners
      };
    }
  }

  return {
    query: normalizedQuery,
    hotels,
    selectedHotelId: selectedId,
    selectedHotel,
    default_standard_commission_pct: DEFAULT_STANDARD_COMMISSION_PCT
  };
}
