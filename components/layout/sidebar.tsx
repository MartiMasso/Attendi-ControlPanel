"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  BookCheck,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/business-performance", label: "Business Performance", icon: LineChart },
  { href: "/hotels", label: "Hotels", icon: Building2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/verifications", label: "Verifications", icon: ShieldCheck },
  { href: "/reservations", label: "Reservations", icon: ClipboardList },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/audit-logs", label: "Audit Logs", icon: BookCheck },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldAlert },
  { href: "/internal-hub", label: "Contacto", icon: Briefcase }
] as const;

export function Sidebar({
  hasPendingVerifications,
  pendingFeedbackCount
}: {
  hasPendingVerifications: boolean;
  pendingFeedbackCount: number;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="mb-3 flex gap-2 overflow-x-auto rounded-xl border border-border bg-surface-elevated p-2 lg:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isTeamManagement = item.href === "/internal-hub";
          const showPendingIndicator = item.href === "/verifications" && hasPendingVerifications;
          const showFeedbackCount = item.href === "/feedback" && pendingFeedbackCount > 0;

          return (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-medium",
                isTeamManagement
                  ? active
                    ? "bg-[#0f2f6f] text-white"
                    : "bg-[#17468f] text-white active:bg-[#0f2f6f]"
                  : active
                    ? "bg-primary text-white"
                    : "bg-surface-muted text-text-muted"
              )}
            >
              <span>{item.label}</span>
              {showPendingIndicator ? (
                <span className="ml-2 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="sr-only">Pending verification requests</span>
                </span>
              ) : null}
              {showFeedbackCount ? (
                <span className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#ffe8cc] px-1.5 text-[11px] font-semibold text-warning">
                  {pendingFeedbackCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-surface-elevated px-4 py-6 lg:block">
        <div className="mb-8 rounded-xl bg-gradient-to-r from-[#0f3464] to-[#164b8e] p-4 text-white shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em]">
            <Activity size={14} /> Attendi
          </div>
          <p className="mt-2 text-lg font-semibold">Control Panel</p>
          <p className="mt-1 text-xs text-[#c8ddff]">Private internal operations backoffice</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const isTeamManagement = item.href === "/internal-hub";
            const showPendingIndicator = item.href === "/verifications" && hasPendingVerifications;
            const showFeedbackCount = item.href === "/feedback" && pendingFeedbackCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isTeamManagement
                  ? active
                    ? "bg-[#0f2f6f] text-white shadow-[0_8px_16px_rgba(15,47,111,0.35)]"
                    : "bg-[#17468f] text-white shadow-[0_8px_16px_rgba(23,70,143,0.25)] hover:bg-[#123a79] active:bg-[#0f2f6f]"
                  : active
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:bg-surface-muted hover:text-text"
                )}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {showPendingIndicator ? (
                  <span className="ml-auto inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white/50" />
                    <span className="sr-only">Pending verification requests</span>
                  </span>
                ) : null}
                {showFeedbackCount ? (
                  <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ffe8cc] px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                    {pendingFeedbackCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
