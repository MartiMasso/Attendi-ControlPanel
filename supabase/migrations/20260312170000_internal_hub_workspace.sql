-- Internal Hub workspace for team tasking and internal coordination.

create extension if not exists pgcrypto;

create table if not exists public.internal_hub_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_hub_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'announcement' check (category in ('announcement', 'decision', 'reminder', 'resource')),
  pinned boolean not null default false,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_internal_hub_tasks_status_updated_at
  on public.internal_hub_tasks(status, updated_at desc);

create index if not exists idx_internal_hub_tasks_assignee_status
  on public.internal_hub_tasks(assignee_user_id, status);

create index if not exists idx_internal_hub_tasks_due_date
  on public.internal_hub_tasks(due_date);

create index if not exists idx_internal_hub_notes_pinned_updated_at
  on public.internal_hub_notes(pinned, updated_at desc);

do $$
begin
  if to_regprocedure('public.set_row_updated_at()') is null then
    create or replace function public.set_row_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

drop trigger if exists trg_internal_hub_tasks_set_updated_at on public.internal_hub_tasks;
create trigger trg_internal_hub_tasks_set_updated_at
before update on public.internal_hub_tasks
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_internal_hub_notes_set_updated_at on public.internal_hub_notes;
create trigger trg_internal_hub_notes_set_updated_at
before update on public.internal_hub_notes
for each row
execute function public.set_row_updated_at();

alter table public.internal_hub_tasks enable row level security;
alter table public.internal_hub_notes enable row level security;

grant select, insert, update on public.internal_hub_tasks to authenticated;
grant select, insert, update on public.internal_hub_notes to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_tasks'
      and policyname = 'Active admins can read internal hub tasks'
  ) then
    create policy "Active admins can read internal hub tasks"
      on public.internal_hub_tasks
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_tasks'
      and policyname = 'Active admins can insert internal hub tasks'
  ) then
    create policy "Active admins can insert internal hub tasks"
      on public.internal_hub_tasks
      for insert
      with check (
        public.is_active_admin(auth.uid())
        and created_by_user_id = auth.uid()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_tasks'
      and policyname = 'Active admins can update internal hub tasks'
  ) then
    create policy "Active admins can update internal hub tasks"
      on public.internal_hub_tasks
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_notes'
      and policyname = 'Active admins can read internal hub notes'
  ) then
    create policy "Active admins can read internal hub notes"
      on public.internal_hub_notes
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_notes'
      and policyname = 'Active admins can insert internal hub notes'
  ) then
    create policy "Active admins can insert internal hub notes"
      on public.internal_hub_notes
      for insert
      with check (
        public.is_active_admin(auth.uid())
        and created_by_user_id = auth.uid()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_notes'
      and policyname = 'Active admins can update internal hub notes'
  ) then
    create policy "Active admins can update internal hub notes"
      on public.internal_hub_notes
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;
