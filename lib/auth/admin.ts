import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import type { AdminRecord } from "@/types";

export interface ActiveAdminSession {
  userId: string;
  email: string;
  admin: AdminRecord;
  displayName: string;
}

export async function getActiveAdminSession(): Promise<ActiveAdminSession | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id,user_id,role,permissions,is_active,created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError && !isMissingDatabaseObject(profileError)) {
    throw new Error(profileError.message);
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    admin: admin as AdminRecord,
    displayName: (profile?.full_name as string | null) ?? (profile?.username as string | null) ?? user.email ?? "Admin"
  };
}

export async function requireActiveAdmin() {
  const session = await getActiveAdminSession();

  if (!session) {
    redirect("/login?error=unauthorized");
  }

  return session;
}
