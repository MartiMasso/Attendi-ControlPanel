import { AppShell } from "@/components/layout/app-shell";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { countNewPlatformFeedback } from "@/services/platform-feedback-service";
import { hasPendingVerificationRequests } from "@/services/verifications-service";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [session, hasPendingVerifications, pendingFeedbackCount] = await Promise.all([
    requireActiveAdmin(),
    hasPendingVerificationRequests(),
    countNewPlatformFeedback().catch(() => 0)
  ]);

  return (
    <AppShell
      displayName={session.displayName}
      role={session.admin.role}
      hasPendingVerifications={hasPendingVerifications}
      pendingFeedbackCount={pendingFeedbackCount}
    >
      {children}
    </AppShell>
  );
}
