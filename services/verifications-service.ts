import {
  getRequestLastActivityDate,
  isRealPendingVerificationRequest,
  mapVerificationSourceBucket,
  matchesVerificationSourceFilter,
  normalizeVerificationSource,
  parseVerificationPayload,
  type ParsedVerificationPayload,
  type VerificationSourceFilter
} from "@/lib/verification-requests";
import { isUUID } from "@/lib/utils";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getEmailMapByUserIds, getProfilesMap, type ProfileIdentity } from "@/services/profile-helpers";
import type { VerificationRequestPayload, VerificationRequestRow, VerificationStatus } from "@/types";

const DEFAULT_PAGE_SIZE = 20;
const REQUEST_SOURCE_FILTERS: VerificationSourceFilter[] = [
  "all",
  "settings_upgrade",
  "settings_verified_update",
  "register",
  "other"
];
const REQUEST_STATUSES = ["pending", "approved", "rejected", "needs_changes", "not_required"] as const;

interface ListVerificationsInput {
  query?: string;
  accountType?: string;
  verificationStatus?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

interface VerificationRequestDetail extends VerificationRequestRow {
  country_code: string | null;
  created_at: string | null;
  parsed_payload: ParsedVerificationPayload;
  last_activity_at: string | null;
}

export interface VerificationRequestDetailResult {
  request: VerificationRequestDetail;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    login_email: string | null;
    account_type: string | null;
    verification_status: string | null;
    can_publish: boolean | null;
  } | null;
  businessDetailsCurrent: Record<string, unknown> | null;
  documents: Array<Record<string, unknown>>;
  notes: Awaited<ReturnType<typeof getAdminNotes>>;
  flags: Awaited<ReturnType<typeof getAdminFlags>>;
}

interface VerificationListViewRow {
  request_id: string;
  user_id: string;
  full_name: string | null;
  profile_username: string | null;
  current_account_type: string | null;
  business_details_email: string | null;
  request_status: string;
  target_account_type: "business" | "hotel";
  legal_name: string;
  tax_id: string;
  company_email: string | null;
  company_phone: string | null;
  payload: VerificationRequestPayload | null;
  request_source_normalized: string | null;
  request_kind: string | null;
  submitted_at: string | null;
  last_submitted_at: string | null;
  last_admin_email_sent_at: string | null;
  last_email_action: string | null;
  reminder_count: number | null;
  updated_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  review_notes: string | null;
  admin_notes: string | null;
  rejected_reason: string | null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

function normalizeSourceFilter(source?: string): VerificationSourceFilter {
  const normalized = String(source ?? "all").toLowerCase();

  if (REQUEST_SOURCE_FILTERS.includes(normalized as VerificationSourceFilter)) {
    return normalized as VerificationSourceFilter;
  }

  return "all";
}

function normalizeStatusFilter(status?: string) {
  const normalized = String(status ?? "").toLowerCase();

  if (!normalized) {
    return null;
  }

  if (REQUEST_STATUSES.includes(normalized as (typeof REQUEST_STATUSES)[number])) {
    return normalized;
  }

  return null;
}

function normalizeAccountTypeFilter(accountType?: string) {
  const normalized = String(accountType ?? "").toLowerCase();
  if (normalized === "business" || normalized === "hotel") {
    return normalized;
  }

  return null;
}

function normalizePage(value?: number) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function normalizePageSize(value?: number) {
  const size = Number(value ?? DEFAULT_PAGE_SIZE);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_PAGE_SIZE;
}

function toDateStartISO(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toDateEndISO(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function mapViewRowToVerificationRow(row: VerificationListViewRow, loginEmail: string | null): VerificationRequestRow {
  const payload = toObject(row.payload) as VerificationRequestPayload;
  const parsedPayload = parseVerificationPayload(payload);
  const reviewNotes = toOptionalString(row.review_notes) ?? toOptionalString(row.review_note);
  const source = normalizeVerificationSource(row.request_source_normalized ?? parsedPayload.source);

  return {
    id: row.request_id,
    user_id: row.user_id,
    user_full_name: row.full_name,
    user_username: row.profile_username,
    login_email: loginEmail ?? row.profile_username ?? row.business_details_email ?? null,
    current_account_type: row.current_account_type,
    requested_account_type: row.target_account_type,
    legal_name: row.legal_name,
    tax_id: row.tax_id,
    company_email: row.company_email,
    company_phone: row.company_phone,
    payload,
    source,
    request_kind: toOptionalString(row.request_kind) ?? parsedPayload.request_kind,
    status: row.request_status as VerificationStatus,
    submitted_at: row.submitted_at,
    last_submitted_at: row.last_submitted_at,
    last_admin_email_sent_at: row.last_admin_email_sent_at,
    last_email_action: row.last_email_action,
    reminder_count: toOptionalNumber(row.reminder_count) ?? 0,
    updated_at: row.updated_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    review_note: toOptionalString(row.review_note) ?? reviewNotes,
    review_notes: reviewNotes,
    admin_notes: row.admin_notes,
    rejected_reason: row.rejected_reason
  };
}

function mapFallbackRowToVerificationRow(
  row: Record<string, unknown>,
  profile: ProfileIdentity | undefined,
  loginEmail: string | null
): VerificationRequestRow {
  const payload = toObject(row.payload) as VerificationRequestPayload;
  const parsedPayload = parseVerificationPayload(payload);
  const reviewNotes = toOptionalString(row.review_notes) ?? toOptionalString(row.review_note);
  const submittedAt = toOptionalString(row.submitted_at);
  const lastSubmittedAt = toOptionalString(row.last_submitted_at);
  const updatedAt = toOptionalString(row.updated_at);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_full_name: profile?.full_name ?? null,
    user_username: profile?.username ?? null,
    login_email: loginEmail ?? profile?.username ?? null,
    current_account_type: profile?.account_type ?? null,
    requested_account_type: (String(row.requested_account_type) === "hotel" ? "hotel" : "business") as "business" | "hotel",
    legal_name: String(row.legal_name ?? "-"),
    tax_id: String(row.tax_id ?? "-"),
    company_email: toOptionalString(row.company_email),
    company_phone: toOptionalString(row.company_phone),
    payload,
    source: normalizeVerificationSource(parsedPayload.source),
    request_kind: parsedPayload.request_kind,
    status: String(row.status ?? "pending"),
    submitted_at: submittedAt,
    last_submitted_at: lastSubmittedAt,
    last_admin_email_sent_at: toOptionalString(row.last_admin_email_sent_at),
    last_email_action: toOptionalString(row.last_email_action),
    reminder_count: toOptionalNumber(row.reminder_count) ?? 0,
    updated_at: updatedAt,
    reviewed_at: toOptionalString(row.reviewed_at),
    reviewed_by: toOptionalString(row.reviewed_by),
    review_note: toOptionalString(row.review_note) ?? reviewNotes,
    review_notes: reviewNotes,
    admin_notes: toOptionalString(row.admin_notes),
    rejected_reason: toOptionalString(row.rejected_reason)
  };
}

function matchesDateRange(value: string | null, fromISO: string | null, toISO: string | null) {
  if (!fromISO && !toISO) {
    return true;
  }

  if (!value) {
    return false;
  }

  const current = new Date(value).getTime();
  if (Number.isNaN(current)) {
    return false;
  }

  const from = fromISO ? new Date(fromISO).getTime() : null;
  const to = toISO ? new Date(toISO).getTime() : null;

  if (from !== null && current < from) {
    return false;
  }

  if (to !== null && current > to) {
    return false;
  }

  return true;
}

function getVerificationSortTimestamp(row: VerificationRequestRow) {
  const activityAt = getRequestLastActivityDate(row.last_submitted_at, row.updated_at, row.submitted_at);

  if (!activityAt) {
    return 0;
  }

  const timestamp = new Date(activityAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export async function listVerificationRequests({
  query,
  accountType,
  verificationStatus,
  source,
  dateFrom,
  dateTo,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
}: ListVerificationsInput) {
  const supabase = createSupabaseServerClient();
  const currentPage = normalizePage(page);
  const currentPageSize = normalizePageSize(pageSize);
  const from = (currentPage - 1) * currentPageSize;
  const to = from + currentPageSize - 1;
  const sourceFilter = normalizeSourceFilter(source);
  const statusFilter = normalizeStatusFilter(verificationStatus);
  const accountTypeFilter = normalizeAccountTypeFilter(accountType);
  const dateFromISO = toDateStartISO(dateFrom);
  const dateToISO = toDateEndISO(dateTo);

  let statement = supabase
    .from("admin_verification_requests_v1")
    .select(
      "request_id,user_id,full_name,profile_username,current_account_type,business_details_email,request_status,target_account_type,legal_name,tax_id,company_email,company_phone,payload,request_source_normalized,request_kind,submitted_at,last_submitted_at,last_admin_email_sent_at,last_email_action,reminder_count,updated_at,reviewed_at,reviewed_by,review_note,review_notes,admin_notes,rejected_reason,is_real_pending,is_visible_for_admin_queue,request_source_bucket,last_activity_at",
      { count: "exact" }
    )
    .order("is_real_pending", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (accountTypeFilter) {
    statement = statement.eq("target_account_type", accountTypeFilter);
  }

  if (statusFilter) {
    statement = statement.eq("request_status", statusFilter);

    if (statusFilter === "pending") {
      statement = statement.eq("is_real_pending", true);
    }
  } else {
    statement = statement.eq("is_visible_for_admin_queue", true);
  }

  if (sourceFilter !== "all") {
    statement = statement.eq("request_source_bucket", sourceFilter);
  }

  if (dateFromISO) {
    statement = statement.gte("last_activity_at", dateFromISO);
  }

  if (dateToISO) {
    statement = statement.lte("last_activity_at", dateToISO);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);

    if (isUUID(token)) {
      statement = statement.or(`request_id.eq.${token},user_id.eq.${token}`);
    } else {
      statement = statement.or(
        `full_name.ilike.%${token}%,profile_username.ilike.%${token}%,business_details_email.ilike.%${token}%,legal_name.ilike.%${token}%,company_email.ilike.%${token}%,tax_id.ilike.%${token}%`
      );
    }
  }

  const { data, error, count } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return listVerificationRequestsFallback({
        query,
        accountType,
        verificationStatus,
        source,
        dateFrom,
        dateTo,
        page: currentPage,
        pageSize: currentPageSize
      });
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as VerificationListViewRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const emailMap = await getEmailMapByUserIds(userIds);

  return {
    rows: rows.map((row) => mapViewRowToVerificationRow(row, emailMap.get(row.user_id) ?? null)),
    total: count ?? 0
  };
}

async function listVerificationRequestsFallback({
  query,
  accountType,
  verificationStatus,
  source,
  dateFrom,
  dateTo,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
}: ListVerificationsInput) {
  const supabase = createSupabaseServerClient();
  const currentPage = normalizePage(page);
  const currentPageSize = normalizePageSize(pageSize);
  const sourceFilter = normalizeSourceFilter(source);
  const statusFilter = normalizeStatusFilter(verificationStatus);
  const accountTypeFilter = normalizeAccountTypeFilter(accountType);
  const dateFromISO = toDateStartISO(dateFrom);
  const dateToISO = toDateEndISO(dateTo);

  let statement = supabase.from("verification_requests").select("*").order("updated_at", { ascending: false });

  if (accountTypeFilter) {
    statement = statement.eq("requested_account_type", accountTypeFilter);
  }

  if (statusFilter && statusFilter !== "pending") {
    statement = statement.eq("status", statusFilter);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);

    if (isUUID(token)) {
      statement = statement.or(`id.eq.${token},user_id.eq.${token}`);
    } else {
      statement = statement.or(`legal_name.ilike.%${token}%,tax_id.ilike.%${token}%,company_email.ilike.%${token}%`);
    }
  }

  const { data, error } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return {
        rows: [] as VerificationRequestRow[],
        total: 0
      };
    }

    throw new Error(error.message);
  }

  const rawRows = (data ?? []) as Array<Record<string, unknown>>;
  const userIds = Array.from(new Set(rawRows.map((row) => String(row.user_id))));
  const [profileMap, emailMap] = await Promise.all([getProfilesMap(userIds), getEmailMapByUserIds(userIds)]);

  const mapped = rawRows.map((row) =>
    mapFallbackRowToVerificationRow(row, profileMap.get(String(row.user_id)), emailMap.get(String(row.user_id)) ?? null)
  );

  const filtered = mapped.filter((row) => {
    if (statusFilter === "pending" && !isRealPendingVerificationRequest(row.status, row.payload)) {
      return false;
    }

    if (!statusFilter && String(row.status).toLowerCase() === "pending" && !isRealPendingVerificationRequest(row.status, row.payload)) {
      return false;
    }

    if (statusFilter && statusFilter !== "pending" && String(row.status).toLowerCase() !== statusFilter) {
      return false;
    }

    if (sourceFilter !== "all" && !matchesVerificationSourceFilter(row.source, sourceFilter)) {
      return false;
    }

    const activityAt = getRequestLastActivityDate(row.last_submitted_at, row.updated_at, row.submitted_at);
    if (!matchesDateRange(activityAt, dateFromISO, dateToISO)) {
      return false;
    }

    if (!query?.trim()) {
      return true;
    }

    const token = sanitizeQuery(query).toLowerCase();
    const idMatch = row.id.toLowerCase() === token || row.user_id.toLowerCase() === token;
    if (idMatch) {
      return true;
    }

    return [row.legal_name, row.tax_id, row.company_email, row.user_full_name, row.user_username, row.login_email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(token));
  });

  const sorted = filtered.sort((a, b) => {
    const aIsRealPending = isRealPendingVerificationRequest(a.status, a.payload);
    const bIsRealPending = isRealPendingVerificationRequest(b.status, b.payload);

    if (aIsRealPending !== bIsRealPending) {
      return aIsRealPending ? -1 : 1;
    }

    return getVerificationSortTimestamp(b) - getVerificationSortTimestamp(a);
  });

  const from = (currentPage - 1) * currentPageSize;
  const to = from + currentPageSize;

  return {
    rows: sorted.slice(from, to),
    total: sorted.length
  };
}

export async function hasPendingVerificationRequests() {
  const supabase = createSupabaseServerClient();
  const viewQuery = await supabase
    .from("admin_verification_requests_v1")
    .select("request_id", { count: "exact", head: true })
    .eq("is_real_pending", true);

  if (!viewQuery.error) {
    return (viewQuery.count ?? 0) > 0;
  }

  if (!isMissingDatabaseObject(viewQuery.error) && !isPermissionError(viewQuery.error)) {
    throw new Error(viewQuery.error.message);
  }

  const fallbackQuery = await supabase.from("verification_requests").select("status,payload").eq("status", "pending");

  if (fallbackQuery.error) {
    if (isMissingDatabaseObject(fallbackQuery.error) || isPermissionError(fallbackQuery.error)) {
      return false;
    }

    throw new Error(fallbackQuery.error.message);
  }

  return (fallbackQuery.data ?? []).some((row) =>
    isRealPendingVerificationRequest(row.status, row.payload as VerificationRequestPayload | Record<string, unknown> | null)
  );
}

export async function getVerificationRequestDetail(requestId: string): Promise<VerificationRequestDetailResult | null> {
  const serverClient = createSupabaseServerClient();
  const serviceClient = createSupabaseServiceClient();

  const serverResult = await serverClient.from("verification_requests").select("*").eq("id", requestId).maybeSingle();

  let request = serverResult.data as Record<string, unknown> | null;
  let readClient = serverClient;

  if (serverResult.error && !isMissingDatabaseObject(serverResult.error) && !isPermissionError(serverResult.error)) {
    throw new Error(serverResult.error.message);
  }

  if (!request && serviceClient) {
    const serviceResult = await serviceClient.from("verification_requests").select("*").eq("id", requestId).maybeSingle();

    if (serviceResult.error) {
      if (!isMissingDatabaseObject(serviceResult.error) && !isPermissionError(serviceResult.error)) {
        throw new Error(serviceResult.error.message);
      }
    } else if (serviceResult.data) {
      request = serviceResult.data as Record<string, unknown>;
      readClient = serviceClient;
    }
  }

  if (!request) {
    const viewResult = await serverClient
      .from("admin_verification_requests_v1")
      .select(
        "request_id,user_id,target_account_type,legal_name,tax_id,company_email,company_phone,payload,request_source_normalized,request_kind,request_status,submitted_at,last_submitted_at,last_admin_email_sent_at,last_email_action,reminder_count,updated_at,reviewed_at,reviewed_by,review_note,review_notes,admin_notes,rejected_reason,created_at"
      )
      .eq("request_id", requestId)
      .maybeSingle();

    if (viewResult.error) {
      if (!isMissingDatabaseObject(viewResult.error) && !isPermissionError(viewResult.error)) {
        throw new Error(viewResult.error.message);
      }
    } else if (viewResult.data) {
      const viewRow = viewResult.data as Record<string, unknown>;
      request = {
        id: viewRow.request_id,
        user_id: viewRow.user_id,
        requested_account_type: viewRow.target_account_type,
        legal_name: viewRow.legal_name,
        tax_id: viewRow.tax_id,
        company_email: viewRow.company_email,
        company_phone: viewRow.company_phone,
        payload: viewRow.payload,
        status: viewRow.request_status,
        submitted_at: viewRow.submitted_at,
        last_submitted_at: viewRow.last_submitted_at,
        last_admin_email_sent_at: viewRow.last_admin_email_sent_at,
        last_email_action: viewRow.last_email_action,
        reminder_count: viewRow.reminder_count,
        updated_at: viewRow.updated_at,
        reviewed_at: viewRow.reviewed_at,
        reviewed_by: viewRow.reviewed_by,
        review_note: viewRow.review_note,
        review_notes: viewRow.review_notes,
        admin_notes: viewRow.admin_notes,
        rejected_reason: viewRow.rejected_reason,
        created_at: viewRow.created_at,
        country_code: null
      } as Record<string, unknown>;
    }
  }

  if (!request) {
    return null;
  }

  const userId = String(request.user_id);

  const [profileResult, businessResult, documentsResult, emailMap, notes, flags] = await Promise.all([
    readClient
      .from("profiles")
      .select("id,full_name,username,account_type,verification_status,can_publish")
      .eq("id", userId)
      .maybeSingle(),
    readClient.from("business_details").select("*").eq("user_id", userId).maybeSingle(),
    readClient
      .from("business_documents")
      .select("id,document_name,document_type,public_url,uploaded_at,verified,verified_at,notes")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false }),
    getEmailMapByUserIds([userId]),
    getAdminNotes("verification", requestId),
    getAdminFlags("verification", requestId)
  ]);

  if (profileResult.error && !isMissingDatabaseObject(profileResult.error) && !isPermissionError(profileResult.error)) {
    throw new Error(profileResult.error.message);
  }

  if (businessResult.error && !isMissingDatabaseObject(businessResult.error) && !isPermissionError(businessResult.error)) {
    throw new Error(businessResult.error.message);
  }

  if (documentsResult.error && !isMissingDatabaseObject(documentsResult.error) && !isPermissionError(documentsResult.error)) {
    throw new Error(documentsResult.error.message);
  }

  const payload = toObject(request.payload) as VerificationRequestPayload;
  const parsedPayload = parseVerificationPayload(payload);
  const reviewNotes = toOptionalString(request.review_notes) ?? toOptionalString(request.review_note);

  const mappedRequest: VerificationRequestDetail = {
    id: String(request.id),
    user_id: userId,
    user_full_name: toOptionalString(profileResult.data?.full_name),
    user_username: toOptionalString(profileResult.data?.username),
    login_email: emailMap.get(userId) ?? toOptionalString(profileResult.data?.username),
    current_account_type: toOptionalString(profileResult.data?.account_type),
    requested_account_type: (String(request.requested_account_type) === "hotel" ? "hotel" : "business") as "business" | "hotel",
    legal_name: String(request.legal_name ?? "-"),
    tax_id: String(request.tax_id ?? "-"),
    company_email: toOptionalString(request.company_email),
    company_phone: toOptionalString(request.company_phone),
    payload,
    source: parsedPayload.source,
    request_kind: parsedPayload.request_kind,
    status: String(request.status ?? "pending"),
    submitted_at: toOptionalString(request.submitted_at),
    last_submitted_at: toOptionalString(request.last_submitted_at),
    last_admin_email_sent_at: toOptionalString(request.last_admin_email_sent_at),
    last_email_action: toOptionalString(request.last_email_action),
    reminder_count: toOptionalNumber(request.reminder_count) ?? 0,
    updated_at: toOptionalString(request.updated_at),
    reviewed_at: toOptionalString(request.reviewed_at),
    reviewed_by: toOptionalString(request.reviewed_by),
    review_note: toOptionalString(request.review_note) ?? reviewNotes,
    review_notes: reviewNotes,
    admin_notes: toOptionalString(request.admin_notes),
    rejected_reason: toOptionalString(request.rejected_reason),
    country_code: toOptionalString(request.country_code),
    created_at: toOptionalString(request.created_at),
    parsed_payload: parsedPayload,
    last_activity_at: getRequestLastActivityDate(
      toOptionalString(request.last_submitted_at),
      toOptionalString(request.updated_at),
      toOptionalString(request.submitted_at)
    )
  };

  return {
    request: mappedRequest,
    profile: profileResult.data
      ? {
          id: String(profileResult.data.id),
          full_name: toOptionalString(profileResult.data.full_name),
          username: toOptionalString(profileResult.data.username),
          login_email: emailMap.get(userId) ?? toOptionalString(profileResult.data.username),
          account_type: toOptionalString(profileResult.data.account_type),
          verification_status: toOptionalString(profileResult.data.verification_status),
          can_publish: typeof profileResult.data.can_publish === "boolean" ? profileResult.data.can_publish : null
        }
      : null,
    businessDetailsCurrent: (businessResult.data as Record<string, unknown> | null) ?? null,
    documents: (documentsResult.data as Array<Record<string, unknown>> | null) ?? [],
    notes,
    flags
  };
}

export function isRealPendingRequest(status: unknown, payload: VerificationRequestPayload | Record<string, unknown> | null) {
  return isRealPendingVerificationRequest(status, payload);
}

export function getVerificationSourceBucket(source: string) {
  return mapVerificationSourceBucket(source);
}
