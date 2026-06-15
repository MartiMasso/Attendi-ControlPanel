import { MockupsWorkspace } from "@/components/mockups/mockups-workspace";
import { PageHeader } from "@/components/ui/page-header";
import { listMockupAccounts } from "@/services/mockups-service";

// Mockups are created/deleted live from this page, so the listing must never be
// served from Next's static/route cache (otherwise newly created mockups appear
// to vanish when navigating back to the tab). The client also re-fetches on mount.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MockupsPage() {
  const result = await listMockupAccounts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mockups"
        description="Create confirmed hotel and company demo accounts that can log in to the main Attendi app."
      />
      <MockupsWorkspace
        initialRows={result.rows}
        schemaReady={result.schemaReady}
        schemaMessage={result.schemaMessage}
      />
    </div>
  );
}
