import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { convertAccountToMockup } from "@/services/mockups-service";

interface ConvertPayload {
  userId?: string;
  email?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getActiveAdminSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as ConvertPayload;
    const userId = payload.userId?.trim();
    const email = payload.email?.trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const account = await convertAccountToMockup({
      userId,
      // Optional: when empty the account keeps its current login email.
      newEmail: email || null,
      adminUserId: session.userId
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to convert account to mockup.";
    console.error("[mockups:convert]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
