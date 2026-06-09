import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Create and edit accounts and products directly from the control panel."
      />
      <AdminTabs />
    </div>
  );
}
