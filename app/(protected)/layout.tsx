import { AppShell } from "@/components/layout/app-shell";
import { requireActiveAdmin } from "@/lib/auth/admin";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireActiveAdmin();

  return <AppShell displayName={session.displayName} role={session.admin.role}>{children}</AppShell>;
}
