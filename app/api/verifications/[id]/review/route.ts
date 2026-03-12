import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { mapVerificationDecisionToStatus } from "@/lib/verification-requests";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createAuditLogEntry } from "@/services/audit-log-service";
import type { VerificationRequestDecision } from "@/types";

interface Payload {
  decision?: VerificationRequestDecision;
  note?: string | null;
}

function normalizeNote(note: unknown) {
  if (typeof note !== "string") {
    return null;
  }

  const trimmed = note.trim();
  return trimmed.length ? trimmed : null;
}

async function updateReviewNote(
  requestId: string,
  values: Record<string, unknown>,
  note: string | null,
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceClient>>
) {
  const withReviewNotes = await serviceClient
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

  const withLegacyReviewNote = await serviceClient
    .from("verification_requests")
    .update({
      ...values,
      review_note: note
    })
    .eq("id", requestId);

  return withLegacyReviewNote.error;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  if (!payload.decision || !["approve", "reject", "needs_changes"].includes(payload.decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for verification review actions." },
      { status: 500 }
    );
  }

  const { data: verification, error: verificationError } = await serviceClient
    .from("verification_requests")
    .select("id,user_id,requested_account_type,status")
    .eq("id", params.id)
    .maybeSingle();

  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 500 });
  }

  if (!verification) {
    return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
  }

  const note = normalizeNote(payload.note);
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
    serviceClient
  );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await createAuditLogEntry(serviceClient, {
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
      reviewedUserId: verification.user_id,
      previousStatus: verification.status,
      nextStatus,
      requestedAccountType: verification.requested_account_type,
      note
    }
  });

  return NextResponse.json({ success: true, status: nextStatus });
}
