import { TeamManagementWorkspace } from "@/components/internal-hub/team-management-workspace";
import {
  listInternalCompanyCategories,
  listInternalCompanyContacts,
  listInternalCompanyEvents,
  listInternalMembers
} from "@/services/internal-hub-service";

export default async function InternalHubPage() {
  const [members, companyCategories, companies, companyEvents] = await Promise.all([
    listInternalMembers(),
    listInternalCompanyCategories(),
    listInternalCompanyContacts(),
    listInternalCompanyEvents()
  ]);

  return (
    <div className="space-y-5">
      <TeamManagementWorkspace
        initialMembers={members}
        initialCompanyCategories={companyCategories}
        initialCompanies={companies}
        initialCompanyEvents={companyEvents}
      />
    </div>
  );
}
