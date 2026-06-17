"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Inbox,
  LogIn,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  MOCKUP_DEFAULT_PASSWORD,
  type ConvertibleAccountRow,
  type MockupAccountRow,
  type MockupAccountType
} from "@/lib/mockups";
import { cn, formatDate } from "@/lib/utils";

interface MockupsWorkspaceProps {
  initialRows: MockupAccountRow[];
  schemaReady: boolean;
  schemaMessage?: string;
}

type WorkspaceMode = "create" | "convert";

interface CreateMockupResponse {
  account?: MockupAccountRow;
  error?: string;
}

interface ListMockupResponse {
  rows?: MockupAccountRow[];
  schemaReady?: boolean;
  schemaMessage?: string;
  error?: string;
}

interface ConvertibleResponse {
  accounts?: ConvertibleAccountRow[];
  error?: string;
}

interface LoginLinkResponse {
  link?: {
    url: string;
    redirectTo: string;
  };
  error?: string;
}

function accountTypeLabel(accountType: MockupAccountType) {
  return accountType === "hotel" ? "Hotel" : "Company";
}

function getDisplayName(row: { businessName: string | null; fullName: string | null; username: string }) {
  return row.businessName || row.fullName || row.username;
}

function getYopmailHref(email: string | null) {
  if (!email || !email.endsWith("@yopmail.com")) {
    return null;
  }

  return `https://yopmail.com/?${encodeURIComponent(email.replace("@yopmail.com", ""))}`;
}

function generateYopmailSuggestion() {
  const number = Math.floor(100000 + Math.random() * 900000);
  return `attendi${number}@yopmail.com`;
}

function maskStripeId(id: string | null) {
  if (!id) {
    return null;
  }

  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

const attendiAppUrl = (process.env.NEXT_PUBLIC_ATTENDI_APP_URL ?? "https://attendi.es").replace(/\/+$/, "");

function getVisitorProfileUrl(row: MockupAccountRow) {
  return `${attendiAppUrl}/seller/${row.id}`;
}

const iconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

// Converting existing accounts is parked until Supabase Auth email changes are
// reliable in the project. The flow below stays in the code, just unreachable.
const CONVERT_ENABLED = false;

// Archiving converted accounts is purely a panel-side organisational concern:
// these are real accounts that can't be deleted or accessed here, so the state
// lives in localStorage rather than the database.
const ARCHIVED_CONVERTED_KEY = "mockups:archivedConverted";

interface RowMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

/** Lightweight kebab (three-dots) menu. Renders the panel with fixed positioning
 * so it isn't clipped by the table's horizontal scroll container. */
function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (buttonRef.current?.contains(event.target as Node) || menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className={iconButtonClass}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && pos ? (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface-elevated py-1 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-muted",
                item.danger ? "text-danger" : "text-text"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function MockupsWorkspace({ initialRows, schemaReady: initialSchemaReady, schemaMessage }: MockupsWorkspaceProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [schemaReady, setSchemaReady] = useState(initialSchemaReady);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(
    initialSchemaReady ? null : schemaMessage ?? "Mockup schema is not ready."
  );
  const [mode, setMode] = useState<WorkspaceMode>("create");
  const [showConvertNotice, setShowConvertNotice] = useState(false);

  const [accountType, setAccountType] = useState<MockupAccountType>("hotel");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [convertQuery, setConvertQuery] = useState("");
  const [convertResults, setConvertResults] = useState<ConvertibleAccountRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ConvertibleAccountRow | null>(null);
  const [convertEmailMode, setConvertEmailMode] = useState<"new" | "keep">("new");
  const [convertEmail, setConvertEmail] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MockupAccountRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<MockupAccountRow | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activeRows = useMemo(() => rows.filter((row) => row.isMockup), [rows]);
  const convertedRows = useMemo(() => rows.filter((row) => !row.isMockup), [rows]);
  const activeCount = activeRows.length;

  // Load persisted archive state once, on the client, to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ARCHIVED_CONVERTED_KEY);
      if (raw) {
        setArchivedIds(new Set(JSON.parse(raw) as string[]));
      }
    } catch {
      // Ignore malformed/unavailable storage; archive is non-critical UI state.
    }
    setArchivedLoaded(true);
  }, []);

  useEffect(() => {
    if (!archivedLoaded) {
      return;
    }
    try {
      window.localStorage.setItem(ARCHIVED_CONVERTED_KEY, JSON.stringify([...archivedIds]));
    } catch {
      // Ignore storage write failures.
    }
  }, [archivedIds, archivedLoaded]);

  const visibleConvertedRows = useMemo(
    () => convertedRows.filter((row) => !archivedIds.has(row.id)),
    [convertedRows, archivedIds]
  );
  const archivedConvertedRows = useMemo(
    () => convertedRows.filter((row) => archivedIds.has(row.id)),
    [convertedRows, archivedIds]
  );

  const archiveConverted = useCallback((id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unarchiveConverted = useCallback((id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Always reconcile the table with the database. The server component can be
  // served from Next's client router cache, so without this the list would show
  // stale (or empty) data after navigating away and back.
  const reload = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/mockups", { method: "GET", cache: "no-store", signal });
      const data = (await response.json().catch(() => null)) as ListMockupResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      if (data?.rows) {
        setRows(data.rows);
      }

      if (typeof data?.schemaReady === "boolean") {
        setSchemaReady(data.schemaReady);
        setSchemaWarning(data.schemaReady ? null : data.schemaMessage ?? "Mockup schema is not ready.");
      }
    } catch (reloadError) {
      if ((reloadError as Error)?.name === "AbortError") {
        return;
      }
      // A failed background refresh shouldn't wipe the table; keep current rows.
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  // Search existing (non-mockup) accounts to convert. An empty query lists the
  // most recent convertible accounts so there is always something to pick from.
  useEffect(() => {
    if (mode !== "convert" || selectedAccount) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(`/api/mockups/convertible?q=${encodeURIComponent(convertQuery.trim())}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = (await response.json().catch(() => null)) as ConvertibleResponse | null;

        if (response.ok && Array.isArray(data?.accounts)) {
          setConvertResults(data.accounts);
        }
      } catch (searchError) {
        if ((searchError as Error)?.name !== "AbortError") {
          setConvertResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [convertQuery, mode, selectedAccount]);

  function switchMode(next: WorkspaceMode) {
    setMode(next);
    setError(null);
    setSuccess(null);
  }

  function selectAccount(account: ConvertibleAccountRow) {
    setSelectedAccount(account);
    // Default to keeping the email: changing it depends on Supabase Auth config
    // and can fail, so the reliable path is the default.
    setConvertEmailMode("keep");
    setConvertEmail("");
    setError(null);
    setSuccess(null);
  }

  function clearSelectedAccount() {
    setSelectedAccount(null);
    setConvertEmailMode("keep");
    setConvertEmail("");
  }

  async function copyCredentials(row: MockupAccountRow) {
    const text = `Attendi mockup\nEmail: ${row.email ?? ""}\nPassword: ${MOCKUP_DEFAULT_PASSWORD}`;

    await navigator.clipboard.writeText(text);
    setCopiedId(row.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  async function openSignedInProfile(row: MockupAccountRow) {
    setError(null);
    setSuccess(null);
    setOpeningId(row.id);

    const newWindow = window.open("about:blank", "_blank");

    try {
      const response = await fetch(`/api/mockups/${row.id}/login-link`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as LoginLinkResponse | null;

      if (!response.ok || !data?.link?.url) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      if (newWindow) {
        newWindow.opener = null;
        newWindow.location.href = data.link.url;
      } else {
        window.location.href = data.link.url;
      }
    } catch (linkError) {
      if (newWindow) {
        newWindow.close();
      }

      setError(linkError instanceof Error ? linkError.message : "Unable to open mockup account.");
    } finally {
      setOpeningId(null);
    }
  }

  function beginDelete(row: MockupAccountRow) {
    setError(null);
    setSuccess(null);
    setDeleteTarget(row);
    setDeleteConfirmation("");
  }

  function closeDeleteDialog() {
    if (deletingId) {
      return;
    }

    setDeleteTarget(null);
    setDeleteConfirmation("");
  }

  async function deleteSelectedMockup() {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.username) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingId(deleteTarget.id);

    try {
      const response = await fetch(`/api/mockups/${deleteTarget.id}`, {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
      setSuccess(`Mockup account deleted: ${deleteTarget.email ?? deleteTarget.username}`);
      setDeleteTarget(null);
      setDeleteConfirmation("");
      router.refresh();
      void reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete mockup account.");
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsRestoring(true);

    try {
      const response = await fetch(`/api/mockups/${restoreTarget.id}/restore`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      setRows((current) => current.filter((row) => row.id !== restoreTarget.id));
      setSuccess(`Account restored to a normal account: ${restoreTarget.username}`);
      setRestoreTarget(null);
      router.refresh();
      void reload();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Unable to restore account.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!schemaReady) {
      setError(schemaWarning ?? "Mockup schema is not ready.");
      return;
    }

    if (!displayName.trim()) {
      setError("Name is required.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          displayName: displayName.trim(),
          username: username.trim() || undefined
        })
      });

      const data = (await response.json().catch(() => null)) as CreateMockupResponse | null;

      if (!response.ok || !data?.account) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      setRows((current) => [data.account!, ...current.filter((row) => row.id !== data.account!.id)]);
      setDisplayName("");
      setUsername("");
      setAccountType("hotel");
      setSuccess(`Mockup account created: ${data.account.email ?? data.account.username}`);
      router.refresh();
      void reload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create mockup account.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleConvert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!schemaReady) {
      setError(schemaWarning ?? "Mockup schema is not ready.");
      return;
    }

    if (!selectedAccount) {
      setError("Select an account to convert.");
      return;
    }

    const wantsNewEmail = convertEmailMode === "new";

    if (wantsNewEmail && !convertEmail.trim()) {
      setError("A new email is required.");
      return;
    }

    setIsConverting(true);

    try {
      const response = await fetch("/api/mockups/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedAccount.id,
          email: wantsNewEmail ? convertEmail.trim() : ""
        })
      });

      const data = (await response.json().catch(() => null)) as CreateMockupResponse | null;

      if (!response.ok || !data?.account) {
        throw new Error(data?.error ?? `Server error (${response.status})`);
      }

      setRows((current) => [data.account!, ...current.filter((row) => row.id !== data.account!.id)]);
      setSuccess(`Account converted to mockup: ${data.account.email ?? data.account.username}`);
      setSelectedAccount(null);
      setConvertEmailMode("keep");
      setConvertEmail("");
      setConvertQuery("");
      setConvertResults([]);
      router.refresh();
      void reload();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Unable to convert account to mockup.");
    } finally {
      setIsConverting(false);
    }
  }

  const formDisabled = !schemaReady || isCreating || isConverting;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-border bg-surface-elevated p-5">
        <div className="inline-flex w-full rounded-lg border border-border bg-surface-muted p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              switchMode("create");
              setShowConvertNotice(false);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              mode === "create" ? "bg-surface-elevated text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Create new
          </button>
          <button
            type="button"
            aria-disabled={!CONVERT_ENABLED}
            onClick={() => (CONVERT_ENABLED ? switchMode("convert") : setShowConvertNotice(true))}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              CONVERT_ENABLED
                ? mode === "convert"
                  ? "bg-surface-elevated text-text shadow-sm"
                  : "text-text-muted hover:text-text"
                : "cursor-not-allowed text-text-muted/50"
            }`}
          >
            Convert existing
          </button>
        </div>

        {showConvertNotice && !CONVERT_ENABLED ? (
          <div className="rounded-lg border border-warning/30 bg-[#fff8eb] p-3 text-sm text-warning">
            Esta opción aún no está funcional.
          </div>
        ) : null}

        {!schemaReady ? (
          <div className="rounded-lg border border-warning/30 bg-[#fff8eb] p-3 text-sm text-warning">
            {schemaWarning ?? "Mockup schema is not ready."}
          </div>
        ) : null}

        {mode === "create" || !CONVERT_ENABLED ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <CardTitle>Create mockup account</CardTitle>
              <CardDescription>
                Generates a confirmed Yopmail login with the default password and publishing permissions.
              </CardDescription>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Account type</label>
              <Select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as MockupAccountType)}
                disabled={formDisabled}
              >
                <option value="hotel">Hotel</option>
                <option value="business">Company (Business)</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Name</label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={accountType === "hotel" ? "Hotel Demo Barcelona" : "Attendi Experiences Demo"}
                disabled={formDisabled}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-muted">Username</label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Auto-generated if empty"
                disabled={formDisabled}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-muted">
              <div className="flex items-center justify-between gap-3">
                <span>Email</span>
                <code className="text-text">attendi******@yopmail.com</code>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Password</span>
                <code className="text-text">{MOCKUP_DEFAULT_PASSWORD}</code>
              </div>
            </div>

            {error ? <p className="text-xs text-danger">{error}</p> : null}
            {success ? <p className="text-xs text-success">{success}</p> : null}

            <Button type="submit" size="sm" disabled={formDisabled}>
              {isCreating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {isCreating ? "Creating..." : "Create mockup"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConvert} className="space-y-4">
            <div>
              <CardTitle>Convert existing account</CardTitle>
              <CardDescription>
                Turn a real hotel/company account into a mockup. Products are kept and the Stripe account is cleared
                (saved so it can be restored later). The login email can optionally be replaced with a Yopmail address.
              </CardDescription>
            </div>

            {selectedAccount ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-surface-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">{getDisplayName(selectedAccount)}</div>
                      <div className="truncate text-xs text-text-muted">
                        {accountTypeLabel(selectedAccount.accountType)} · {selectedAccount.username}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearSelectedAccount}
                      className={iconButtonClass}
                      aria-label="Choose a different account"
                      title="Choose a different account"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">Current email</span>
                      <span className="truncate font-mono text-text">{selectedAccount.email ?? "Not exposed"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">Stripe</span>
                      {selectedAccount.stripeAccountId ? (
                        <span className="truncate font-mono text-text" title={selectedAccount.stripeAccountId}>
                          {maskStripeId(selectedAccount.stripeAccountId)} → cleared
                        </span>
                      ) : (
                        <span className="text-text-muted">None</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-muted">Login email</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConvertEmailMode("keep")}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        convertEmailMode === "keep"
                          ? "border-primary bg-[#f0f6ff] text-text"
                          : "border-border bg-surface-elevated text-text-muted hover:text-text"
                      }`}
                    >
                      <span className="block font-medium">Keep current email</span>
                      <span className="block text-[11px] text-text-muted">Recommended · no change</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConvertEmailMode("new");
                        if (!convertEmail.trim()) {
                          setConvertEmail(generateYopmailSuggestion());
                        }
                      }}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        convertEmailMode === "new"
                          ? "border-primary bg-[#f0f6ff] text-text"
                          : "border-border bg-surface-elevated text-text-muted hover:text-text"
                      }`}
                    >
                      <span className="block font-medium">New Yopmail email</span>
                      <span className="block text-[11px] text-text-muted">May fail (Auth config)</span>
                    </button>
                  </div>

                  {convertEmailMode === "new" ? (
                    <Input
                      type="email"
                      value={convertEmail}
                      onChange={(event) => setConvertEmail(event.target.value)}
                      placeholder="attendi123456@yopmail.com"
                      disabled={formDisabled}
                      required
                    />
                  ) : (
                    <p className="rounded-lg border border-border bg-surface-muted p-2.5 text-xs text-text-muted">
                      Keeps <span className="font-mono text-text">{selectedAccount.email ?? "the current email"}</span>. Use
                      this for Google sign-in accounts, whose email cannot be changed.
                    </p>
                  )}

                  <p className="text-[11px] text-text-muted">
                    Password stays the same — access the demo with &quot;Open app&quot;.
                  </p>
                </div>

                {error ? <p className="text-xs text-danger">{error}</p> : null}
                {success ? <p className="text-xs text-success">{success}</p> : null}

                <Button
                  type="submit"
                  size="sm"
                  disabled={formDisabled || (convertEmailMode === "new" && !convertEmail.trim())}
                >
                  {isConverting ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {isConverting ? "Converting..." : "Convert to mockup"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted">Find account</label>
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <Input
                      value={convertQuery}
                      onChange={(event) => setConvertQuery(event.target.value)}
                      placeholder="Name, username or ID"
                      className="pl-9"
                      disabled={!schemaReady}
                    />
                  </div>
                </div>

                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {isSearching ? (
                    <p className="px-1 py-2 text-xs text-text-muted">Searching…</p>
                  ) : convertResults.length ? (
                    convertResults.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => selectAccount(account)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-left transition hover:border-primary/40 hover:bg-[#f9fbff]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-text">{getDisplayName(account)}</div>
                          <div className="truncate text-xs text-text-muted">
                            {account.email ?? account.username}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge color="info">{accountTypeLabel(account.accountType)}</Badge>
                          {account.stripeAccountId ? <Badge color="neutral">Stripe</Badge> : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="px-1 py-2 text-xs text-text-muted">No convertible accounts found.</p>
                  )}
                </div>

                {error ? <p className="text-xs text-danger">{error}</p> : null}
                {success ? <p className="text-xs text-success">{success}</p> : null}
              </div>
            )}
          </form>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Total created</p>
            <p className="mt-1 text-2xl font-semibold text-text">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Active mockups</p>
            <p className="mt-1 text-2xl font-semibold text-text">{activeCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Default password</p>
            <p className="mt-1 truncate font-mono text-sm font-semibold text-text">{MOCKUP_DEFAULT_PASSWORD}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text">Mockup accounts</h3>
            <p className="text-xs text-text-muted">Demo logins for the main Attendi app.</p>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={isRefreshing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-xs font-medium text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : undefined} />
            Refresh
          </button>
        </div>

        {activeRows.length ? (
          <DataTable>
            <TableHeader>
              <tr>
                <TableHead>Account</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">Products</TableHead>
                <TableHead className="whitespace-nowrap">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {activeRows.map((row) => {
                const yopmailHref = getYopmailHref(row.email);

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-text">{getDisplayName(row)}</span>
                          <Badge color="info">{accountTypeLabel(row.accountType)}</Badge>
                        </div>
                        <div className="truncate text-xs text-text-muted">{row.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[230px]">
                        <div className="truncate font-mono text-xs text-text">{row.email ?? "Not exposed"}</div>
                        <div className="font-mono text-xs text-text-muted">{MOCKUP_DEFAULT_PASSWORD}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge color={row.isMockup ? "warning" : "success"}>{row.isMockup ? "Mockup" : "Converted"}</Badge>
                        {row.convertedFromExisting ? <Badge color="neutral">From existing</Badge> : null}
                        <StatusBadge value={row.verificationStatus ?? "-"} />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium text-text">{row.productCount}</span>
                      <span className="text-text-muted"> {row.productCount === 1 ? "product" : "products"}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">{formatDate(row.mockupCreatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openSignedInProfile(row)}
                          disabled={!row.isMockup || openingId === row.id}
                          title="Open the main app already signed in as this mockup"
                        >
                          {openingId === row.id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <LogIn size={14} />
                          )}
                          Open app
                        </Button>
                        <button
                          type="button"
                          onClick={() => copyCredentials(row)}
                          className={iconButtonClass}
                          aria-label="Copy credentials"
                          title="Copy email and password"
                        >
                          <Copy size={15} />
                        </button>
                        {yopmailHref ? (
                          <a
                            href={yopmailHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={iconButtonClass}
                            aria-label="Open Yopmail inbox"
                            title="Open the Yopmail inbox"
                          >
                            <Inbox size={15} />
                          </a>
                        ) : null}
                        {row.convertedFromExisting && row.isMockup ? (
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setSuccess(null);
                              setRestoreTarget(row);
                            }}
                            className={iconButtonClass}
                            aria-label="Restore to normal account"
                            title="Restore to a normal account (recover original email & Stripe)"
                          >
                            <RotateCcw size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beginDelete(row)}
                            disabled={!row.isMockup || deletingId === row.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger transition hover:bg-[#fdebed] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Delete mockup"
                            title="Delete this mockup account"
                          >
                            {deletingId === row.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        )}
                      </div>
                      {copiedId === row.id ? <div className="mt-1 text-xs text-success">Copied</div> : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        ) : (
          <EmptyState title="No active mockups" description="Create the first hotel or company mockup account." />
        )}

        <div className="pt-2">
          <h3 className="text-sm font-semibold text-text">Converted accounts</h3>
          <p className="text-xs text-text-muted">
            Former mockups that became real accounts. They can&apos;t be deleted or accessed here — only viewed publicly.
          </p>
        </div>

        {convertedRows.length ? (
          <div className="space-y-3">
            {archivedConvertedRows.length ? (
              <div className="overflow-hidden rounded-xl border border-border bg-surface-muted/40">
                <button
                  type="button"
                  onClick={() => setShowArchived((value) => !value)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-text-muted transition hover:bg-surface-muted"
                  aria-expanded={showArchived}
                >
                  {showArchived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Archive size={15} />
                  Archived
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                    {archivedConvertedRows.length}
                  </span>
                </button>
                {showArchived ? (
                  <div className="divide-y divide-border border-t border-border">
                    {archivedConvertedRows.map((row) => (
                      <div key={row.id} className="flex items-center gap-3 px-4 py-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">{getDisplayName(row)}</span>
                          <Badge color="info">{accountTypeLabel(row.accountType)}</Badge>
                        </div>
                        <span className="hidden whitespace-nowrap text-xs text-text-muted sm:block">
                          {formatDate(row.mockupConvertedAt ?? row.mockupCreatedAt)}
                        </span>
                        <a
                          href={getVisitorProfileUrl(row)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={iconButtonClass}
                          title="View the public profile as a visitor"
                          aria-label="Visit public profile"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <RowMenu
                          items={[
                            {
                              label: "Unarchive",
                              icon: <ArchiveRestore size={15} />,
                              onClick: () => unarchiveConverted(row.id)
                            }
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {visibleConvertedRows.length ? (
              <DataTable>
                <TableHeader>
                  <tr>
                    <TableHead>Account</TableHead>
                    <TableHead>Login email</TableHead>
                    <TableHead className="whitespace-nowrap">Converted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {visibleConvertedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="max-w-[220px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-text">{getDisplayName(row)}</span>
                            <Badge color="info">{accountTypeLabel(row.accountType)}</Badge>
                          </div>
                          <div className="truncate text-xs text-text-muted">{row.username}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[230px] truncate font-mono text-xs text-text">{row.email ?? "Not exposed"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {formatDate(row.mockupConvertedAt ?? row.mockupCreatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={getVisitorProfileUrl(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-surface-muted px-3 text-sm font-medium text-text transition hover:bg-[#dbe6f3]"
                            title="View the public profile as a visitor"
                          >
                            <ExternalLink size={14} />
                            Visit
                          </a>
                          <RowMenu
                            items={[
                              {
                                label: "Archive",
                                icon: <Archive size={15} />,
                                onClick: () => archiveConverted(row.id)
                              }
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
                All converted accounts are archived.
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            title="No converted accounts yet"
            description="Accounts that leave mockup mode and become real accounts will appear here."
          />
        )}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fdebed] text-danger">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text">Delete mockup account</h3>
                  <p className="mt-1 text-sm text-text-muted">
                    This will remove the Auth user and related mockup profile data for {getDisplayName(deleteTarget)}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingId)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-muted">
              <div className="truncate">
                Email: <span className="font-mono text-text">{deleteTarget.email ?? "Not exposed"}</span>
              </div>
              <div className="mt-1 truncate">
                Username: <span className="font-mono text-text">{deleteTarget.username}</span>
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <label className="text-xs font-medium text-text-muted">Type username to confirm</label>
              <Input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={deleteTarget.username}
                disabled={Boolean(deletingId)}
                autoFocus
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={closeDeleteDialog} disabled={Boolean(deletingId)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={deleteSelectedMockup}
                disabled={deleteConfirmation !== deleteTarget.username || Boolean(deletingId)}
              >
                {deletingId ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {restoreTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e5f0ff] text-primary">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text">Restore to normal account</h3>
                  <p className="mt-1 text-sm text-text-muted">
                    {getDisplayName(restoreTarget)} will stop being a mockup. Its products become public again and the
                    original email and Stripe account are restored.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (isRestoring ? undefined : setRestoreTarget(null))}
                disabled={isRestoring}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-muted">
              <div className="flex items-center justify-between gap-3">
                <span>Restore Stripe</span>
                <span className="truncate font-mono text-text">
                  {restoreTarget.originalStripeAccountId ? maskStripeId(restoreTarget.originalStripeAccountId) : "None saved"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setRestoreTarget(null)} disabled={isRestoring}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={confirmRestore} disabled={isRestoring}>
                {isRestoring ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Restore
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
