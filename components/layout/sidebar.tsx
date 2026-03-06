"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BookCheck,
  ClipboardList,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/verifications", label: "Verifications", icon: ShieldCheck },
  { href: "/reservations", label: "Reservations", icon: ClipboardList },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/audit-logs", label: "Audit Logs", icon: BookCheck },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <nav className="mb-3 flex gap-2 overflow-x-auto rounded-xl border border-border bg-surface-elevated p-2 lg:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
                active ? "bg-primary text-white" : "bg-surface-muted text-text-muted"
              )}
            >
              {item.label}
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

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-surface-muted hover:text-text"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
