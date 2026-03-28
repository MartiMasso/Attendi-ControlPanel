import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { countNewPlatformFeedback, getLatestPlatformFeedbackCreatedAt } from "@/services/platform-feedback-service";

export async function GET(request: Request) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const after = url.searchParams.get("after");
    const [latestCreatedAt, pendingNewCount] = await Promise.all([
      getLatestPlatformFeedbackCreatedAt(),
      countNewPlatformFeedback()
    ]);

    const hasNewSince = after && latestCreatedAt
      ? new Date(latestCreatedAt).getTime() > new Date(after).getTime()
      : false;

    return NextResponse.json({
      latestCreatedAt,
      pendingNewCount,
      hasNewSince
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check latest feedback." },
      { status: 500 }
    );
  }
}
