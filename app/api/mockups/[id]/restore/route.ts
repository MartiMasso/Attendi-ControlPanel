import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { restoreAccountFromMockup } from "@/services/mockups-service";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = params.id?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing mockup user id." }, { status: 400 });
    }

    const restored = await restoreAccountFromMockup({
      userId,
      adminUserId: session.userId
    });

    return NextResponse.json({ success: true, restored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to restore account.";
    console.error("[mockups:restore]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
