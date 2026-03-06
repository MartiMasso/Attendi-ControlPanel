import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isMissingDatabaseObject } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProfileIdentity {
  id: string;
  full_name: string | null;
  username: string;
  account_type: string;
  verification_status: string;
  created_at: string | null;
}

export async function getProfilesMap(userIds: string[]) {
  const map = new Map<string, ProfileIdentity>();

  if (!userIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status,created_at")
    .in("id", userIds);

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  (data ?? []).forEach((profile) => {
    map.set(profile.id as string, profile as ProfileIdentity);
  });

  return map;
}

export async function getEmailMapByUserIds(userIds: string[]) {
  const map = new Map<string, string>();

  if (!userIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();

  const { data: businessDetails, error: businessError } = await supabase
    .from("business_details")
    .select("user_id,email")
    .in("user_id", userIds);

  if (businessError && !isMissingDatabaseObject(businessError)) {
    throw new Error(businessError.message);
  }

  (businessDetails ?? []).forEach((detail) => {
    if (detail.user_id && detail.email) {
      map.set(detail.user_id as string, detail.email as string);
    }
  });

  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return map;
  }

  const users = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await serviceClient.auth.admin.getUserById(userId);

      if (error || !data.user?.email) {
        return null;
      }

      return {
        userId,
        email: data.user.email
      };
    })
  );

  users.forEach((entry) => {
    if (entry) {
      map.set(entry.userId, entry.email);
    }
  });

  return map;
}

export async function getLastSeenMap(userIds: string[]) {
  const map = new Map<string, string>();

  if (!userIds.length) {
    return map;
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_hotel_links")
    .select("user_id,last_seen_at")
    .in("user_id", userIds)
    .not("last_seen_at", "is", null)
    .order("last_seen_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return map;
    }

    throw new Error(error.message);
  }

  (data ?? []).forEach((row) => {
    const userId = row.user_id as string;
    const seen = row.last_seen_at as string | null;

    if (!userId || !seen || map.has(userId)) {
      return;
    }

    map.set(userId, seen);
  });

  return map;
}
