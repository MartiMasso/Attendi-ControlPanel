import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const BUCKET = "backgrounds";

export async function GET() {
  try {
    const session = await getActiveAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 200,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const files = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
    const backgrounds = files.map((f) => ({
      name: f.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl
    }));

    return NextResponse.json({ backgrounds });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)) || "Unexpected error";
    console.error("[list-backgrounds]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
