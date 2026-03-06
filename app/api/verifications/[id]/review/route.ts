import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";

interface Payload {
  decision?: "approve" | "reject";
  note?: string | null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;

  if (!payload.decision || !["approve", "reject"].includes(payload.decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: verification, error: verificationError } = await supabase
    .from("verification_requests")
    .select("id,user_id,requested_account_type")
    .eq("id", params.id)
    .maybeSingle();

  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 500 });
  }

  if (!verification) {
    return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
  }

  const nextStatus = payload.decision === "approve" ? "approved" : "rejected";

  const { error: updateVerificationError } = await supabase
    .from("verification_requests")
    .update({
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.userId,
      review_note: payload.note ?? null,
      rejected_reason: payload.decision === "reject" ? payload.note ?? null : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id);

  if (updateVerificationError) {
    return NextResponse.json({ error: updateVerificationError.message }, { status: 500 });
  }

  const profileUpdate =
    payload.decision === "approve"
      ? {
          account_type: verification.requested_account_type,
          verification_status: "approved"
        }
      : {
          verification_status: "rejected"
        };

  const { error: profileUpdateError } = await supabase.from("profiles").update(profileUpdate).eq("id", verification.user_id);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  await createAuditLogEntry(supabase, {
    adminUserId: session.userId,
    action: payload.decision === "approve" ? "verification_approved" : "verification_rejected",
    entityType: "verification",
    entityId: params.id,
    metadata: {
      reviewedUserId: verification.user_id,
      requestedAccountType: verification.requested_account_type,
      note: payload.note ?? null
    }
  });

  return NextResponse.json({ success: true, status: nextStatus });
}
