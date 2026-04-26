import type { VerificationRequestDecision } from "@/types";

export interface VerificationEmailInput {
  decision: VerificationRequestDecision;
  recipientName?: string | null;
  companyName?: string | null;
  requestedAccountType?: string | null;
  customMessage?: string | null;
}

export interface VerificationEmailPreview {
  subject: string;
  heading: string;
  preheader: string;
  bodyText: string;
  html: string;
}

export interface VerificationEmailContentInput {
  subject?: string | null;
  heading?: string | null;
  preheader?: string | null;
  bodyText?: string | null;
}

interface NormalizedVerificationEmailContent {
  subject: string;
  heading: string;
  preheader: string;
  bodyText: string;
}

const decisionCopy: Record<
  VerificationRequestDecision,
  {
    subject: string;
    heading: string;
    preheader: string;
    body: string;
    fallbackMessage: string;
  }
> = {
  approve: {
    subject: "Tu verificación de Attendi ha sido aprobada",
    heading: "Verificación aprobada",
    preheader: "Tu solicitud de verificación ya está aprobada.",
    body: "Hemos revisado tu solicitud de verificación y ha sido aprobada. Tu perfil ya puede operar como cuenta verificada en Attendi.",
    fallbackMessage: "No tienes que hacer nada más por ahora."
  },
  reject: {
    subject: "No hemos podido aprobar tu verificación de Attendi",
    heading: "Solicitud de verificación rechazada",
    preheader: "Hemos revisado tu solicitud de verificación.",
    body: "Hemos revisado tu solicitud de verificación y no hemos podido aprobarla con la información recibida.",
    fallbackMessage: "Puedes enviar una nueva solicitud cuando tengas la documentación o información actualizada."
  },
  needs_changes: {
    subject: "Necesitamos cambios en tu solicitud de verificación",
    heading: "Necesitamos algunos cambios",
    preheader: "Necesitamos información adicional para completar tu verificación.",
    body: "Hemos revisado tu solicitud de verificación y necesitamos información adicional antes de poder aprobarla.",
    fallbackMessage: "Revisa tu solicitud y envíanos la información pendiente para continuar."
  }
};

function normalizeText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphsToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function getAccountTypeLabel(accountType?: string | null) {
  const normalized = normalizeText(accountType)?.toLowerCase();

  if (normalized === "hotel") {
    return "hotel";
  }

  return "empresa";
}

function createEmailHtml({ subject, heading, preheader, bodyText }: NormalizedVerificationEmailContent) {
  const htmlBody = paragraphsToHtml(bodyText);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#0f1723;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d9e1eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 10px;">
                <p style="margin:0 0 12px;color:#125fd6;font-size:14px;font-weight:700;">Attendi</p>
                <h1 style="margin:0;color:#0f1723;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;color:#243044;font-size:15px;line-height:1.65;">
                ${htmlBody}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function createVerificationEmailPreviewFromContent({
  subject,
  heading,
  preheader,
  bodyText
}: VerificationEmailContentInput): VerificationEmailPreview {
  const normalizedSubject = normalizeText(subject) ?? "Actualización sobre tu verificación de Attendi";
  const normalizedHeading = normalizeText(heading) ?? normalizedSubject;
  const normalizedBodyText = normalizeText(bodyText) ?? "";
  const normalizedPreheader = normalizeText(preheader) ?? normalizedSubject;

  return {
    subject: normalizedSubject,
    heading: normalizedHeading,
    preheader: normalizedPreheader,
    bodyText: normalizedBodyText,
    html: createEmailHtml({
      subject: normalizedSubject,
      heading: normalizedHeading,
      preheader: normalizedPreheader,
      bodyText: normalizedBodyText
    })
  };
}

export function createVerificationEmailPreview({
  decision,
  recipientName,
  companyName,
  requestedAccountType,
  customMessage
}: VerificationEmailInput): VerificationEmailPreview {
  const copy = decisionCopy[decision];
  const greeting = normalizeText(recipientName) ? `Hola ${normalizeText(recipientName)}` : "Hola";
  const displayCompany = normalizeText(companyName);
  const accountTypeLabel = getAccountTypeLabel(requestedAccountType);
  const message = normalizeText(customMessage) ?? copy.fallbackMessage;
  const companyLine = displayCompany
    ? `La solicitud corresponde a ${displayCompany} como ${accountTypeLabel}.`
    : `La solicitud corresponde a tu perfil de ${accountTypeLabel}.`;

  const bodyText = [`${greeting},`, copy.body, companyLine, `Mensaje del equipo de Attendi:\n${message}`, "Gracias,\nEquipo de Attendi"].join(
    "\n\n"
  );

  return createVerificationEmailPreviewFromContent({
    subject: copy.subject,
    heading: copy.heading,
    preheader: copy.preheader,
    bodyText
  });
}
