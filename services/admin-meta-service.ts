import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import type { AdminFlag, AdminNote } from "@/types";

export async function getAdminNotes(entityType: string, entityId: string): Promise<AdminNote[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("admin_notes")
    .select("id,entity_type,entity_id,note,created_by_admin_id,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as AdminNote[];
}

export async function getAdminFlags(entityType: string, entityId: string): Promise<AdminFlag[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("admin_flags")
    .select("id,entity_type,entity_id,flag_type,severity,reason,is_active,created_by_admin_id,created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as AdminFlag[];
}

export async function insertAdminNote(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    note: string;
    createdByAdminId: string;
  }
) {
  const { error } = await supabase.from("admin_notes").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    note: input.note,
    created_by_admin_id: input.createdByAdminId
  });

  if (error && !isMissingDatabaseObject(error)) {
    throw new Error(error.message);
  }
}

export async function insertAdminFlag(
  supabase: SupabaseClient,
  input: {
    entityType: string;
    entityId: string;
    flagType: string;
    severity: "low" | "medium" | "high";
    reason: string;
    createdByAdminId: string;
  }
) {
  const { error } = await supabase.from("admin_flags").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    flag_type: input.flagType,
    severity: input.severity,
    reason: input.reason,
    created_by_admin_id: input.createdByAdminId,
    is_active: true
  });

  if (error && !isMissingDatabaseObject(error)) {
    throw new Error(error.message);
  }
}
