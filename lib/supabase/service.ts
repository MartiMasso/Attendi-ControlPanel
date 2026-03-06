import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, getSupabaseConfig } from "@/lib/config";

export function createSupabaseServiceClient() {
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    return null;
  }

  const { url } = getSupabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
