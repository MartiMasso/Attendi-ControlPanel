import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject, isPermissionError } from "@/lib/supabase/errors";
import type { AuditLogRow } from "@/types";

interface CreateAuditLogInput {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createAuditLogEntry(
  supabase: SupabaseClient,
  { adminUserId, action, entityType, entityId = null, metadata = null }: CreateAuditLogInput
) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata
  });

  if (error && !isMissingDatabaseObject(error)) {
    throw new Error(error.message);
  }
}

export async function listAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id,admin_user_id,action,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingDatabaseObject(error) || isPermissionError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as AuditLogRow[];
}
