"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function CreateAccountForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState<"hotel" | "business">("hotel");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !username.trim()) {
      setError("Email and username are required.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          username: username.trim(),
          accountType
        })
      });

      const rawText = await response.text().catch(() => "");
      let data: { error?: string; message?: string; userId?: string } | null = null;
      try { data = JSON.parse(rawText); } catch { /* not json */ }

      if (!response.ok) {
        const msg = data?.error || data?.message || rawText.slice(0, 300) || `Server error (${response.status})`;
        setError(msg);
        return;
      }

      setSuccess(`Account created successfully. User ID: ${data?.userId}`);
      setEmail("");
      setFullName("");
      setUsername("");
      setAccountType("hotel");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
      <div>
        <h2 className="text-sm font-semibold text-text">Create Hotel / Company Account</h2>
        <p className="mt-1 text-xs text-text-muted">
          Password is set to <code className="rounded bg-surface-muted px-1 py-0.5">Attendi12345@</code>. Email is auto-verified — no email sent.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Account type</label>
          <Select value={accountType} onChange={(e) => setAccountType(e.target.value as "hotel" | "business")}>
            <option value="hotel">Hotel</option>
            <option value="business">Company (Business)</option>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Email *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hotel@example.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Username *</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="hotel_username"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-text-muted">Full name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Hotel Name S.L."
          />
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {success ? <p className="text-xs text-[#22c55e]">{success}</p> : null}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating..." : "Create account"}
      </Button>
    </form>
  );
}
