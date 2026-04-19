import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { listUsers } from "@/services/users-service";

interface UsersPageProps {
  searchParams: {
    q?: string;
    accountType?: string;
    verificationStatus?: string;
    sortBy?: string;
    page?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getAvatarInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "U";
  }

  return trimmed.charAt(0).toUpperCase();
}

function toBackgroundImage(url: string) {
  const safeUrl = url.replace(/"/g, "%22");
  return `url("${safeUrl}")`;
}

function buildPageHref(searchParams: UsersPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();

  const q = firstParam(searchParams.q);
  const accountType = firstParam(searchParams.accountType);
  const verificationStatus = firstParam(searchParams.verificationStatus);
  const sortBy = firstParam(searchParams.sortBy);

  if (q) params.set("q", q);
  if (accountType) params.set("accountType", accountType);
  if (verificationStatus) params.set("verificationStatus", verificationStatus);
  if (sortBy) params.set("sortBy", sortBy);
  params.set("page", String(page));

  return `/users?${params.toString()}`;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const q = firstParam(searchParams.q) ?? "";
  const accountType = firstParam(searchParams.accountType) ?? "";
  const verificationStatus = firstParam(searchParams.verificationStatus) ?? "";
  const sortBy = firstParam(searchParams.sortBy) ?? "created_desc";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  const { rows, total } = await listUsers({
    query: q,
    accountType,
    verificationStatus,
    sortBy,
    page: currentPage,
    pageSize: 30
  });

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Monitor and manage consumers, businesses, and hotels registered in Attendi."
      />

      <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-5" method="GET">
        <Input name="q" defaultValue={q} placeholder="Search by name, username or ID" />
        <Select name="accountType" defaultValue={accountType}>
          <option value="">All account types</option>
          <option value="consumer">Consumer</option>
          <option value="business">Business</option>
          <option value="hotel">Hotel</option>
        </Select>
        <Select name="verificationStatus" defaultValue={verificationStatus}>
          <option value="">All verification states</option>
          <option value="not_required">Not required</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select name="sortBy" defaultValue={sortBy}>
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="verification_asc">Verification (A-Z)</option>
          <option value="verification_desc">Verification (Z-A)</option>
        </Select>
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-strong"
        >
          Apply filters
        </button>
      </form>

      {rows.length ? (
        <DataTable>
          <TableHeader>
            <tr>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="text-right">Detail</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#eaf1ff] text-sm font-semibold text-primary">
                      {user.profile_photo_url ? (
                        <div
                          className="h-full w-full bg-cover bg-center bg-no-repeat"
                          style={{ backgroundImage: toBackgroundImage(user.profile_photo_url) }}
                          aria-hidden="true"
                        />
                      ) : (
                        <span>{getAvatarInitial(user.full_name || user.username)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text">{user.full_name || user.username}</div>
                      <div className="truncate text-xs text-text-muted">{user.username}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{user.email ?? <span className="text-text-muted">Not exposed</span>}</TableCell>
                <TableCell>
                  <Badge color="info">{user.account_type}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge value={user.verification_status} />
                </TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell>{formatDate(user.last_seen_at)}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/users/${user.id}`} className="text-sm font-medium text-primary hover:underline">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      ) : (
        <EmptyState title="No users found" description="Try different filters or search parameters." />
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
        <p className="text-text-muted">
          Page {currentPage} of {totalPages} ({total} users)
        </p>
        <div className="flex items-center gap-3">
          {currentPage > 1 ? (
            <Link href={buildPageHref(searchParams, currentPage - 1)} className="font-medium text-primary hover:underline">
              Previous
            </Link>
          ) : (
            <span className="text-text-muted">Previous</span>
          )}
          {currentPage < totalPages ? (
            <Link href={buildPageHref(searchParams, currentPage + 1)} className="font-medium text-primary hover:underline">
              Next
            </Link>
          ) : (
            <span className="text-text-muted">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
