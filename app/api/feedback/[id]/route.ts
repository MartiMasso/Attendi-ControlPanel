import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createAuditLogEntry } from "@/services/audit-log-service";
import {
  PLATFORM_FEEDBACK_STATUSES,
  getPlatformFeedbackAdminClient
} from "@/services/platform-feedback-service";
import type { PlatformFeedbackStatus } from "@/types";

interface Payload {
  status?: PlatformFeedbackStatus;
  adminNotes?: string | null;
}

function normalizeOptionalText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const hasStatus = payload.status !== undefined;
  const hasAdminNotes = payload.adminNotes !== undefined;

  if (!hasStatus && !hasAdminNotes) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  if (hasStatus && !PLATFORM_FEEDBACK_STATUSES.includes(payload.status as PlatformFeedbackStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const normalizedAdminNotes = hasAdminNotes ? normalizeOptionalText(payload.adminNotes) : undefined;
  if (hasAdminNotes && normalizedAdminNotes === undefined) {
    return NextResponse.json({ error: "Invalid admin notes." }, { status: 400 });
  }

  try {
    const supabase = getPlatformFeedbackAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("platform_feedback")
      .select("id,status,admin_notes,handled_at,handled_by")
      .eq("id", params.id)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    if (!current) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const nextStatus = hasStatus ? String(payload.status) : String(current.status);

    if (hasStatus && payload.status !== current.status) {
      updates.status = payload.status;

      if (!current.handled_at) {
        updates.handled_at = new Date().toISOString();
        updates.handled_by = session.userId;
      }
    }

    if (hasAdminNotes && normalizedAdminNotes !== current.admin_notes) {
      updates.admin_notes = normalizedAdminNotes;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({
        success: true,
        feedback: current
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("platform_feedback")
      .update(updates)
      .eq("id", params.id)
      .select("id,status,admin_notes,handled_at,handled_by")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "platform_feedback_updated",
      entityType: "platform_feedback",
      entityId: params.id,
      metadata: {
        previousStatus: current.status,
        nextStatus,
        handledAtBefore: current.handled_at,
        handledAtAfter: updated?.handled_at ?? current.handled_at,
        handledByBefore: current.handled_by,
        handledByAfter: updated?.handled_by ?? current.handled_by,
        adminNotesUpdated: hasAdminNotes
      }
    });

    return NextResponse.json({
      success: true,
      feedback: updated ?? current
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update feedback." },
      { status: 500 }
    );
  }
}
