import { OutreachWorkspace } from "@/components/internal-hub/outreach-workspace";
import { listInternalCompanyContacts } from "@/services/internal-hub-service";

export default async function InternalHubPage() {
  const contacts = await listInternalCompanyContacts();

  return (
    <div className="space-y-5">
      <OutreachWorkspace initialContacts={contacts} />
    </div>
  );
}
