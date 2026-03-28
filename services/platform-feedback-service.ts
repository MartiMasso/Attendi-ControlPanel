import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isUUID } from "@/lib/utils";
import type { PlatformFeedbackCategory, PlatformFeedbackRow, PlatformFeedbackStatus } from "@/types";

const DEFAULT_PAGE_SIZE = 20;

export const PLATFORM_FEEDBACK_STATUSES: PlatformFeedbackStatus[] = ["new", "in_review", "resolved", "closed"];
export const PLATFORM_FEEDBACK_CATEGORIES: PlatformFeedbackCategory[] = ["suggestion", "bug", "other"];

interface ListPlatformFeedbackInput {
  query?: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ListPlatformFeedbackResult {
  rows: PlatformFeedbackRow[];
  total: number;
}

export function getPlatformFeedbackAdminClient() {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Configure this key to manage platform feedback from the admin panel."
    );
  }

  return serviceClient;
}

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

function normalizeStatusFilter(status?: string): PlatformFeedbackStatus | null {
  const normalized = String(status ?? "").toLowerCase();

  if (!normalized) {
    return null;
  }

  return PLATFORM_FEEDBACK_STATUSES.includes(normalized as PlatformFeedbackStatus)
    ? (normalized as PlatformFeedbackStatus)
    : null;
}

function normalizeCategoryFilter(category?: string): PlatformFeedbackCategory | null {
  const normalized = String(category ?? "").toLowerCase();

  if (!normalized) {
    return null;
  }

  return PLATFORM_FEEDBACK_CATEGORIES.includes(normalized as PlatformFeedbackCategory)
    ? (normalized as PlatformFeedbackCategory)
    : null;
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

export async function listPlatformFeedback({
  query,
  status,
  category,
  dateFrom,
  dateTo,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
}: ListPlatformFeedbackInput): Promise<ListPlatformFeedbackResult> {
  const supabase = getPlatformFeedbackAdminClient();
  const currentPage = normalizePage(page);
  const currentPageSize = normalizePageSize(pageSize);
  const from = (currentPage - 1) * currentPageSize;
  const to = from + currentPageSize - 1;
  const statusFilter = normalizeStatusFilter(status);
  const categoryFilter = normalizeCategoryFilter(category);
  const dateFromISO = toDateStartISO(dateFrom);
  const dateToISO = toDateEndISO(dateTo);

  let statement = supabase
    .from("platform_feedback")
    .select(
      "id,created_at,user_id,display_name,email,category,subject,message,source,status,handled_by,handled_at,admin_notes",
      {
        count: "exact"
      }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter) {
    statement = statement.eq("status", statusFilter);
  }

  if (categoryFilter) {
    statement = statement.eq("category", categoryFilter);
  }

  if (dateFromISO) {
    statement = statement.gte("created_at", dateFromISO);
  }

  if (dateToISO) {
    statement = statement.lte("created_at", dateToISO);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);

    if (isUUID(token)) {
      statement = statement.or(
        `id.eq.${token},user_id.eq.${token},subject.ilike.%${token}%,message.ilike.%${token}%,email.ilike.%${token}%,display_name.ilike.%${token}%`
      );
    } else {
      statement = statement.or(
        `subject.ilike.%${token}%,message.ilike.%${token}%,email.ilike.%${token}%,display_name.ilike.%${token}%`
      );
    }
  }

  const { data, error, count } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return {
        rows: [],
        total: 0
      };
    }

    throw new Error(error.message);
  }

  return {
    rows: (data ?? []) as PlatformFeedbackRow[],
    total: count ?? 0
  };
}

export async function getPlatformFeedbackById(feedbackId: string): Promise<PlatformFeedbackRow | null> {
  const supabase = getPlatformFeedbackAdminClient();
  const { data, error } = await supabase
    .from("platform_feedback")
    .select("id,created_at,user_id,display_name,email,category,subject,message,source,status,handled_by,handled_at,admin_notes")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return (data as PlatformFeedbackRow | null) ?? null;
}

export async function countNewPlatformFeedback() {
  const supabase = getPlatformFeedbackAdminClient();

  const { count, error } = await supabase
    .from("platform_feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return 0;
    }

    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getLatestPlatformFeedbackCreatedAt() {
  const supabase = getPlatformFeedbackAdminClient();

  const { data, error } = await supabase
    .from("platform_feedback")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return (data?.created_at as string | undefined) ?? null;
}
