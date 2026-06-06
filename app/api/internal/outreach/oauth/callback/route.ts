import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { OUTREACH_MAILBOX } from "@/components/internal-hub/outreach-shared";
import { exchangeCodeForTokens, getGmailProfileEmail, GMAIL_SCOPES } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getActiveAdminSession();
  const url = new URL(request.url);
  const hubUrl = `${url.origin}/internal-hub`;

  if (!session) {
    return NextResponse.redirect(`${hubUrl}?gmail=error`);
  }

  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) {
    return NextResponse.redirect(`${hubUrl}?gmail=error`);
  }

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT?.trim() || `${url.origin}/api/internal/outreach/oauth/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refreshToken) {
      // No refresh token returned (consent not re-granted). Ask to reconnect.
      return NextResponse.redirect(`${hubUrl}?gmail=error`);
    }

    const email = (await getGmailProfileEmail(tokens.accessToken)) ?? OUTREACH_MAILBOX;

    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.redirect(`${hubUrl}?gmail=error`);
    }

    const { error } = await supabase.from("internal_hub_email_account").upsert({
      id: "primary",
      email,
      refresh_token: tokens.refreshToken,
      scope: GMAIL_SCOPES,
      connected_by_user_id: session.userId,
      updated_at: new Date().toISOString()
    });

    if (error) {
      return NextResponse.redirect(`${hubUrl}?gmail=error`);
    }

    return NextResponse.redirect(`${hubUrl}?gmail=connected`);
  } catch {
    return NextResponse.redirect(`${hubUrl}?gmail=error`);
  }
}
