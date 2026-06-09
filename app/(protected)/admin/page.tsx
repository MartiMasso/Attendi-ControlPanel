import { CreateAccountForm } from "@/components/forms/create-account-form";
import { CreateProductForm } from "@/components/forms/create-product-form";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Create accounts and products directly from the control panel."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CreateAccountForm />
        <CreateProductForm />
      </div>
    </div>
  );
}
