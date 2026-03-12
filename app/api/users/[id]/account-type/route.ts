import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuditLogEntry } from "@/services/audit-log-service";
import { updateUserAccountType } from "@/services/users-service";
import type { AccountType } from "@/types";

interface Payload {
  accountType?: AccountType;
}

const VALID_ACCOUNT_TYPES = new Set<AccountType>(["consumer", "business", "hotel"]);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getActiveAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;

  if (!payload.accountType || !VALID_ACCOUNT_TYPES.has(payload.accountType)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  try {
    const result = await updateUserAccountType(params.id, payload.accountType);

    const supabase = createSupabaseServerClient();
    await createAuditLogEntry(supabase, {
      adminUserId: session.userId,
      action: "user_account_type_changed",
      entityType: "user",
      entityId: params.id,
      metadata: {
        previousAccountType: result.previousAccountType,
        nextAccountType: result.nextAccountType,
        previousVerificationStatus: result.previousVerificationStatus,
        nextVerificationStatus: result.nextVerificationStatus
      }
    });

    return NextResponse.json({
      success: true,
      accountType: result.nextAccountType,
      verificationStatus: result.nextVerificationStatus
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update account type" }, { status: 500 });
  }
}
