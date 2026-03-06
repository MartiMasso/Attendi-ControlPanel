import type { PostgrestError } from "@supabase/supabase-js";

export function isMissingRelationError(error: PostgrestError | null) {
  return Boolean(error && error.code === "42P01");
}

export function isMissingColumnError(error: PostgrestError | null) {
  return Boolean(error && error.code === "42703");
}

export function isMissingDatabaseObject(error: PostgrestError | null) {
  return isMissingRelationError(error) || isMissingColumnError(error);
}

export function isPermissionError(error: PostgrestError | null) {
  if (!error) {
    return false;
  }

  return error.code === "42501" || error.code === "PGRST301" || /permission denied|not allowed|forbidden/i.test(error.message);
}
