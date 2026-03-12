import { AppShell } from "@/components/layout/app-shell";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { hasPendingVerificationRequests } from "@/services/verifications-service";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [session, hasPendingVerifications] = await Promise.all([
    requireActiveAdmin(),
    hasPendingVerificationRequests()
  ]);

  return (
    <AppShell displayName={session.displayName} role={session.admin.role} hasPendingVerifications={hasPendingVerifications}>
      {children}
    </AppShell>
  );
}
