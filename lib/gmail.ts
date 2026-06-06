// Lightweight Gmail API client (no SDK) for the shared outreach mailbox.
// Sends HTML email with optional attachments and supports threading.

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

// Only gmail.send for now (a "sensitive" scope). Reply detection will later add
// gmail.readonly (a "restricted" scope that requires Google verification).
export const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.send";

export function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ""
  };
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}).`);
  }

  const data = (await response.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed (${response.status}).`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function getGmailProfileEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { emailAddress?: string };
  return data.emailAddress ?? null;
}

export interface GmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

interface SendGmailInput {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
  threadId?: string;
}

function encodeHeaderWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return value.replace(/(.{76})/g, "$1\r\n");
}

function buildMimeMessage({ from, to, subject, html, attachments = [] }: Omit<SendGmailInput, "accessToken" | "threadId">) {
  const htmlBase64 = wrapBase64(Buffer.from(html, "utf8").toString("base64"));
  const headers = [`From: ${from}`, `To: ${to}`, `Subject: ${encodeHeaderWord(subject)}`, "MIME-Version: 1.0"];

  if (!attachments.length) {
    return [...headers, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", htmlBase64].join("\r\n");
  }

  const boundary = `attendi_${Math.random().toString(36).slice(2)}`;
  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    htmlBase64
  ];

  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      wrapBase64(attachment.contentBase64)
    );
  }

  parts.push(`--${boundary}--`);
  return parts.join("\r\n");
}

export interface SendGmailResult {
  id: string;
  threadId: string;
}

export async function sendGmailMessage(input: SendGmailInput): Promise<SendGmailResult> {
  const mime = buildMimeMessage(input);
  const raw = Buffer.from(mime, "utf8").toString("base64url");

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gmail send failed (${response.status}). ${detail}`);
  }

  const data = (await response.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}
