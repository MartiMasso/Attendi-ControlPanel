import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { sendVerificationEmail } from "@/lib/email-delivery";
import { mapVerificationDecisionToStatus } from "@/lib/verification-requests";
import { createVerificationEmailPreview, createVerificationEmailPreviewFromContent } from "@/lib/verification-email";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";
import { getEmailMapByUserIds } from "@/services/profile-helpers";
import type { VerificationRequestDecision } from "@/types";

interface Payload {
  decision?: VerificationRequestDecision;
  note?: string | null;
  sendEmail?: boolean;
  emailSubject?: string | null;
  emailHeading?: string | null;
  emailBodyText?: string | null;
}

interface ReviewRouteContext {
  params: { id: string };
}

function normalizeNote(note: unknown) {
  if (typeof note !== "string") {
    return null;
  }

  const trimmed = note.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to process verification request.";
}

function getEmailAction(decision: VerificationRequestDecision) {
  if (decision === "approve") {
    return "verification_approved_email_sent";
  }

  if (decision === "reject") {
    return "verification_rejected_email_sent";
  }

  return "verification_needs_changes_email_sent";
}

function getEmailAttemptAction(decision: VerificationRequestDecision, status: "not_configured" | "failed" | "skipped") {
  const suffix = status === "not_configured" ? "email_not_configured" : status === "skipped" ? "email_skipped" : "email_failed";

  if (decision === "approve") {
    return `verification_approved_${suffix}`;
  }

  if (decision === "reject") {
    return `verification_rejected_${suffix}`;
  }

  return `verification_needs_changes_${suffix}`;
}

async function updateReviewNote(
  requestId: string,
  values: Record<string, unknown>,
  note: string | null,
  supabase: SupabaseClient
) {
  const withReviewNotes = await supabase
    .from("verification_requests")
    .update({
      ...values,
      review_notes: note
    })
    .eq("id", requestId);

  if (!withReviewNotes.error) {
    return null;
  }

  if (!isMissingColumnError(withReviewNotes.error)) {
    return withReviewNotes.error;
  }

  const withLegacyReviewNote = await supabase
    .from("verification_requests")
    .update({
      ...values,
      review_note: note
    })
    .eq("id", requestId);

  return withLegacyReviewNote.error;
}

async function updateEmailMetadata(
  requestId: string,
  values: { last_admin_email_sent_at?: string; last_email_action: string },
  supabase: SupabaseClient
) {
  const result = await supabase.from("verification_requests").update(values).eq("id", requestId);

  if (!result.error || isMissingColumnError(result.error)) {
    return null;
  }

  return result.error.message;
}

async function getProfileSnapshot(userId: string, supabase: SupabaseClient) {
  const withCanPublish = await supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status,can_publish")
    .eq("id", userId)
    .maybeSingle();

  if (!withCanPublish.error) {
    return {
      snapshot: withCanPublish.data
        ? {
            full_name: (withCanPublish.data.full_name as string | null) ?? null,
            username: (withCanPublish.data.username as string | null) ?? null,
            account_type: (withCanPublish.data.account_type as string | null) ?? null,
            verification_status: (withCanPublish.data.verification_status as string | null) ?? null,
            can_publish:
              typeof withCanPublish.data.can_publish === "boolean" ? (withCanPublish.data.can_publish as boolean) : null
          }
        : null,
      error: null as string | null
    };
  }

  if (!isMissingColumnError(withCanPublish.error)) {
    return { snapshot: null, error: withCanPublish.error.message };
  }

  const withoutCanPublish = await supabase
    .from("profiles")
    .select("id,full_name,username,account_type,verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (withoutCanPublish.error) {
    return { snapshot: null, error: withoutCanPublish.error.message };
  }

  return {
    snapshot: withoutCanPublish.data
      ? {
          full_name: (withoutCanPublish.data.full_name as string | null) ?? null,
          username: (withoutCanPublish.data.username as string | null) ?? null,
          account_type: (withoutCanPublish.data.account_type as string | null) ?? null,
          verification_status: (withoutCanPublish.data.verification_status as string | null) ?? null,
          can_publish: null
        }
      : null,
    error: null as string | null
  };
}

function getProfileUpdateValues(decision: VerificationRequestDecision, requestedAccountType: string) {
  if (decision === "approve") {
    return {
      account_type: requestedAccountType === "hotel" ? "hotel" : "business",
      verification_status: "approved",
      can_publish: true
    };
  }

  if (decision === "reject") {
    return {
      verification_status: "rejected",
      can_publish: false
    };
  }

  return null;
}

function profileMatchesDecision(
  snapshot: { account_type: string | null; verification_status: string | null } | null,
  decision: VerificationRequestDecision,
  requestedAccountType: string
) {
  if (!snapshot) {
    return false;
  }

  if (decision === "approve") {
    const expectedType = requestedAccountType === "hotel" ? "hotel" : "business";
    return snapshot.account_type === expectedType && snapshot.verification_status === "approved";
  }

  if (decision === "reject") {
    return snapshot.verification_status === "rejected";
  }

  return true;
}

async function updateProfileForReviewDecision(userId: string, values: Record<string, unknown>, supabase: SupabaseClient) {
  const withCanPublish = await supabase.from("profiles").update(values).eq("id", userId);

  if (!withCanPublish.error) {
    return null;
  }

  if (!isMissingColumnError(withCanPublish.error)) {
    return withCanPublish.error.message;
  }

  const fallbackValues = { ...values };
  delete fallbackValues.can_publish;

  const withoutCanPublish = await supabase.from("profiles").update(fallbackValues).eq("id", userId);
  if (withoutCanPublish.error) {
    return withoutCanPublish.error.message;
  }

  return null;
}

async function getRecipientEmail(userId: string, fallbackEmail: string | null) {
  const emailMap = await getEmailMapByUserIds([userId]).catch(() => new Map<string, string>());
  return normalizeEmail(emailMap.get(userId)) ?? normalizeEmail(fallbackEmail);
}

async function handlePost(request: Request, { params }: ReviewRouteContext) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  if (!payload.decision || !["approve", "reject", "needs_changes"].includes(payload.decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const serviceClient = createSupabaseServiceClient();
  const supabase = serviceClient ?? createSupabaseServerClient();

  const { data: verification, error: verificationError } = await supabase
    .from("verification_requests")
    .select("id,user_id,requested_account_type,status,legal_name,company_email,reviewed_at,reviewed_by,rejected_reason,updated_at")
    .eq("id", params.id)
    .maybeSingle();

  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 500 });
  }

  if (!verification) {
    if (!serviceClient) {
      const viewProbe = await supabase
        .from("admin_verification_requests_v1")
        .select("request_id")
        .eq("request_id", params.id)
        .maybeSingle();

      if (viewProbe.data) {
        return NextResponse.json(
          {
            error:
              "Verification request is visible in admin queue but cannot be reviewed with current DB permissions. Configure SUPABASE_SERVICE_ROLE_KEY or add admin update/select policy on verification_requests."
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
  }

  const userId = String(verification.user_id);
  const requestedAccountType = String(verification.requested_account_type ?? "business").toLowerCase();
  const profileSnapshotResult = await getProfileSnapshot(userId, supabase);

  if (profileSnapshotResult.error) {
    return NextResponse.json({ error: profileSnapshotResult.error }, { status: 500 });
  }

  if (!profileSnapshotResult.snapshot) {
    return NextResponse.json({ error: "User profile not found for this verification request." }, { status: 404 });
  }

  const previousProfile = profileSnapshotResult.snapshot;
  const note = normalizeNote(payload.note);
  const emailSubject = normalizeNote(payload.emailSubject);
  const emailHeading = normalizeNote(payload.emailHeading);
  const emailBodyText = normalizeNote(payload.emailBodyText);
  const warnings: string[] = [];
  const nextStatus = mapVerificationDecisionToStatus(payload.decision);
  const reviewedAt = new Date().toISOString();
  const updateError = await updateReviewNote(
    params.id,
    {
      status: nextStatus,
      reviewed_at: reviewedAt,
      reviewed_by: session.userId,
      rejected_reason: payload.decision === "reject" ? note : null,
      updated_at: reviewedAt
    },
    note,
    supabase
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const profileUpdateValues = getProfileUpdateValues(payload.decision, requestedAccountType);
  const profileAfterRequest = await getProfileSnapshot(userId, supabase);
  if (profileAfterRequest.error) {
    return NextResponse.json({ error: profileAfterRequest.error }, { status: 500 });
  }

  let updatedProfile = profileAfterRequest.snapshot ?? previousProfile;

  if (profileUpdateValues && !profileMatchesDecision(updatedProfile, payload.decision, requestedAccountType)) {
    const profileSyncError = await updateProfileForReviewDecision(userId, profileUpdateValues, supabase);
    const profileAfterSync = await getProfileSnapshot(userId, supabase);

    if (profileAfterSync.error) {
      return NextResponse.json({ error: profileAfterSync.error }, { status: 500 });
    }

    updatedProfile = profileAfterSync.snapshot ?? updatedProfile;

    if (!profileMatchesDecision(updatedProfile, payload.decision, requestedAccountType)) {
      if (profileSyncError && /stack depth limit exceeded/i.test(profileSyncError)) {
        return NextResponse.json(
          {
            error:
              "Profile sync failed due recursive DB trigger/function (stack depth limit exceeded). Verification request was saved, but profile could not be synced. Review DB triggers on profiles/verification_requests."
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: profileSyncError
            ? `Profile sync failed: ${profileSyncError}`
            : "Profile sync did not apply expected account_type / verification_status values."
        },
        { status: 500 }
      );
    }
  }

  const shouldSendEmail = payload.sendEmail !== false;
  const recipientEmail = shouldSendEmail ? await getRecipientEmail(userId, (verification.company_email as string | null) ?? null) : null;
  const defaultEmailPreview = createVerificationEmailPreview({
    decision: payload.decision,
    recipientName: updatedProfile?.full_name ?? updatedProfile?.username ?? null,
    companyName: (verification.legal_name as string | null) ?? null,
    requestedAccountType
  });
  const emailPreview =
    shouldSendEmail && recipientEmail
      ? createVerificationEmailPreviewFromContent({
          subject: emailSubject ?? defaultEmailPreview.subject,
          heading: emailHeading ?? defaultEmailPreview.heading,
          preheader: emailSubject ?? defaultEmailPreview.preheader,
          bodyText: emailBodyText ?? defaultEmailPreview.bodyText
        })
      : null;
  let emailResult: {
    requested: boolean;
    sent: boolean;
    status: "sent" | "not_configured" | "failed" | "skipped";
    recipient: string | null;
    subject: string | null;
    error: string | null;
  } = {
    requested: shouldSendEmail,
    sent: false,
    status: shouldSendEmail ? "failed" : "skipped",
    recipient: recipientEmail,
    subject: emailPreview?.subject ?? null,
    error: null
  };

  if (shouldSendEmail && !recipientEmail) {
    emailResult = {
      ...emailResult,
      status: "skipped",
      error: "No recipient email found for this user."
    };
    warnings.push("Solicitud actualizada, pero no se ha encontrado un email de destino para notificar al usuario.");
    const metadataError = await updateEmailMetadata(
      params.id,
      { last_email_action: getEmailAttemptAction(payload.decision, "skipped") },
      supabase
    );

    if (metadataError) {
      warnings.push(`No se pudo actualizar la metadata del email: ${metadataError}`);
    }
  } else if (shouldSendEmail && emailPreview && recipientEmail) {
    try {
      const delivery = await sendVerificationEmail({ to: recipientEmail, preview: emailPreview });
      emailResult = {
        requested: true,
        sent: delivery.status === "sent",
        status: delivery.status,
        recipient: recipientEmail,
        subject: emailPreview.subject,
        error: delivery.message
      };

      if (delivery.status === "sent") {
        const metadataError = await updateEmailMetadata(
          params.id,
          {
            last_admin_email_sent_at: new Date().toISOString(),
            last_email_action: getEmailAction(payload.decision)
          },
          supabase
        );

        if (metadataError) {
          warnings.push(`Email enviado, pero no se pudo actualizar la metadata del email: ${metadataError}`);
        }
      } else if (delivery.message) {
        const metadataError = await updateEmailMetadata(
          params.id,
          { last_email_action: getEmailAttemptAction(payload.decision, delivery.status) },
          supabase
        );

        if (metadataError) {
          warnings.push(`No se pudo actualizar la metadata del email: ${metadataError}`);
        }

        warnings.push(`Solicitud actualizada, pero el email no se ha enviado: ${delivery.message}`);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      emailResult = {
        requested: true,
        sent: false,
        status: "failed",
        recipient: recipientEmail,
        subject: emailPreview.subject,
        error: message
      };
      const metadataError = await updateEmailMetadata(
        params.id,
        { last_email_action: getEmailAttemptAction(payload.decision, "failed") },
        supabase
      );

      if (metadataError) {
        warnings.push(`No se pudo actualizar la metadata del email: ${metadataError}`);
      }

      warnings.push(`Solicitud actualizada, pero el email no se ha enviado: ${message}`);
    }
  }

  try {
    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action:
        payload.decision === "approve"
          ? "verification_approved"
          : payload.decision === "reject"
            ? "verification_rejected"
            : "verification_needs_changes",
      entityType: "verification",
      entityId: params.id,
      metadata: {
        reviewedUserId: userId,
        previousStatus: verification.status,
        nextStatus,
        requestedAccountType: verification.requested_account_type,
        note,
        emailSubject: emailPreview?.subject ?? emailSubject,
        emailHeading: emailPreview?.heading ?? emailHeading,
        emailBodyText: emailPreview?.bodyText ?? emailBodyText,
        email: emailResult,
        previousProfileAccountType: previousProfile.account_type,
        nextProfileAccountType: updatedProfile?.account_type ?? previousProfile.account_type,
        previousProfileVerificationStatus: previousProfile.verification_status,
        nextProfileVerificationStatus: updatedProfile?.verification_status ?? previousProfile.verification_status
      }
    });
  } catch (error) {
    warnings.push(`Solicitud actualizada, pero no se pudo crear el audit log: ${getErrorMessage(error)}`);
  }

  return NextResponse.json({
    success: true,
    status: nextStatus,
    profileAccountType: updatedProfile?.account_type ?? previousProfile.account_type,
    profileVerificationStatus: updatedProfile?.verification_status ?? previousProfile.verification_status,
    email: emailResult,
    warnings
  });
}

export async function POST(request: Request, context: ReviewRouteContext) {
  try {
    return await handlePost(request, context);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
