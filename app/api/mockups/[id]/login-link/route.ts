import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createMockupLoginLink } from "@/services/mockups-service";

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

    const link = await createMockupLoginLink({
      userId,
      adminUserId: session.userId
    });

    return NextResponse.json({ success: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create mockup login link.";
    console.error("[mockups:login-link]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
