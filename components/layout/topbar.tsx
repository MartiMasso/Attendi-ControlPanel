"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  verifications: "Verifications",
  reservations: "Reservations",
  incidents: "Incidents",
  "audit-logs": "Audit Logs",
  settings: "Settings"
};

export function Topbar({ displayName, role }: { displayName: string; role: string }) {
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
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-text-muted">Attendi Internal</p>
          <h1 className="text-lg font-semibold text-text">{currentSection}</h1>
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
          <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-right">
            <p className="text-sm font-semibold text-text">{displayName}</p>
            <p className="text-xs uppercase tracking-[0.06em] text-text-muted">{role}</p>
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
