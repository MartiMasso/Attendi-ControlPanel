import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { isUUID } from "@/lib/utils";
import { getProfilesMap } from "@/services/profile-helpers";
import type {
  InternalHubMember,
  InternalNoteRow,
  InternalTaskPriority,
  InternalTaskRow,
  InternalTaskStatus
} from "@/types";

interface ListInternalTasksInput {
  query?: string;
  status?: string;
  priority?: string;
  assigneeUserId?: string;
  page?: number;
  pageSize?: number;
}

interface InternalHubInsights {
  total_open_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  due_this_week: number;
  workload: Array<{
    user_id: string;
    name: string;
    open_tasks: number;
  }>;
}

const TASK_STATUS_VALUES: InternalTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const TASK_PRIORITY_VALUES: InternalTaskPriority[] = ["low", "medium", "high", "urgent"];
const DEFAULT_INTERNAL_COMPANY_CATEGORIES = ["Hotel", "Camping", "Alojamiento Otro"];

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

function toDateStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeStatus(status?: string): InternalTaskStatus | null {
  const normalized = String(status ?? "").toLowerCase();
  return TASK_STATUS_VALUES.includes(normalized as InternalTaskStatus) ? (normalized as InternalTaskStatus) : null;
}

function normalizePriority(priority?: string): InternalTaskPriority | null {
  const normalized = String(priority ?? "").toLowerCase();
  return TASK_PRIORITY_VALUES.includes(normalized as InternalTaskPriority) ? (normalized as InternalTaskPriority) : null;
}

function normalizeCategoryLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }

  return compact
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function uniqueCategories(values: Array<string | null>) {
  const seen = new Set<string>();
  const categories: string[] = [];

  values.forEach((value) => {
    const label = normalizeCategoryLabel(value);
    if (!label) return;

    const key = label.toLocaleLowerCase("es");
    if (seen.has(key)) return;

    seen.add(key);
    categories.push(label);
  });

  return categories;
}

function mergeCategoryLists(primary: string[], secondary: string[]) {
  return uniqueCategories([...primary, ...secondary]).sort((left, right) => {
    const leftIndex = DEFAULT_INTERNAL_COMPANY_CATEGORIES.findIndex((category) => category.toLocaleLowerCase("es") === left.toLocaleLowerCase("es"));
    const rightIndex = DEFAULT_INTERNAL_COMPANY_CATEGORIES.findIndex((category) => category.toLocaleLowerCase("es") === right.toLocaleLowerCase("es"));

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return left.localeCompare(right, "es", { sensitivity: "base" });
  });
}

export async function listInternalCompanyCategories(): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const defaultCategories = [...DEFAULT_INTERNAL_COMPANY_CATEGORIES];

  const { data: businessRows, error: businessError } = await supabase
    .from("business_details")
    .select("company_type,organization_type")
    .limit(1000);

  if (!businessError) {
    const rows = (businessRows ?? []) as Array<{ company_type?: string | null; organization_type?: string | null }>;
    const categories = uniqueCategories(rows.flatMap((row) => [row.company_type ?? null, row.organization_type ?? null]));
    return mergeCategoryLists(defaultCategories, categories);
  }

  if (!(isMissingDatabaseObject(businessError) || isPermissionError(businessError))) {
    throw new Error(businessError.message);
  }

  const { data: productRows, error: productError } = await supabase.from("products").select("category").limit(1000);

  if (productError) {
    if (isMissingDatabaseObject(productError) || isPermissionError(productError)) {
      return defaultCategories;
    }

    throw new Error(productError.message);
  }

  const categories = uniqueCategories(((productRows ?? []) as Array<{ category?: string | null }>).map((row) => row.category ?? null));
  return mergeCategoryLists(defaultCategories, categories);
}

export async function listInternalMembers(): Promise<InternalHubMember[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admins")
    .select("user_id,role,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ user_id: string; role: string; is_active: boolean }>;
  const userIds = rows.map((row) => row.user_id);
  const profiles = await getProfilesMap(userIds);

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      username: profile?.username ?? null,
      role: row.role
    };
  });
}

export async function listInternalTasks({
  query,
  status,
  priority,
  assigneeUserId,
  page = 1,
  pageSize = 20
}: ListInternalTasksInput) {
  const supabase = createSupabaseServerClient();
  const from = (Math.max(1, page) - 1) * pageSize;
  const to = from + pageSize - 1;
  const normalizedStatus = normalizeStatus(status);
  const normalizedPriority = normalizePriority(priority);

  let statement = supabase
    .from("internal_hub_tasks")
    .select("id,title,description,status,priority,assignee_user_id,created_by_user_id,due_date,created_at,updated_at", {
      count: "exact"
    })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (normalizedStatus) {
    statement = statement.eq("status", normalizedStatus);
  }

  if (normalizedPriority) {
    statement = statement.eq("priority", normalizedPriority);
  }

  if (assigneeUserId?.trim()) {
    statement = statement.eq("assignee_user_id", assigneeUserId.trim());
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);
    if (isUUID(token)) {
      statement = statement.or(`id.eq.${token},assignee_user_id.eq.${token},created_by_user_id.eq.${token}`);
    } else {
      statement = statement.or(`title.ilike.%${token}%,description.ilike.%${token}%`);
    }
  }

  const { data, error, count } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return {
        rows: [] as InternalTaskRow[],
        total: 0
      };
    }

    throw new Error(error.message);
  }

  const rawRows = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: InternalTaskStatus;
    priority: InternalTaskPriority;
    assignee_user_id: string | null;
    created_by_user_id: string;
    due_date: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const userIds = Array.from(
    new Set(
      rawRows
        .flatMap((row) => [row.assignee_user_id, row.created_by_user_id])
        .filter(Boolean)
        .map((value) => String(value))
    )
  );
  const profiles = await getProfilesMap(userIds);

  const rows: InternalTaskRow[] = rawRows.map((row) => ({
    ...row,
    assignee_name: row.assignee_user_id
      ? profiles.get(row.assignee_user_id)?.full_name ?? profiles.get(row.assignee_user_id)?.username ?? row.assignee_user_id
      : null,
    created_by_name:
      profiles.get(row.created_by_user_id)?.full_name ?? profiles.get(row.created_by_user_id)?.username ?? row.created_by_user_id
  }));

  return {
    rows,
    total: count ?? 0
  };
}

export async function listInternalNotes(limit = 12): Promise<InternalNoteRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("internal_hub_notes")
    .select("id,title,body,category,pinned,created_by_user_id,created_at,updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  const rawRows = (data ?? []) as Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    pinned: boolean;
    created_by_user_id: string;
    created_at: string;
    updated_at: string;
  }>;

  const userIds = Array.from(new Set(rawRows.map((row) => row.created_by_user_id)));
  const profiles = await getProfilesMap(userIds);

  return rawRows.map((row) => ({
    ...row,
    created_by_name:
      profiles.get(row.created_by_user_id)?.full_name ?? profiles.get(row.created_by_user_id)?.username ?? row.created_by_user_id
  }));
}

export async function getInternalHubInsights(): Promise<InternalHubInsights> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("internal_hub_tasks").select("status,due_date,assignee_user_id");

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return {
        total_open_tasks: 0,
        blocked_tasks: 0,
        overdue_tasks: 0,
        due_this_week: 0,
        workload: []
      };
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    status: InternalTaskStatus;
    due_date: string | null;
    assignee_user_id: string | null;
  }>;

  const todayStart = toDateStart(new Date());
  const todayKey = toDateKey(todayStart);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = toDateKey(weekEnd);

  const workloadMap = new Map<string, number>();

  let totalOpen = 0;
  let blocked = 0;
  let overdue = 0;
  let dueThisWeek = 0;

  rows.forEach((row) => {
    const isDone = row.status === "done";
    const isOpen = !isDone;

    if (isOpen) {
      totalOpen += 1;

      if (row.assignee_user_id) {
        workloadMap.set(row.assignee_user_id, (workloadMap.get(row.assignee_user_id) ?? 0) + 1);
      }

      if (row.status === "blocked") {
        blocked += 1;
      }
    }

    if (isOpen && row.due_date && row.due_date < todayKey) {
      overdue += 1;
    }

    if (isOpen && row.due_date && row.due_date >= todayKey && row.due_date <= weekEndKey) {
      dueThisWeek += 1;
    }
  });

  const assigneeIds = Array.from(workloadMap.keys());
  const profiles = await getProfilesMap(assigneeIds);

  const workload = assigneeIds
    .map((userId) => ({
      user_id: userId,
      name: profiles.get(userId)?.full_name ?? profiles.get(userId)?.username ?? userId,
      open_tasks: workloadMap.get(userId) ?? 0
    }))
    .sort((a, b) => b.open_tasks - a.open_tasks || a.name.localeCompare(b.name));

  return {
    total_open_tasks: totalOpen,
    blocked_tasks: blocked,
    overdue_tasks: overdue,
    due_this_week: dueThisWeek,
    workload
  };
}
