"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  "business-performance": "Business Performance",
  users: "Users",
  verifications: "Verifications",
  reservations: "Reservations",
  incidents: "Incidents",
  feedback: "Feedback",
  "audit-logs": "Audit Logs",
  settings: "Settings",
  "internal-hub": "Team Management"
};

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Topbar({
  displayName,
  role,
  pendingFeedbackCount
}: {
  displayName: string;
  role: string;
  pendingFeedbackCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const currentSection = useMemo(() => {
    const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
    return routeTitles[segment] ?? "Attendi Control Panel";
  }, [pathname]);

  const handleLogout = () => {
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-text md:text-[1.7rem]">{currentSection}</h1>
            {pendingFeedbackCount > 0 ? <Badge color="warning">{pendingFeedbackCount} new feedback</Badge> : null}
          </div>
          <div className="mt-1 h-1 w-10 rounded-full bg-primary/70" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden w-64 md:block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Quick search"
              className="pl-9"
              aria-label="Quick search"
            />
          </div>
          <div className="flex h-10 items-center gap-2 rounded-full border border-white/70 bg-white/75 py-1 pl-1.5 pr-3 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound size={15} aria-hidden="true" />
            </span>
            <div className="min-w-0 text-left leading-tight">
              <p className="max-w-32 truncate text-sm font-semibold text-text">{displayName}</p>
              <p className="max-w-32 truncate text-[11px] font-medium text-text-muted">{formatRole(role)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={isPending}>
            <LogOut size={14} />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
