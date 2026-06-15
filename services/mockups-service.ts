import { getServiceRoleKey, getSupabaseConfig } from "@/lib/config";
import {
  MOCKUP_DEFAULT_PASSWORD,
  type ConvertibleAccountRow,
  type MockupAccountRow,
  type MockupAccountType,
  type MockupListResult
} from "@/lib/mockups";
import { isMissingColumnError, isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isUUID } from "@/lib/utils";
import { createAuditLogEntry } from "@/services/audit-log-service";
import { getEmailMapByUserIds } from "@/services/profile-helpers";

const MOCKUP_SCHEMA_MESSAGE =
  "Run migration supabase/migrations/20260615120000_mockup_accounts.sql before using Mockups.";

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

interface CreateMockupAccountInput {
  accountType: MockupAccountType;
  displayName: string;
  username?: string;
  createdByAdminUserId: string;
}

interface MockupAccountActionInput {
  userId: string;
  adminUserId: string;
}

interface ConvertAccountInput {
  userId: string;
  /** When omitted/empty the account keeps its current login email. */
  newEmail?: string | null;
  adminUserId: string;
}

function describeAuthError(error: { message?: string; status?: number; code?: string }) {
  const parts = [error.message || "Unknown error"];

  if (error.status) {
    parts.push(`(status ${error.status})`);
  }

  return parts.join(" ");
}

type MockupMetadata = Record<string, unknown>;

interface ProfileMockupRecord {
  id: string;
  full_name: string | null;
  username: string;
  account_type: MockupAccountType | string;
  verification_status: string | null;
  can_publish?: boolean | null;
  company_setup_complete?: boolean | null;
  is_mockup?: boolean | null;
  mockup_created_at?: string | null;
  mockup_converted_at?: string | null;
  mockup_metadata?: MockupMetadata | null;
}

interface ProfileStripeRecord extends ProfileMockupRecord {
  stripe_account_id?: string | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  stripe_transfers_enabled?: boolean | null;
}

function asMetadata(value: unknown): MockupMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as MockupMetadata) : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function getAttendiAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_ATTENDI_APP_URL?.trim() || "https://attendi.es").replace(/\/+$/, "");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAccountType(value: unknown): MockupAccountType {
  return value === "business" ? "business" : "hotel";
}

function slugifyUsername(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);

  return normalized || "mockup";
}

async function usernameExists(supabase: SupabaseClient, username: string) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", username);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

async function generateUniqueUsername(supabase: SupabaseClient, accountType: MockupAccountType, input?: string) {
  const base = slugifyUsername(input || `${accountType}_mockup`);

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}_${suffix}`;

    if (!(await usernameExists(supabase, candidate))) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique username after 20 attempts.");
}

async function generateUniqueYopmailEmail(supabase: SupabaseClient): Promise<string> {
  const { url } = getSupabaseConfig();
  const serviceKey = getServiceRoleKey();

  for (let attempt = 0; attempt < 20; attempt++) {
    const number = Math.floor(100000 + Math.random() * 900000);
    const candidate = `attendi${number}@yopmail.com`;

    if (serviceKey) {
      const response = await fetch(
        `${url}/auth/v1/admin/users?filter=${encodeURIComponent(candidate)}&per_page=10`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );

      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { users?: Array<{ email?: string }> } | null;
        const taken = (body?.users ?? []).some((user) => user.email?.toLowerCase() === candidate);

        if (!taken) {
          return candidate;
        }

        continue;
      }
    }

    const { count } = await supabase.from("business_details").select("user_id", { count: "exact", head: true }).eq("email", candidate);

    if ((count ?? 0) === 0) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique yopmail email after 20 attempts.");
}

async function upsertBusinessDetails(
  supabase: SupabaseClient,
  input: {
    userId: string;
    accountType: MockupAccountType;
    businessName: string;
    email: string;
  }
) {
  const basePayload: Record<string, unknown> = {
    user_id: input.userId,
    organization_type: input.accountType,
    business_name: input.businessName,
    business_nif: "MOCKUP",
    email: input.email
  };

  const result = await supabase.from("business_details").upsert(basePayload, { onConflict: "user_id" });

  if (!result.error) {
    return;
  }

  if (!isMissingColumnError(result.error)) {
    throw new Error(`Business details error: ${result.error.message}`);
  }

  const fallbackPayload = { ...basePayload };
  delete fallbackPayload.email;

  const fallback = await supabase.from("business_details").upsert(fallbackPayload, { onConflict: "user_id" });

  if (fallback.error) {
    throw new Error(`Business details error: ${fallback.error.message}`);
  }
}

async function getProductCountsByOwner(userIds: string[]) {
  const counts = new Map<string, number>();

  if (!userIds.length) {
    return counts;
  }

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();
  const { data, error } = await supabase.from("products").select("user_id").in("user_id", userIds);

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return counts;
    }

    throw new Error(error.message);
  }

  (data ?? []).forEach((row) => {
    const userId = row.user_id as string | null;

    if (!userId) {
      return;
    }

    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  });

  return counts;
}

async function getBusinessDetailsByOwner(userIds: string[]) {
  const map = new Map<string, { businessName: string | null; email: string | null }>();

  if (!userIds.length) {
    return map;
  }

  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();
  const { data, error } = await supabase.from("business_details").select("user_id,business_name,email").in("user_id", userIds);

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  (data ?? []).forEach((row) => {
    const userId = row.user_id as string | null;

    if (!userId) {
      return;
    }

    map.set(userId, {
      businessName: (row.business_name as string | null) ?? null,
      email: (row.email as string | null) ?? null
    });
  });

  return map;
}

async function mapMockupRows(profileRows: ProfileMockupRecord[]): Promise<MockupAccountRow[]> {
  const userIds = profileRows.map((row) => row.id);
  const [emailMap, businessMap, productCounts] = await Promise.all([
    getEmailMapByUserIds(userIds),
    getBusinessDetailsByOwner(userIds),
    getProductCountsByOwner(userIds)
  ]);

  return profileRows.map((row) => {
    const business = businessMap.get(row.id);
    const metadata = asMetadata(row.mockup_metadata);

    return {
      id: row.id,
      email: emailMap.get(row.id) ?? business?.email ?? null,
      fullName: row.full_name,
      username: row.username,
      accountType: normalizeAccountType(row.account_type),
      businessName: business?.businessName ?? null,
      verificationStatus: row.verification_status,
      canPublish: typeof row.can_publish === "boolean" ? row.can_publish : null,
      companySetupComplete: typeof row.company_setup_complete === "boolean" ? row.company_setup_complete : null,
      isMockup: row.is_mockup === true,
      mockupCreatedAt: row.mockup_created_at ?? null,
      mockupConvertedAt: row.mockup_converted_at ?? null,
      productCount: productCounts.get(row.id) ?? 0,
      convertedFromExisting: metadata.converted_from_existing === true,
      originalStripeAccountId: asText(metadata.original_stripe_account_id)
    };
  });
}

async function getActiveMockupProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,account_type,is_mockup,mockup_created_at,mockup_converted_at,mockup_metadata")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(MOCKUP_SCHEMA_MESSAGE);
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Mockup profile not found.");
  }

  const profile = data as ProfileMockupRecord;

  if (profile.is_mockup !== true || !profile.mockup_created_at || profile.mockup_converted_at) {
    throw new Error("Only active mockup accounts can be managed from this action.");
  }

  return profile;
}

async function getAuthEmailForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  const email = data.user?.email?.trim();

  if (!email) {
    throw new Error("Mockup account does not have an auth email.");
  }

  return email;
}

async function deleteRowsByColumn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
  failOnError: boolean
) {
  const { error } = await supabase.from(table).delete().eq(column, value);

  if (!error || isMissingDatabaseObject(error)) {
    return;
  }

  if (failOnError) {
    throw new Error(`Could not delete ${table}: ${error.message}`);
  }

  console.warn(`[mockups] ${table} cleanup failed:`, error.message);
}

async function deleteAdminMetaRows(supabase: SupabaseClient, table: "admin_notes" | "admin_flags", userId: string) {
  const { error } = await supabase.from(table).delete().eq("entity_type", "user").eq("entity_id", userId);

  if (!error || isMissingDatabaseObject(error)) {
    return;
  }

  console.warn(`[mockups] ${table} cleanup failed:`, error.message);
}

async function cleanupMockupRows(supabase: SupabaseClient, userId: string, failOnError: boolean) {
  await deleteRowsByColumn(supabase, "products", "user_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "business_documents", "user_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "verification_requests", "user_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "hotel_referral_codes", "hotel_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "hotel_locations", "owner_user_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "hotel_details", "user_id", userId, failOnError);
  await deleteRowsByColumn(supabase, "business_details", "user_id", userId, failOnError);
  await deleteAdminMetaRows(supabase, "admin_notes", userId);
  await deleteAdminMetaRows(supabase, "admin_flags", userId);
  await deleteRowsByColumn(supabase, "profiles", "id", userId, failOnError);
}

export async function listMockupAccounts(limit = 100): Promise<MockupListResult> {
  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,full_name,username,account_type,verification_status,can_publish,company_setup_complete,is_mockup,mockup_created_at,mockup_converted_at,mockup_metadata"
    )
    .not("mockup_created_at", "is", null)
    .in("account_type", ["hotel", "business"])
    .order("mockup_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    if (isMissingColumnError(error)) {
      return {
        rows: [],
        schemaReady: false,
        schemaMessage: MOCKUP_SCHEMA_MESSAGE
      };
    }

    throw new Error(error.message);
  }

  return {
    rows: await mapMockupRows((data ?? []) as ProfileMockupRecord[]),
    schemaReady: true
  };
}

export async function createMockupAccount(input: CreateMockupAccountInput): Promise<MockupAccountRow> {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Service role key not configured.");
  }

  const accountType = normalizeAccountType(input.accountType);
  const displayName = normalizeText(input.displayName);

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  const requestedUsername = input.username?.trim() ? slugifyUsername(input.username.trim()) : null;
  const [email, username] = await Promise.all([
    generateUniqueYopmailEmail(supabase),
    requestedUsername
      ? usernameExists(supabase, requestedUsername).then((exists) => {
          if (exists) {
            throw new Error("Username is already in use.");
          }

          return requestedUsername;
        })
      : generateUniqueUsername(supabase, accountType, displayName)
  ]);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: MOCKUP_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: displayName,
      username,
      account_type: accountType,
      is_mockup: true
    }
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Auth user creation failed.");
  }

  const userId = authData.user.id;
  const createdAt = new Date().toISOString();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: displayName,
      username,
      account_type: accountType,
      verification_status: "approved",
      can_publish: true,
      company_setup_complete: true,
      is_mockup: true,
      mockup_created_at: createdAt,
      mockup_created_by_admin_user_id: input.createdByAdminUserId,
      mockup_converted_at: null
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);

    if (isMissingColumnError(profileError)) {
      throw new Error(MOCKUP_SCHEMA_MESSAGE);
    }

    throw new Error(`Profile error: ${profileError.message}`);
  }

  try {
    await upsertBusinessDetails(supabase, {
      userId,
      accountType,
      businessName: displayName,
      email
    });
  } catch (error) {
    await supabase.from("profiles").delete().eq("id", userId);
    await supabase.auth.admin.deleteUser(userId);
    throw error;
  }

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: input.createdByAdminUserId,
      action: "mockup_account_created",
      entityType: "user",
      entityId: userId,
      metadata: {
        email,
        username,
        accountType,
        defaultPassword: true,
        isMockup: true
      }
    });
  } catch (auditError) {
    console.warn("[mockups] audit log failed:", auditError instanceof Error ? auditError.message : auditError);
  }

  const [row] = await mapMockupRows([
    {
      id: userId,
      full_name: displayName,
      username,
      account_type: accountType,
      verification_status: "approved",
      can_publish: true,
      company_setup_complete: true,
      is_mockup: true,
      mockup_created_at: createdAt,
      mockup_converted_at: null
    }
  ]);

  return row;
}

export async function createMockupLoginLink(input: MockupAccountActionInput) {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Service role key not configured.");
  }

  const userId = input.userId.trim();
  await getActiveMockupProfile(supabase, userId);
  const email = await getAuthEmailForUser(supabase, userId);
  const redirectTo = `${getAttendiAppBaseUrl()}/seller/${encodeURIComponent(userId)}`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  const actionLink = data.properties?.action_link;

  if (!actionLink) {
    throw new Error("Supabase did not return a login link.");
  }

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: input.adminUserId,
      action: "mockup_login_link_generated",
      entityType: "user",
      entityId: userId,
      metadata: {
        redirectTo,
        email
      }
    });
  } catch (auditError) {
    console.warn("[mockups] login link audit failed:", auditError instanceof Error ? auditError.message : auditError);
  }

  return {
    url: actionLink,
    redirectTo
  };
}

export async function deleteMockupAccount(input: MockupAccountActionInput) {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Service role key not configured.");
  }

  const userId = input.userId.trim();
  const profile = await getActiveMockupProfile(supabase, userId);

  // Accounts converted from a real account must never be hard-deleted: that would
  // destroy a genuine user. They can only be reverted via restoreAccountFromMockup.
  if (asMetadata(profile.mockup_metadata).converted_from_existing === true) {
    throw new Error(
      'This mockup was converted from a real account. Use "Restore to normal account" instead of deleting it.'
    );
  }

  const email = await getAuthEmailForUser(supabase, userId);

  let deleteResult = await supabase.auth.admin.deleteUser(userId);

  if (deleteResult.error) {
    await cleanupMockupRows(supabase, userId, true);
    deleteResult = await supabase.auth.admin.deleteUser(userId);
  }

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  await cleanupMockupRows(supabase, userId, false);

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: input.adminUserId,
      action: "mockup_account_deleted",
      entityType: "user",
      entityId: userId,
      metadata: {
        email,
        username: profile.username,
        accountType: normalizeAccountType(profile.account_type),
        fullName: profile.full_name
      }
    });
  } catch (auditError) {
    console.warn("[mockups] delete audit failed:", auditError instanceof Error ? auditError.message : auditError);
  }

  return {
    userId,
    email
  };
}

const CONVERT_PROFILE_COLUMNS =
  "id,full_name,username,account_type,verification_status,can_publish,company_setup_complete,is_mockup,mockup_created_at,mockup_converted_at,mockup_metadata,stripe_account_id,charges_enabled,payouts_enabled,stripe_transfers_enabled";

async function getProfileForConversion(supabase: SupabaseClient, userId: string): Promise<ProfileStripeRecord> {
  const { data, error } = await supabase.from("profiles").select(CONVERT_PROFILE_COLUMNS).eq("id", userId).maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(MOCKUP_SCHEMA_MESSAGE);
    }

    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Account not found.");
  }

  return data as ProfileStripeRecord;
}

async function updateBusinessDetailsEmail(supabase: SupabaseClient, userId: string, email: string) {
  const { error } = await supabase.from("business_details").update({ email }).eq("user_id", userId);

  if (error && !isMissingDatabaseObject(error)) {
    console.warn("[mockups] business_details email update failed:", error.message);
  }
}

export async function findConvertibleAccounts(query: string, limit = 12): Promise<ConvertibleAccountRow[]> {
  const supabase = createSupabaseServiceClient() ?? createSupabaseServerClient();

  let statement = supabase
    .from("profiles")
    .select("id,full_name,username,account_type,stripe_account_id,is_mockup")
    .in("account_type", ["hotel", "business"])
    .or("is_mockup.is.null,is_mockup.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

  const token = query.trim();

  if (token) {
    if (isUUID(token)) {
      statement = statement.eq("id", token);
    } else {
      const safe = token.replace(/[,()%*]/g, " ").trim();
      statement = statement.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`);
    }
  }

  const { data, error } = await statement;

  if (error) {
    if (isMissingColumnError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    full_name: string | null;
    username: string;
    account_type: MockupAccountType | string;
    stripe_account_id: string | null;
  }>;

  const ids = rows.map((row) => row.id);
  const [emailMap, businessMap] = await Promise.all([getEmailMapByUserIds(ids), getBusinessDetailsByOwner(ids)]);

  return rows.map((row) => {
    const business = businessMap.get(row.id);

    return {
      id: row.id,
      fullName: row.full_name,
      username: row.username,
      accountType: normalizeAccountType(row.account_type),
      businessName: business?.businessName ?? null,
      email: emailMap.get(row.id) ?? business?.email ?? null,
      stripeAccountId: asText(row.stripe_account_id)
    };
  });
}

export async function convertAccountToMockup(input: ConvertAccountInput): Promise<MockupAccountRow> {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Service role key not configured.");
  }

  const userId = input.userId.trim();
  const requestedEmail = input.newEmail?.trim().toLowerCase() ?? "";

  const profile = await getProfileForConversion(supabase, userId);

  if (profile.account_type !== "hotel" && profile.account_type !== "business") {
    throw new Error("Only hotel or company accounts can be converted to mockups.");
  }

  if (profile.is_mockup === true) {
    throw new Error("This account is already a mockup.");
  }

  const currentEmail = await getAuthEmailForUser(supabase, userId);

  // The new email is optional: when omitted the account keeps its current login.
  const changeEmail = requestedEmail.length > 0 && requestedEmail !== currentEmail.toLowerCase();

  if (requestedEmail.length > 0 && !EMAIL_PATTERN.test(requestedEmail)) {
    throw new Error("A valid new email is required.");
  }

  const convertedAt = new Date().toISOString();
  const metadata: MockupMetadata = {
    ...asMetadata(profile.mockup_metadata),
    converted_from_existing: true,
    converted_at: convertedAt,
    email_changed: changeEmail,
    original_email: currentEmail,
    original_stripe_account_id: asText(profile.stripe_account_id),
    original_charges_enabled: asBoolean(profile.charges_enabled),
    original_payouts_enabled: asBoolean(profile.payouts_enabled),
    original_stripe_transfers_enabled: asBoolean(profile.stripe_transfers_enabled),
    original_verification_status: profile.verification_status ?? null,
    original_can_publish: typeof profile.can_publish === "boolean" ? profile.can_publish : null,
    original_company_setup_complete:
      typeof profile.company_setup_complete === "boolean" ? profile.company_setup_complete : null
  };

  if (changeEmail) {
    const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
      email: requestedEmail,
      email_confirm: true,
      user_metadata: { is_mockup: true }
    });

    if (emailError) {
      console.error("[mockups] convert email update failed:", {
        message: emailError.message,
        status: (emailError as { status?: number }).status,
        code: (emailError as { code?: string }).code
      });

      throw new Error(
        `Could not update the account email: ${describeAuthError(emailError)}. ` +
          'This often happens with Google sign-in accounts — choose "Keep current email" to convert without changing it.'
      );
    }
  } else {
    // Still flag the auth user as a mockup even when the email is unchanged.
    await supabase.auth.admin.updateUserById(userId, { user_metadata: { is_mockup: true } }).catch(() => undefined);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_mockup: true,
      mockup_created_at: convertedAt,
      mockup_created_by_admin_user_id: input.adminUserId,
      mockup_converted_at: null,
      verification_status: "approved",
      can_publish: true,
      company_setup_complete: true,
      stripe_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      stripe_transfers_enabled: false,
      mockup_metadata: metadata
    })
    .eq("id", userId);

  if (profileError) {
    // Roll back any email change so the account is left untouched on failure.
    if (changeEmail) {
      await supabase.auth.admin
        .updateUserById(userId, { email: currentEmail, email_confirm: true, user_metadata: { is_mockup: false } })
        .catch(() => undefined);
    } else {
      await supabase.auth.admin.updateUserById(userId, { user_metadata: { is_mockup: false } }).catch(() => undefined);
    }

    if (isMissingColumnError(profileError)) {
      throw new Error(MOCKUP_SCHEMA_MESSAGE);
    }

    throw new Error(`Profile error: ${profileError.message}`);
  }

  if (changeEmail) {
    await updateBusinessDetailsEmail(supabase, userId, requestedEmail);
  }

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: input.adminUserId,
      action: "mockup_account_converted_from_existing",
      entityType: "user",
      entityId: userId,
      metadata: {
        previousEmail: currentEmail,
        newEmail: changeEmail ? requestedEmail : currentEmail,
        emailChanged: changeEmail,
        clearedStripeAccountId: asText(profile.stripe_account_id),
        accountType: profile.account_type
      }
    });
  } catch (auditError) {
    console.warn("[mockups] convert audit failed:", auditError instanceof Error ? auditError.message : auditError);
  }

  const [row] = await mapMockupRows([
    {
      id: userId,
      full_name: profile.full_name,
      username: profile.username,
      account_type: profile.account_type,
      verification_status: "approved",
      can_publish: true,
      company_setup_complete: true,
      is_mockup: true,
      mockup_created_at: convertedAt,
      mockup_converted_at: null,
      mockup_metadata: metadata
    }
  ]);

  return row;
}

export async function restoreAccountFromMockup(input: MockupAccountActionInput) {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Service role key not configured.");
  }

  const userId = input.userId.trim();
  const profile = await getProfileForConversion(supabase, userId);

  if (profile.is_mockup !== true) {
    throw new Error("This account is not an active mockup.");
  }

  const metadata = asMetadata(profile.mockup_metadata);

  if (metadata.converted_from_existing !== true) {
    throw new Error("Only accounts converted from an existing account can be restored. Use delete for demo mockups.");
  }

  const mockupEmail = await getAuthEmailForUser(supabase, userId);
  const originalEmail = asText(metadata.original_email);
  const originalStripe = asText(metadata.original_stripe_account_id);
  // Only touch the auth email if the conversion actually changed it. Re-setting an
  // unchanged email (e.g. a Google account kept its original address) can fail.
  const restoreEmail = Boolean(originalEmail) && originalEmail!.toLowerCase() !== mockupEmail.toLowerCase();

  const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
    ...(restoreEmail ? { email: originalEmail!, email_confirm: true } : {}),
    user_metadata: { is_mockup: false }
  });

  if (emailError) {
    throw new Error(`Could not restore the account email: ${describeAuthError(emailError)}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      is_mockup: false,
      mockup_created_at: null,
      mockup_created_by_admin_user_id: null,
      mockup_converted_at: null,
      mockup_metadata: {},
      stripe_account_id: originalStripe,
      charges_enabled: asBoolean(metadata.original_charges_enabled),
      payouts_enabled: asBoolean(metadata.original_payouts_enabled),
      stripe_transfers_enabled: asBoolean(metadata.original_stripe_transfers_enabled),
      verification_status: asText(metadata.original_verification_status) ?? profile.verification_status ?? null,
      can_publish:
        typeof metadata.original_can_publish === "boolean" ? metadata.original_can_publish : profile.can_publish ?? null,
      company_setup_complete:
        typeof metadata.original_company_setup_complete === "boolean"
          ? metadata.original_company_setup_complete
          : profile.company_setup_complete ?? null
    })
    .eq("id", userId);

  if (profileError) {
    // Roll the email back to the mockup address so the account is not left half-restored.
    if (restoreEmail) {
      await supabase.auth.admin
        .updateUserById(userId, { email: mockupEmail, email_confirm: true, user_metadata: { is_mockup: true } })
        .catch(() => undefined);
    }

    throw new Error(`Profile error: ${profileError.message}`);
  }

  if (restoreEmail && originalEmail) {
    await updateBusinessDetailsEmail(supabase, userId, originalEmail);
  }

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: input.adminUserId,
      action: "mockup_account_restored",
      entityType: "user",
      entityId: userId,
      metadata: {
        mockupEmail,
        restoredEmail: originalEmail,
        restoredStripeAccountId: originalStripe,
        accountType: profile.account_type
      }
    });
  } catch (auditError) {
    console.warn("[mockups] restore audit failed:", auditError instanceof Error ? auditError.message : auditError);
  }

  return {
    userId,
    email: originalEmail ?? mockupEmail,
    restoredStripeAccountId: originalStripe
  };
}
