import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { deleteMockupAccount } from "@/services/mockups-service";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = params.id?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing mockup user id." }, { status: 400 });
    }

    const deleted = await deleteMockupAccount({
      userId,
      adminUserId: session.userId
    });

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete mockup account.";
    console.error("[mockups:delete]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
