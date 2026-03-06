import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getActiveAdminSession } from "@/lib/auth/admin";

interface LoginPageProps {
  searchParams: {
    next?: string;
    error?: string;
  };
}

const errorMessages: Record<string, string> = {
  unauthorized: "This account is not allowed to access Attendi Control Panel."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getActiveAdminSession();

  if (session) {
    redirect("/dashboard");
  }

  const nextPath = searchParams.next;
  const initialError = searchParams.error ? errorMessages[searchParams.error] ?? "Unable to sign in." : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-[#e8f1ff] p-2 text-primary">
              <Lock size={18} />
            </div>
            <div>
              <CardTitle>Attendi Control Panel</CardTitle>
              <CardDescription>Private internal access for platform administration</CardDescription>
            </div>
          </div>

          <LoginForm nextPath={nextPath} initialError={initialError} />
        </Card>
      </div>
    </div>
  );
}
