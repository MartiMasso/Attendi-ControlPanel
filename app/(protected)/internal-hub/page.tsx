import { OutreachWorkspace } from "@/components/internal-hub/outreach-workspace";
import { getOutreachEmailAccount, listInternalCompanyContacts } from "@/services/internal-hub-service";

export default async function InternalHubPage() {
  const [contacts, gmailAccount] = await Promise.all([listInternalCompanyContacts(), getOutreachEmailAccount()]);

  return (
    <div className="space-y-5">
      <OutreachWorkspace initialContacts={contacts} gmailAccount={gmailAccount} />
    </div>
  );
}
