import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { OUTREACH_MAILBOX } from "@/components/internal-hub/outreach-shared";
import { getGoogleOAuthConfig, GMAIL_SCOPES } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = getGoogleOAuthConfig();
  if (!clientId) {
    return NextResponse.json({ error: "Falta GOOGLE_CLIENT_ID en el entorno." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT?.trim() || `${origin}/api/internal/outreach/oauth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: OUTREACH_MAILBOX
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
