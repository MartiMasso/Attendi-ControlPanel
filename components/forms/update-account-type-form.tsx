"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { AccountType, VerificationStatus } from "@/types";

export function UpdateAccountTypeForm({
  userId,
  currentAccountType,
  currentVerificationStatus
}: {
  userId: string;
  currentAccountType: AccountType;
  currentVerificationStatus: VerificationStatus;
}) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>(currentAccountType);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/users/${userId}/account-type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accountType })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; verificationStatus?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update account type.");
        return;
      }

      setSuccess(
        payload?.verificationStatus
          ? `Updated to ${accountType}. Verification status is now ${payload.verificationStatus}.`
          : `Updated to ${accountType}.`
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Change account type</h3>
        <p className="mt-1 text-xs text-text-muted">
          Current: {currentAccountType} ({currentVerificationStatus})
        </p>
      </div>

      <Select value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType)}>
        <option value="consumer">Consumer</option>
        <option value="business">Business</option>
        <option value="hotel">Hotel</option>
      </Select>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-success">{success}</p> : null}

      <Button type="submit" size="sm" disabled={isPending || accountType === currentAccountType}>
        {isPending ? "Updating..." : "Update account type"}
      </Button>
    </form>
  );
}
