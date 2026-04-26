import type { VerificationEmailPreview } from "@/lib/verification-email";

export type EmailDeliveryStatus = "sent" | "not_configured" | "failed";

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus;
  message: string | null;
}

interface SendEmailInput {
  to: string;
  preview: VerificationEmailPreview;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export async function sendVerificationEmail({ to, preview }: SendEmailInput): Promise<EmailDeliveryResult> {
  const apiKey = normalizeEmail(process.env.RESEND_API_KEY);
  const from = normalizeEmail(process.env.VERIFICATION_EMAIL_FROM) ?? normalizeEmail(process.env.EMAIL_FROM);
  const replyTo = normalizeEmail(process.env.VERIFICATION_EMAIL_REPLY_TO);

  if (!apiKey || !from) {
    return {
      status: "not_configured",
      message: "Email no enviado: faltan RESEND_API_KEY y VERIFICATION_EMAIL_FROM."
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: preview.subject,
      html: preview.html,
      text: preview.bodyText,
      ...(replyTo ? { reply_to: replyTo } : {})
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    return {
      status: "failed",
      message: payload?.message ?? payload?.error ?? `El proveedor de email devolvió ${response.status}.`
    };
  }

  return {
    status: "sent",
    message: null
  };
}
