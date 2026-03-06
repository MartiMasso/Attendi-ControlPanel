import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveAdmin } from "@/lib/auth/admin";

export default async function SettingsPage() {
  const session = await requireActiveAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Operational settings and access configuration for Attendi Control Panel."
      />

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Current admin session</h2>
        <p className="text-sm text-text-muted">
          Signed in as <span className="font-medium text-text">{session.email}</span>
        </p>
        <p className="text-sm text-text-muted">
          Role: <span className="font-medium text-text">{session.admin.role}</span>
        </p>
        <div>
          <p className="text-sm text-text-muted">Permissions JSON:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
            {JSON.stringify(session.admin.permissions ?? {}, null, 2)}
          </pre>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Configuration notes</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-text-muted">
          <li>Only users listed in `public.admins` with `is_active = true` can access this panel.</li>
          <li>Use `supabase/migrations` to install internal admin tables and RLS policies.</li>
          <li>Optional service role key enables secure server-only user email enrichment.</li>
        </ul>
      </Card>
    </div>
  );
}
