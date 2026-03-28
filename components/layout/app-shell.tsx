import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  children,
  displayName,
  role,
  hasPendingVerifications,
  pendingFeedbackCount
}: {
  children: React.ReactNode;
  displayName: string;
  role: string;
  hasPendingVerifications: boolean;
  pendingFeedbackCount: number;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar hasPendingVerifications={hasPendingVerifications} pendingFeedbackCount={pendingFeedbackCount} />
      <div className="min-h-screen flex-1">
        <Topbar displayName={displayName} role={role} pendingFeedbackCount={pendingFeedbackCount} />
        <main className="mx-auto w-full max-w-[1400px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
