import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import type { MockupAccountType } from "@/lib/mockups";
import { createMockupAccount, listMockupAccounts } from "@/services/mockups-service";

interface CreateMockupPayload {
  accountType?: MockupAccountType;
  displayName?: string;
  username?: string;
}

export async function GET() {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await listMockupAccounts();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list mockup accounts.";
    console.error("[mockups:get]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as CreateMockupPayload;
    const accountType = payload.accountType === "business" ? "business" : payload.accountType === "hotel" ? "hotel" : null;
    const displayName = payload.displayName?.trim();

    if (!accountType) {
      return NextResponse.json({ error: "accountType must be hotel or business." }, { status: 400 });
    }

    if (!displayName) {
      return NextResponse.json({ error: "displayName is required." }, { status: 400 });
    }

    const account = await createMockupAccount({
      accountType,
      displayName,
      username: payload.username,
      createdByAdminUserId: session.userId
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create mockup account.";
    console.error("[mockups:post]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
