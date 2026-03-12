import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  children,
  displayName,
  role,
  hasPendingVerifications
}: {
  children: React.ReactNode;
  displayName: string;
  role: string;
  hasPendingVerifications: boolean;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar hasPendingVerifications={hasPendingVerifications} />
      <div className="min-h-screen flex-1">
        <Topbar displayName={displayName} role={role} />
        <main className="mx-auto w-full max-w-[1400px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
