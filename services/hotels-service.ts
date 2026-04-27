import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingColumnError, isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";

interface GetHotelsCommissionDirectoryInput {
  query?: string;
  selectedHotelId?: string;
  selectedLocationId?: string;
}

interface HotelProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
  business_name: string | null;
  created_at: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  stripe_account_id: string | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  stripe_transfers_enabled: boolean | null;
}

interface HotelBusinessDetailRow {
  user_id: string;
  business_name: string | null;
  hotel_display_name: string | null;
  email: string | null;
  precise_location: string | null;
  city: string | null;
  hotel_public_address: string | null;
  hotel_public_email: string | null;
  hotel_public_phone: string | null;
  hotel_header_image_url: string | null;
  hotel_brand_color: string | null;
  hotel_recommended_filters: unknown;
  hotel_show_own_catalog: boolean | null;
  show_public_location: boolean | null;
  show_public_email: boolean | null;
}

interface HotelLocationRow {
  id: string;
  owner_user_id: string;
  display_name: string | null;
  public_address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  public_email: string | null;
  public_phone: string | null;
  header_image_url: string | null;
  brand_color: string | null;
  show_public_location: boolean | null;
  show_public_email: boolean | null;
  recommended_filters: unknown;
  show_own_catalog: boolean | null;
  is_primary: boolean | null;
  active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface HotelSplitSettingRow {
  hotel_id: string;
  hotel_location_id: string | null;
  k_hotel: number | string | null;
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
  comision_propietario: number | string | null;
}

interface LegacyPartnerBusinessRow {
  user_id: string;
  business_name: string | null;
  email: string | null;
  company_type: string | null;
}

interface LegacyOverrideRow {
  id: number;
  company_id: string;
  ce_p_pct: number | string | null;
  k_hotel: number | string | null;
  hotel_location_id: string | null;
}

interface ProductPartnerCandidateRow {
  user_id: string | null;
  category: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
}

interface RecommendedFilters {
  max_distance_km: number;
  excluded_company_ids: Set<string>;
  categories: Set<string>;
  company_types: Set<string>;
}

export interface HotelDirectoryRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  profile_photo_url: string | null;
  created_at: string | null;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  stripe_transfers_enabled: boolean;
  locations_count: number;
  active_locations_count: number;
  primary_location_name: string | null;
  k_hotel: number;
  k_hotel_pct: number;
}

export interface HotelLocationSummary {
  id: string | null;
  location_key: string;
  owner_user_id: string;
  name: string;
  address: string | null;
  public_email: string | null;
  public_phone: string | null;
  header_image_url: string | null;
  brand_color: string | null;
  latitude: number | null;
  longitude: number | null;
  show_public_location: boolean;
  show_public_email: boolean;
  show_own_catalog: boolean;
  is_primary: boolean;
  active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  recommended_filters: unknown;
  k_hotel: number;
  k_hotel_pct: number;
}

export interface HotelPartnerCommissionDetailRow {
  company_id: string;
  company_name: string;
  company_email: string | null;
  ce_p_standard_pct: number;
  ce_p_effective_pct: number;
  ce_p_override_pct: number | null;
  has_custom_ce_p: boolean;
  k_hotel: number;
  k_hotel_pct: number;
  has_custom_k_hotel: boolean;
  visible_products_count: number | null;
}

export interface HotelLocationDetail extends HotelLocationSummary {
  standard_ce_p_pct: number;
  standard_hotel_pct: number;
  standard_attendi_pct: number;
  partners: HotelPartnerCommissionDetailRow[];
}

export interface HotelDirectoryDetail extends HotelDirectoryRow {
  locations: HotelLocationSummary[];
  selectedLocation: HotelLocationDetail | null;
}

export interface HotelsCommissionDirectoryData {
  query: string;
  hotels: HotelDirectoryRow[];
  selectedHotelId: string | null;
  selectedLocationId: string | null;
  selectedHotel: HotelDirectoryDetail | null;
  default_standard_commission_pct: number;
  totals: {
    hotel_accounts: number;
    hotel_locations: number;
    active_locations: number;
    connected_stripe_accounts: number;
  };
}

const DEFAULT_K_HOTEL = 0.4;
const DEFAULT_STANDARD_COMMISSION_PCT = 12.5;
const DEFAULT_MAX_DISTANCE_KM = 50;
const FALLBACK_LOCATION_KEY = "profile";

const HOTEL_PROFILE_SELECT = [
  "id",
  "full_name",
  "username",
  "profile_photo_url",
  "business_name",
  "created_at",
  "latitude",
  "longitude",
  "stripe_account_id",
  "charges_enabled",
  "payouts_enabled",
  "stripe_transfers_enabled"
].join(",");

const HOTEL_BUSINESS_SELECT = [
  "user_id",
  "business_name",
  "hotel_display_name",
  "email",
  "precise_location",
  "city",
  "hotel_public_address",
  "hotel_public_email",
  "hotel_public_phone",
  "hotel_header_image_url",
  "hotel_brand_color",
  "hotel_recommended_filters",
  "hotel_show_own_catalog",
  "show_public_location",
  "show_public_email"
].join(",");

const HOTEL_LOCATION_SELECT = [
  "id",
  "owner_user_id",
  "display_name",
  "public_address",
  "latitude",
  "longitude",
  "public_email",
  "public_phone",
  "header_image_url",
  "brand_color",
  "show_public_location",
  "show_public_email",
  "recommended_filters",
  "show_own_catalog",
  "is_primary",
  "active",
  "sort_order",
  "created_at",
  "updated_at"
].join(",");

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

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function getLocationKey(locationId: string | null | undefined) {
  return toOptionalText(locationId) ?? FALLBACK_LOCATION_KEY;
}

function getLocationIdFromKey(locationKey: string | null | undefined) {
  const normalized = toOptionalText(locationKey);
  return normalized && normalized !== FALLBACK_LOCATION_KEY ? normalized : null;
}

function dedupe(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => toOptionalText(entry)).filter((entry): entry is string => Boolean(entry));
  }

  const scalar = toOptionalText(value);
  return scalar ? [scalar] : [];
}

function getStringSetFromObject(source: Record<string, unknown>, keys: string[]) {
  const values = keys.flatMap((key) => getStringArray(source[key]));
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function parseRecommendedFilters(value: unknown): RecommendedFilters {
  const source = getJsonObject(value);
  const maxDistance = toNumber(source.max_distance_km ?? source.maxDistanceKm, DEFAULT_MAX_DISTANCE_KM);

  return {
    max_distance_km: Math.max(0, maxDistance),
    excluded_company_ids: getStringSetFromObject(source, ["excluded_company_ids", "excludedCompanyIds"]),
    categories: getStringSetFromObject(source, ["categories", "category_names", "categoryNames", "allowed_categories", "allowedCategories"]),
    company_types: getStringSetFromObject(source, ["company_types", "companyTypes", "allowed_company_types", "allowedCompanyTypes"])
  };
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

function resolveFallbackLocationName(profile: HotelProfileRow, business: HotelBusinessDetailRow | null) {
  return (
    toOptionalText(business?.hotel_display_name) ??
    toOptionalText(business?.business_name) ??
    toOptionalText(profile.business_name) ??
    "Perfil principal"
  );
}

function resolveLocationAddress(business: HotelBusinessDetailRow | null) {
  return (
    toOptionalText(business?.hotel_public_address) ??
    toOptionalText(business?.precise_location) ??
    toOptionalText(business?.city)
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

function sortLocations(rows: HotelLocationSummary[]) {
  return [...rows].sort((left, right) => {
    const primaryDelta = Number(right.is_primary) - Number(left.is_primary);
    if (primaryDelta !== 0) {
      return primaryDelta;
    }

    const activeDelta = Number(right.active) - Number(left.active);
    if (activeDelta !== 0) {
      return activeDelta;
    }

    const orderDelta = left.sort_order - right.sort_order;
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

function getDistanceKm(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusKm = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((latA * Math.PI) / 180) *
      Math.cos((latB * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBounds(latitude: number, longitude: number, maxDistanceKm: number) {
  const latDelta = maxDistanceKm / 111;
  const lngDelta = maxDistanceKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta
  };
}

function getKHotelForLocation(
  hotelId: string,
  locationId: string | null,
  splitRows: HotelSplitSettingRow[],
  globalKHotel: number
) {
  const locationSpecific = locationId
    ? splitRows.find((row) => row.hotel_id === hotelId && row.hotel_location_id === locationId)
    : null;

  const accountLevel = splitRows.find((row) => row.hotel_id === hotelId && !row.hotel_location_id);
  return normalizeK(locationSpecific?.k_hotel ?? accountLevel?.k_hotel, globalKHotel);
}

function chooseOverride(
  overrides: LegacyOverrideRow[],
  companyId: string,
  locationId: string | null
) {
  const companyOverrides = overrides.filter((row) => row.company_id === companyId);

  return (
    (locationId ? companyOverrides.find((row) => row.hotel_location_id === locationId) : undefined) ??
    companyOverrides.find((row) => !row.hotel_location_id) ??
    companyOverrides[0] ??
    null
  );
}

async function getMatchingLocationOwnerIds(token: string) {
  const supabase = createSupabaseServerClient();

  const query = isUUID(token)
    ? supabase.from("hotel_locations").select("owner_user_id").eq("id", token)
    : supabase
        .from("hotel_locations")
        .select("owner_user_id")
        .or(`display_name.ilike.%${token}%,public_address.ilike.%${token}%,public_email.ilike.%${token}%,public_phone.ilike.%${token}%`);

  const { data, error } = await query;

  if (error) {
    if (isRecoverableReadError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return dedupe((data ?? []).map((row) => (row as { owner_user_id?: string }).owner_user_id));
}

async function getMatchingBusinessHotelIds(token: string) {
  const supabase = createSupabaseServerClient();

  const query = isUUID(token)
    ? supabase.from("business_details").select("user_id").eq("user_id", token)
    : supabase
        .from("business_details")
        .select("user_id")
        .or(`business_name.ilike.%${token}%,hotel_display_name.ilike.%${token}%,email.ilike.%${token}%,hotel_public_address.ilike.%${token}%`);

  const { data, error } = await query;

  if (error) {
    if (isRecoverableReadError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return dedupe((data ?? []).map((row) => (row as { user_id?: string }).user_id));
}

async function fetchHotelProfiles(normalizedQuery: string) {
  const supabase = createSupabaseServerClient();
  const token = sanitizeSearchQuery(normalizedQuery);

  if (!token) {
    const { data, error } = await supabase
      .from("profiles")
      .select(HOTEL_PROFILE_SELECT)
      .eq("account_type", "hotel")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as unknown as HotelProfileRow[];
  }

  const [locationOwnerIds, businessHotelIds] = await Promise.all([
    getMatchingLocationOwnerIds(token),
    getMatchingBusinessHotelIds(token)
  ]);

  const directIds = isUUID(token) ? [token] : [];
  const matchingIds = dedupe([...directIds, ...locationOwnerIds, ...businessHotelIds]);

  if (isUUID(token)) {
    if (!matchingIds.length) {
      return [];
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(HOTEL_PROFILE_SELECT)
      .eq("account_type", "hotel")
      .in("id", matchingIds);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as unknown as HotelProfileRow[];
  }

  const { data: profileMatches, error: profileMatchesError } = await supabase
    .from("profiles")
    .select(HOTEL_PROFILE_SELECT)
    .eq("account_type", "hotel")
    .or(`full_name.ilike.%${token}%,username.ilike.%${token}%,business_name.ilike.%${token}%`);

  if (profileMatchesError) {
    throw new Error(profileMatchesError.message);
  }

  let idMatches: HotelProfileRow[] = [];

  if (matchingIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select(HOTEL_PROFILE_SELECT)
      .eq("account_type", "hotel")
      .in("id", matchingIds);

    if (error) {
      throw new Error(error.message);
    }

    idMatches = (data ?? []) as unknown as HotelProfileRow[];
  }

  return Array.from(
    new Map([...(profileMatches ?? []), ...idMatches].map((row) => [(row as HotelProfileRow).id, row as HotelProfileRow])).values()
  );
}

function createFallbackLocation(
  profile: HotelProfileRow,
  business: HotelBusinessDetailRow | null,
  kHotel: number
): HotelLocationSummary {
  return {
    id: null,
    location_key: FALLBACK_LOCATION_KEY,
    owner_user_id: profile.id,
    name: resolveFallbackLocationName(profile, business),
    address: resolveLocationAddress(business),
    public_email: toOptionalText(business?.hotel_public_email) ?? toOptionalText(business?.email),
    public_phone: toOptionalText(business?.hotel_public_phone),
    header_image_url: toOptionalText(business?.hotel_header_image_url) ?? toOptionalText(profile.profile_photo_url),
    brand_color: toOptionalText(business?.hotel_brand_color),
    latitude: toNullableNumber(profile.latitude),
    longitude: toNullableNumber(profile.longitude),
    show_public_location: toBoolean(business?.show_public_location, true),
    show_public_email: toBoolean(business?.show_public_email, false),
    show_own_catalog: toBoolean(business?.hotel_show_own_catalog, false),
    is_primary: true,
    active: true,
    sort_order: 0,
    created_at: profile.created_at,
    updated_at: null,
    recommended_filters: business?.hotel_recommended_filters ?? {},
    k_hotel: roundTwo(kHotel),
    k_hotel_pct: roundTwo(kHotel * 100)
  };
}

function createLocationSummary(
  row: HotelLocationRow,
  profile: HotelProfileRow,
  business: HotelBusinessDetailRow | null,
  kHotel: number
): HotelLocationSummary {
  const name =
    toOptionalText(row.display_name) ??
    toOptionalText(business?.hotel_display_name) ??
    toOptionalText(business?.business_name) ??
    toOptionalText(profile.business_name) ??
    "Localización";

  return {
    id: row.id,
    location_key: getLocationKey(row.id),
    owner_user_id: row.owner_user_id,
    name,
    address: toOptionalText(row.public_address) ?? resolveLocationAddress(business),
    public_email: toOptionalText(row.public_email) ?? toOptionalText(business?.hotel_public_email) ?? toOptionalText(business?.email),
    public_phone: toOptionalText(row.public_phone) ?? toOptionalText(business?.hotel_public_phone),
    header_image_url: toOptionalText(row.header_image_url) ?? toOptionalText(business?.hotel_header_image_url) ?? toOptionalText(profile.profile_photo_url),
    brand_color: toOptionalText(row.brand_color) ?? toOptionalText(business?.hotel_brand_color),
    latitude: toNullableNumber(row.latitude) ?? toNullableNumber(profile.latitude),
    longitude: toNullableNumber(row.longitude) ?? toNullableNumber(profile.longitude),
    show_public_location: toBoolean(row.show_public_location, true),
    show_public_email: toBoolean(row.show_public_email, false),
    show_own_catalog: toBoolean(row.show_own_catalog, false),
    is_primary: toBoolean(row.is_primary, false),
    active: toBoolean(row.active, true),
    sort_order: Math.trunc(toNumber(row.sort_order, 0)),
    created_at: row.created_at,
    updated_at: row.updated_at,
    recommended_filters: row.recommended_filters ?? business?.hotel_recommended_filters ?? {},
    k_hotel: roundTwo(kHotel),
    k_hotel_pct: roundTwo(kHotel * 100)
  };
}

async function getCompanyRowsForPartners(
  hotelId: string,
  locationId: string | null,
  companyIds: string[],
  visibleProductCounts: Map<string, number>,
  allowedCompanyTypes: Set<string>,
  defaultKHotel: number
) {
  if (!companyIds.length) {
    return [];
  }

  const supabase = createSupabaseServerClient();

  const [profilesResult, businessResult, overridesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,username,business_name,account_type,comision_propietario")
      .in("id", companyIds),
    supabase
      .from("business_details")
      .select("user_id,business_name,email,company_type")
      .in("user_id", companyIds),
    supabase
      .from("hotel_company_commission_overrides")
      .select("id,company_id,ce_p_pct,k_hotel,hotel_location_id")
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

  let overridesData: unknown[] | null = overridesResult.data as unknown[] | null;
  if (isMissingColumnError(overridesResult.error)) {
    const fallbackOverridesResult = await supabase
      .from("hotel_company_commission_overrides")
      .select("id,company_id,ce_p_pct,hotel_location_id")
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .in("company_id", companyIds);

    if (fallbackOverridesResult.error && !isRecoverableReadError(fallbackOverridesResult.error)) {
      throw new Error(fallbackOverridesResult.error.message);
    }

    overridesData = fallbackOverridesResult.data as unknown[] | null;
  } else if (overridesResult.error && !isRecoverableReadError(overridesResult.error)) {
    throw new Error(overridesResult.error.message);
  }

  const profiles = (profilesResult.data ?? []) as LegacyPartnerProfileRow[];
  const businesses = (businessResult.data ?? []) as LegacyPartnerBusinessRow[];
  const overrides = (overridesData ?? []) as LegacyOverrideRow[];

  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const businessById = new Map(businesses.map((row) => [row.user_id, row]));
  const rows: HotelPartnerCommissionDetailRow[] = [];

  companyIds.forEach((companyId) => {
    const profile = profileById.get(companyId);

    if (toOptionalText(profile?.account_type) !== "business") {
      return;
    }

    const business = businessById.get(companyId) ?? null;
    const companyType = toOptionalText(business?.company_type);

    if (allowedCompanyTypes.size && (!companyType || !allowedCompanyTypes.has(companyType))) {
      return;
    }

    const standard = normalizePercentage(profile?.comision_propietario, DEFAULT_STANDARD_COMMISSION_PCT);
    const override = chooseOverride(overrides, companyId, locationId);
    const overridePct = override ? normalizePercentage(override.ce_p_pct, standard) : null;
    const overrideKHotel = override?.k_hotel === null || override?.k_hotel === undefined
      ? null
      : normalizeK(override.k_hotel, defaultKHotel);
    const kHotel = overrideKHotel ?? defaultKHotel;

    rows.push({
      company_id: companyId,
      company_name: resolveCompanyName(profile, business, companyId),
      company_email: toOptionalText(business?.email) ?? toOptionalText(profile?.username),
      ce_p_standard_pct: roundTwo(standard),
      ce_p_effective_pct: roundTwo(overridePct ?? standard),
      ce_p_override_pct: overridePct === null ? null : roundTwo(overridePct),
      has_custom_ce_p: overridePct !== null,
      k_hotel: roundTwo(kHotel),
      k_hotel_pct: roundTwo(kHotel * 100),
      has_custom_k_hotel: overrideKHotel !== null,
      visible_products_count: visibleProductCounts.get(companyId) ?? null
    });
  });

  return sortPartners(rows);
}

async function getLegacyPartnersForHotel(
  hotelId: string,
  locationId: string | null,
  defaultKHotel: number
): Promise<HotelPartnerCommissionDetailRow[]> {
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

  const companyIds = dedupe(((linksData ?? []) as LegacyPartnerLinkRow[]).map((row) => row.company_user_id));
  return getCompanyRowsForPartners(hotelId, locationId, companyIds, new Map(), new Set(), defaultKHotel);
}

async function getPartnersForLocation(
  hotelId: string,
  location: HotelLocationSummary
): Promise<HotelPartnerCommissionDetailRow[]> {
  const locationId = getLocationIdFromKey(location.location_key);
  const filters = parseRecommendedFilters(location.recommended_filters);

  if (location.latitude === null || location.longitude === null) {
    return getLegacyPartnersForHotel(hotelId, locationId, location.k_hotel);
  }

  const supabase = createSupabaseServerClient();
  const bounds = getBounds(location.latitude, location.longitude, filters.max_distance_km);
  let statement = supabase
    .from("products")
    .select("user_id,category,location_lat,location_lng")
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .not("user_id", "is", null)
    .not("location_lat", "is", null)
    .not("location_lng", "is", null)
    .neq("user_id", hotelId)
    .gte("location_lat", bounds.minLat)
    .lte("location_lat", bounds.maxLat)
    .gte("location_lng", bounds.minLng)
    .lte("location_lng", bounds.maxLng)
    .limit(5000);

  if (filters.categories.size) {
    statement = statement.in("category", Array.from(filters.categories));
  }

  const { data, error } = await statement;

  if (error) {
    if (isRecoverableReadError(error)) {
      return getLegacyPartnersForHotel(hotelId, locationId, location.k_hotel);
    }

    throw new Error(error.message);
  }

  const visibleProductCounts = new Map<string, number>();

  ((data ?? []) as ProductPartnerCandidateRow[]).forEach((row) => {
    const companyId = toOptionalText(row.user_id);
    const productLat = toNullableNumber(row.location_lat);
    const productLng = toNullableNumber(row.location_lng);

    if (!companyId || productLat === null || productLng === null || filters.excluded_company_ids.has(companyId)) {
      return;
    }

    if (getDistanceKm(location.latitude as number, location.longitude as number, productLat, productLng) > filters.max_distance_km) {
      return;
    }

    visibleProductCounts.set(companyId, (visibleProductCounts.get(companyId) ?? 0) + 1);
  });

  return getCompanyRowsForPartners(
    hotelId,
    locationId,
    Array.from(visibleProductCounts.keys()),
    visibleProductCounts,
    filters.company_types,
    location.k_hotel
  );
}

export async function getHotelsCommissionDirectory({
  query,
  selectedHotelId,
  selectedLocationId
}: GetHotelsCommissionDirectoryInput): Promise<HotelsCommissionDirectoryData> {
  const supabase = createSupabaseServerClient();
  const normalizedQuery = toOptionalText(query) ?? "";
  const hotelProfiles = await fetchHotelProfiles(normalizedQuery);

  if (!hotelProfiles.length) {
    return {
      query: normalizedQuery,
      hotels: [],
      selectedHotelId: null,
      selectedLocationId: null,
      selectedHotel: null,
      default_standard_commission_pct: DEFAULT_STANDARD_COMMISSION_PCT,
      totals: {
        hotel_accounts: 0,
        hotel_locations: 0,
        active_locations: 0,
        connected_stripe_accounts: 0
      }
    };
  }

  const hotelIds = hotelProfiles.map((row) => row.id);

  const [platformSettingsResult, hotelBusinessResult, splitSettingsResult, locationsResult] = await Promise.all([
    supabase.from("platform_commission_settings").select("k_hotel").eq("id", 1).maybeSingle(),
    supabase.from("business_details").select(HOTEL_BUSINESS_SELECT).in("user_id", hotelIds),
    supabase.from("hotel_commission_split_settings").select("hotel_id,hotel_location_id,k_hotel").in("hotel_id", hotelIds),
    supabase.from("hotel_locations").select(HOTEL_LOCATION_SELECT).in("owner_user_id", hotelIds)
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

  if (locationsResult.error && !isRecoverableReadError(locationsResult.error)) {
    throw new Error(locationsResult.error.message);
  }

  const globalKHotel = normalizeK(
    (platformSettingsResult.data as { k_hotel?: number | string | null } | null)?.k_hotel,
    DEFAULT_K_HOTEL
  );

  const hotelBusinessRows = (hotelBusinessResult.data ?? []) as unknown as HotelBusinessDetailRow[];
  const splitRows = (splitSettingsResult.data ?? []) as unknown as HotelSplitSettingRow[];
  const locationRows = (locationsResult.data ?? []) as unknown as HotelLocationRow[];
  const hotelBusinessById = new Map(hotelBusinessRows.map((row) => [row.user_id, row]));
  const locationRowsByHotelId = new Map<string, HotelLocationRow[]>();

  locationRows.forEach((row) => {
    const current = locationRowsByHotelId.get(row.owner_user_id) ?? [];
    current.push(row);
    locationRowsByHotelId.set(row.owner_user_id, current);
  });

  const locationsByHotelId = new Map<string, HotelLocationSummary[]>();

  hotelProfiles.forEach((profile) => {
    const business = hotelBusinessById.get(profile.id) ?? null;
    const rows = locationRowsByHotelId.get(profile.id) ?? [];
    const locations = rows.length
      ? rows.map((row) => createLocationSummary(
          row,
          profile,
          business,
          getKHotelForLocation(profile.id, row.id, splitRows, globalKHotel)
        ))
      : [createFallbackLocation(profile, business, getKHotelForLocation(profile.id, null, splitRows, globalKHotel))];

    locationsByHotelId.set(profile.id, sortLocations(locations));
  });

  const hotels: HotelDirectoryRow[] = hotelProfiles
    .map((profile) => {
      const business = hotelBusinessById.get(profile.id) ?? null;
      const locations = locationsByHotelId.get(profile.id) ?? [];
      const primaryLocation = locations.find((location) => location.is_primary) ?? locations[0] ?? null;
      const activeLocationsCount = locations.filter((location) => location.active).length;

      return {
        id: profile.id,
        name: resolveHotelName(profile, business),
        email: toOptionalText(business?.email) ?? toOptionalText(profile.username),
        username: toOptionalText(profile.username),
        profile_photo_url: toOptionalText(profile.profile_photo_url),
        created_at: profile.created_at,
        stripe_account_id: toOptionalText(profile.stripe_account_id),
        charges_enabled: toBoolean(profile.charges_enabled, false),
        payouts_enabled: toBoolean(profile.payouts_enabled, false),
        stripe_transfers_enabled: toBoolean(profile.stripe_transfers_enabled, false),
        locations_count: locations.length,
        active_locations_count: activeLocationsCount,
        primary_location_name: primaryLocation?.name ?? null,
        k_hotel: primaryLocation?.k_hotel ?? roundTwo(globalKHotel),
        k_hotel_pct: primaryLocation?.k_hotel_pct ?? roundTwo(globalKHotel * 100)
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const selectedId = selectedHotelId && hotels.some((hotelRow) => hotelRow.id === selectedHotelId)
    ? selectedHotelId
    : hotels[0]?.id ?? null;

  let selectedHotel: HotelDirectoryDetail | null = null;
  let resolvedSelectedLocationId: string | null = null;

  if (selectedId) {
    const selectedSummary = hotels.find((hotelRow) => hotelRow.id === selectedId) ?? null;
    const locations = locationsByHotelId.get(selectedId) ?? [];
    const requestedLocationId = getLocationIdFromKey(selectedLocationId);
    const selectedLocation =
      (requestedLocationId ? locations.find((location) => location.id === requestedLocationId) : null) ??
      (selectedLocationId === FALLBACK_LOCATION_KEY ? locations.find((location) => location.location_key === FALLBACK_LOCATION_KEY) : null) ??
      locations.find((location) => location.is_primary && location.active) ??
      locations.find((location) => location.active) ??
      locations[0] ??
      null;

    if (selectedLocation && selectedSummary) {
      const partners = await getPartnersForLocation(selectedId, selectedLocation);
      resolvedSelectedLocationId = selectedLocation.location_key;

      selectedHotel = {
        ...selectedSummary,
        locations,
        selectedLocation: {
          ...selectedLocation,
          standard_ce_p_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT),
          standard_hotel_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT * selectedLocation.k_hotel),
          standard_attendi_pct: roundTwo(DEFAULT_STANDARD_COMMISSION_PCT * (1 - selectedLocation.k_hotel)),
          partners
        }
      };
    } else if (selectedSummary) {
      selectedHotel = {
        ...selectedSummary,
        locations,
        selectedLocation: null
      };
    }
  }

  const allLocations = Array.from(locationsByHotelId.values()).flat();

  return {
    query: normalizedQuery,
    hotels,
    selectedHotelId: selectedId,
    selectedLocationId: resolvedSelectedLocationId,
    selectedHotel,
    default_standard_commission_pct: DEFAULT_STANDARD_COMMISSION_PCT,
    totals: {
      hotel_accounts: hotels.length,
      hotel_locations: allLocations.length,
      active_locations: allLocations.filter((location) => location.active).length,
      connected_stripe_accounts: hotels.filter((hotel) => Boolean(hotel.stripe_account_id)).length
    }
  };
}
