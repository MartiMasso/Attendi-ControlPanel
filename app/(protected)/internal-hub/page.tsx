import Link from "next/link";

import { InternalNoteCreateForm } from "@/components/forms/internal-note-create-form";
import { InternalTaskCreateForm } from "@/components/forms/internal-task-create-form";
import { InternalTaskUpdateForm } from "@/components/forms/internal-task-update-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import { getInternalHubInsights, listInternalMembers, listInternalNotes, listInternalTasks } from "@/services/internal-hub-service";
import type { InternalTaskPriority } from "@/types";

interface InternalHubPageProps {
  searchParams: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    page?: string;
  };
}

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildPageHref(searchParams: InternalHubPageProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  const q = firstParam(searchParams.q);
  const status = firstParam(searchParams.status);
  const priority = firstParam(searchParams.priority);
  const assignee = firstParam(searchParams.assignee);

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (assignee) params.set("assignee", assignee);
  params.set("page", String(page));

  return `/internal-hub?${params.toString()}`;
}

function priorityColor(priority: InternalTaskPriority) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

export default async function InternalHubPage({ searchParams }: InternalHubPageProps) {
  const q = firstParam(searchParams.q) ?? "";
  const status = firstParam(searchParams.status) ?? "";
  const priority = firstParam(searchParams.priority) ?? "";
  const assignee = firstParam(searchParams.assignee) ?? "";
  const page = Number(firstParam(searchParams.page) ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const pageSize = 20;

  const [members, insights, notes, taskResult] = await Promise.all([
    listInternalMembers(),
    getInternalHubInsights(),
    listInternalNotes(12),
    listInternalTasks({
      query: q,
      status,
      priority,
      assigneeUserId: assignee,
      page: currentPage,
      pageSize
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(taskResult.total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Blue-relief workspace for Attendi team operations, task assignment, and internal coordination."
      />

      <section className="grid gap-4 rounded-2xl border border-[#8cb0e8] bg-gradient-to-br from-[#dbeafe] via-[#e7f1ff] to-[#f7fbff] p-5 shadow-[0_14px_30px_rgba(30,64,175,0.2),inset_0_1px_0_rgba(255,255,255,0.95)] md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#aac4ec] bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p className="text-xs uppercase tracking-[0.08em] text-[#355b95]">Open Tasks</p>
          <p className="mt-2 text-3xl font-semibold text-[#0d2f63]">{insights.total_open_tasks}</p>
        </div>
        <div className="rounded-xl border border-[#aac4ec] bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p className="text-xs uppercase tracking-[0.08em] text-[#355b95]">Blocked</p>
          <p className="mt-2 text-3xl font-semibold text-[#0d2f63]">{insights.blocked_tasks}</p>
        </div>
        <div className="rounded-xl border border-[#aac4ec] bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p className="text-xs uppercase tracking-[0.08em] text-[#355b95]">Overdue</p>
          <p className="mt-2 text-3xl font-semibold text-[#0d2f63]">{insights.overdue_tasks}</p>
        </div>
        <div className="rounded-xl border border-[#aac4ec] bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <p className="text-xs uppercase tracking-[0.08em] text-[#355b95]">Due This Week</p>
          <p className="mt-2 text-3xl font-semibold text-[#0d2f63]">{insights.due_this_week}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <InternalTaskCreateForm members={members} />
        <InternalNoteCreateForm />
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <form className="grid gap-3 rounded-xl border border-border bg-surface-elevated p-4 md:grid-cols-5" method="GET">
            <Input name="q" defaultValue={q} placeholder="Search tasks" />
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="todo">todo</option>
              <option value="in_progress">in_progress</option>
              <option value="blocked">blocked</option>
              <option value="done">done</option>
            </Select>
            <Select name="priority" defaultValue={priority}>
              <option value="">All priorities</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </Select>
            <Select name="assignee" defaultValue={assignee}>
              <option value="">All assignees</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.full_name || member.username || member.user_id}
                </option>
              ))}
            </Select>
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-strong">
              Filter
            </button>
          </form>

          {taskResult.rows.length ? (
            <DataTable>
              <TableHeader>
                <tr>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {taskResult.rows.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-text-muted">By {task.created_by_name || task.created_by_user_id}</p>
                      {task.description ? <p className="mt-1 text-xs text-text-muted">{task.description}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge color={priorityColor(task.priority)}>{task.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={task.status} />
                    </TableCell>
                    <TableCell>{task.assignee_name ?? <span className="text-text-muted">Unassigned</span>}</TableCell>
                    <TableCell>{task.due_date ?? <span className="text-text-muted">-</span>}</TableCell>
                    <TableCell>{formatDate(task.updated_at)}</TableCell>
                    <TableCell className="min-w-[220px] text-right">
                      <InternalTaskUpdateForm
                        taskId={task.id}
                        currentStatus={task.status}
                        currentPriority={task.priority}
                        currentAssigneeUserId={task.assignee_user_id}
                        currentDueDate={task.due_date}
                        members={members}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          ) : (
            <EmptyState
              title="No internal tasks yet"
              description="Create tasks above to start assigning work and tracking execution."
            />
          )}

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm">
            <p className="text-text-muted">
              Page {currentPage} of {totalPages} ({taskResult.total} tasks)
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

        <div className="space-y-4">
          <Card className="space-y-3 border-[#aac4ec] bg-gradient-to-br from-[#edf4ff] to-[#f8fbff]">
            <h2 className="text-sm font-semibold text-[#0d2f63]">Team Workload</h2>
            {insights.workload.length ? (
              <ul className="space-y-2">
                {insights.workload.map((entry) => (
                  <li key={entry.user_id} className="flex items-center justify-between rounded-lg border border-[#d2e2ff] bg-white/80 px-3 py-2 text-sm">
                    <span className="text-text">{entry.name}</span>
                    <Badge color="info">{entry.open_tasks} open</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No workload data yet.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-text">Internal Notes</h2>
            {notes.length ? (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-border bg-surface-muted p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{note.title}</p>
                      <div className="flex items-center gap-2">
                        {note.pinned ? <Badge color="warning">pinned</Badge> : null}
                        <Badge color="neutral">{note.category}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{note.body}</p>
                    <p className="mt-2 text-xs text-text-muted">
                      {note.created_by_name || note.created_by_user_id} · {formatDate(note.updated_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No internal notes yet.</p>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-text">Quick Links</h2>
            <div className="grid gap-2 text-sm">
              <Link href="/users" className="rounded-lg border border-border bg-surface-muted px-3 py-2 hover:bg-[#e3ecfa]">
                Users management
              </Link>
              <Link href="/verifications" className="rounded-lg border border-border bg-surface-muted px-3 py-2 hover:bg-[#e3ecfa]">
                Verification queue
              </Link>
              <Link href="/incidents" className="rounded-lg border border-border bg-surface-muted px-3 py-2 hover:bg-[#e3ecfa]">
                Incident handling
              </Link>
              <Link href="/settings" className="rounded-lg border border-border bg-surface-muted px-3 py-2 hover:bg-[#e3ecfa]">
                Admin settings
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
