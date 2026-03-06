import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";

export async function GET() {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    authorized: true,
    admin: {
      userId: session.userId,
      role: session.admin.role
    }
  });
}
