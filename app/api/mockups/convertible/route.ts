import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { findConvertibleAccounts } from "@/services/mockups-service";

export async function GET(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const accounts = await findConvertibleAccounts(query);

    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search accounts.";
    console.error("[mockups:convertible]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
