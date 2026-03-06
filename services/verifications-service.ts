import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { getAdminFlags, getAdminNotes } from "@/services/admin-meta-service";
import { getProfilesMap } from "@/services/profile-helpers";
import type { VerificationRequestRow } from "@/types";

interface VerificationRequestDetail extends VerificationRequestRow {
  country_code: string | null;
  created_at: string;
  updated_at: string;
}

interface VerificationRequestDetailResult {
  request: VerificationRequestDetail;
  businessDetails: Record<string, unknown> | null;
  documents: Array<Record<string, unknown>>;
  notes: Awaited<ReturnType<typeof getAdminNotes>>;
  flags: Awaited<ReturnType<typeof getAdminFlags>>;
}

interface ListVerificationsInput {
  status?: "pending" | "reviewed";
  query?: string;
  page?: number;
  pageSize?: number;
}

function sanitizeQuery(query: string) {
  return query.replace(/[,()]/g, " ").trim();
}

export async function listVerificationRequests({ status, query, page = 1, pageSize = 20 }: ListVerificationsInput) {
  const supabase = createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let statement = supabase
    .from("verification_requests")
    .select(
      "id,user_id,requested_account_type,legal_name,tax_id,company_email,company_phone,payload,status,submitted_at,reviewed_at,reviewed_by,review_note,admin_notes,rejected_reason",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false })
    .range(from, to);

  if (status === "pending") {
    statement = statement.eq("status", "pending");
  }

  if (status === "reviewed") {
    statement = statement.in("status", ["approved", "rejected"]);
  }

  if (query?.trim()) {
    const token = sanitizeQuery(query);
    statement = statement.or(`legal_name.ilike.%${token}%,tax_id.ilike.%${token}%`);
  }

  const { data, error, count } = await statement;

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return {
        rows: [] as VerificationRequestRow[],
        total: 0
      };
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    requested_account_type: "business" | "hotel";
    legal_name: string;
    tax_id: string;
    company_email: string | null;
    company_phone: string | null;
    payload: Record<string, unknown>;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_note: string | null;
    admin_notes: string | null;
    rejected_reason: string | null;
  }>;

  const profileMap = await getProfilesMap(rows.map((row) => row.user_id));

  const mapped: VerificationRequestRow[] = rows.map((row) => {
    const profile = profileMap.get(row.user_id);

    return {
      ...row,
      status: row.status,
      user_full_name: profile?.full_name ?? null,
      user_username: profile?.username ?? null
    };
  });

  return {
    rows: mapped,
    total: count ?? 0
  };
}

export async function getVerificationRequestDetail(requestId: string): Promise<VerificationRequestDetailResult | null> {
  const supabase = createSupabaseServerClient();

  const { data: request, error: requestError } = await supabase
    .from("verification_requests")
    .select(
      "id,user_id,requested_account_type,legal_name,tax_id,company_email,company_phone,country_code,payload,status,submitted_at,reviewed_at,reviewed_by,review_note,admin_notes,rejected_reason,created_at,updated_at"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    if (isMissingDatabaseObject(requestError)) {
      return null;
    }

    throw new Error(requestError.message);
  }

  if (!request) {
    return null;
  }

  const [{ data: businessDetails, error: businessError }, { data: documents, error: documentsError }, profileMap, notes, flags] =
    await Promise.all([
      supabase.from("business_details").select("*").eq("user_id", request.user_id).maybeSingle(),
      supabase
        .from("business_documents")
        .select("id,document_name,document_type,public_url,uploaded_at,verified,verified_at,notes")
        .eq("user_id", request.user_id)
        .order("uploaded_at", { ascending: false }),
      getProfilesMap([request.user_id as string]),
      getAdminNotes("verification", requestId),
      getAdminFlags("verification", requestId)
    ]);

  if (businessError && !isMissingDatabaseObject(businessError)) {
    throw new Error(businessError.message);
  }

  if (documentsError && !isMissingDatabaseObject(documentsError)) {
    throw new Error(documentsError.message);
  }

  const profile = profileMap.get(request.user_id as string);
  const mappedRequest: VerificationRequestDetail = {
    id: request.id as string,
    user_id: request.user_id as string,
    requested_account_type: request.requested_account_type as "business" | "hotel",
    legal_name: request.legal_name as string,
    tax_id: request.tax_id as string,
    company_email: request.company_email as string | null,
    company_phone: request.company_phone as string | null,
    payload: (request.payload as Record<string, unknown>) ?? {},
    status: request.status as string,
    submitted_at: request.submitted_at as string,
    reviewed_at: request.reviewed_at as string | null,
    reviewed_by: request.reviewed_by as string | null,
    review_note: request.review_note as string | null,
    admin_notes: request.admin_notes as string | null,
    rejected_reason: request.rejected_reason as string | null,
    user_full_name: profile?.full_name ?? null,
    user_username: profile?.username ?? null,
    country_code: request.country_code as string | null,
    created_at: request.created_at as string,
    updated_at: request.updated_at as string
  };

  return {
    request: mappedRequest,
    businessDetails: (businessDetails as Record<string, unknown> | null) ?? null,
    documents: (documents as Array<Record<string, unknown>> | null) ?? [],
    notes,
    flags
  };
}
