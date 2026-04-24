import { TeamManagementWorkspace } from "@/components/internal-hub/team-management-workspace";
import { listInternalCompanyCategories, listInternalMembers } from "@/services/internal-hub-service";

export default async function InternalHubPage() {
  const [members, companyCategories] = await Promise.all([listInternalMembers(), listInternalCompanyCategories()]);

  return (
    <div className="space-y-5">
      <TeamManagementWorkspace initialMembers={members} initialCompanyCategories={companyCategories} />
    </div>
  );
}
