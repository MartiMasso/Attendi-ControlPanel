-- Attendi Control Panel - Internal admin data model and security baseline

create extension if not exists pgcrypto;

create or replace function public.is_active_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = check_user_id
      and coalesce(a.is_active, false) = true
  );
$$;

grant execute on function public.is_active_admin(uuid) to authenticated;

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id) on delete set null,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  affected_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_admin_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  note text not null,
  created_by_admin_id uuid not null references public.admins(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_flags (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  flag_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  reason text not null,
  is_active boolean not null default true,
  created_by_admin_id uuid not null references public.admins(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_incidents_status_priority on public.incidents (status, priority);
create index if not exists idx_incidents_reservation_id on public.incidents (reservation_id);
create index if not exists idx_incidents_reporter_user_id on public.incidents (reporter_user_id);
create index if not exists idx_incidents_affected_user_id on public.incidents (affected_user_id);
create index if not exists idx_admin_notes_entity on public.admin_notes (entity_type, entity_id, created_at desc);
create index if not exists idx_admin_flags_entity on public.admin_flags (entity_type, entity_id, created_at desc);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_entity on public.admin_audit_logs (entity_type, entity_id);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_incidents_set_updated_at on public.incidents;
create trigger trg_incidents_set_updated_at
before update on public.incidents
for each row
execute function public.set_row_updated_at();

alter table public.admins enable row level security;
alter table public.incidents enable row level security;
alter table public.admin_notes enable row level security;
alter table public.admin_flags enable row level security;
alter table public.admin_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admins' and policyname = 'Admins can read own row'
  ) then
    create policy "Admins can read own row"
      on public.admins
      for select
      using (user_id = auth.uid() or public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'incidents' and policyname = 'Active admins can read incidents'
  ) then
    create policy "Active admins can read incidents"
      on public.incidents
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'incidents' and policyname = 'Active admins can insert incidents'
  ) then
    create policy "Active admins can insert incidents"
      on public.incidents
      for insert
      with check (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'incidents' and policyname = 'Active admins can update incidents'
  ) then
    create policy "Active admins can update incidents"
      on public.incidents
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_notes' and policyname = 'Active admins can read notes'
  ) then
    create policy "Active admins can read notes"
      on public.admin_notes
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_notes' and policyname = 'Active admins can insert notes'
  ) then
    create policy "Active admins can insert notes"
      on public.admin_notes
      for insert
      with check (
        public.is_active_admin(auth.uid())
        and exists (
          select 1
          from public.admins a
          where a.id = created_by_admin_id
            and a.user_id = auth.uid()
            and coalesce(a.is_active, false) = true
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_flags' and policyname = 'Active admins can read flags'
  ) then
    create policy "Active admins can read flags"
      on public.admin_flags
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_flags' and policyname = 'Active admins can insert flags'
  ) then
    create policy "Active admins can insert flags"
      on public.admin_flags
      for insert
      with check (
        public.is_active_admin(auth.uid())
        and exists (
          select 1
          from public.admins a
          where a.id = created_by_admin_id
            and a.user_id = auth.uid()
            and coalesce(a.is_active, false) = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_flags' and policyname = 'Active admins can update flags'
  ) then
    create policy "Active admins can update flags"
      on public.admin_flags
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_audit_logs' and policyname = 'Active admins can read audit logs'
  ) then
    create policy "Active admins can read audit logs"
      on public.admin_audit_logs
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_audit_logs' and policyname = 'Active admins can insert audit logs'
  ) then
    create policy "Active admins can insert audit logs"
      on public.admin_audit_logs
      for insert
      with check (public.is_active_admin(auth.uid()) and admin_user_id = auth.uid());
  end if;
end $$;

-- Optional policies for existing entities used by this panel when RLS is enabled.
do $$
begin
  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Active admins can read profiles'
    ) then
      create policy "Active admins can read profiles"
        on public.profiles
        for select
        using (public.is_active_admin(auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Active admins can update profiles'
    ) then
      create policy "Active admins can update profiles"
        on public.profiles
        for update
        using (public.is_active_admin(auth.uid()))
        with check (public.is_active_admin(auth.uid()));
    end if;
  end if;

  if to_regclass('public.verification_requests') is not null then
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'verification_requests' and policyname = 'Active admins can read verification requests'
    ) then
      create policy "Active admins can read verification requests"
        on public.verification_requests
        for select
        using (public.is_active_admin(auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'verification_requests' and policyname = 'Active admins can update verification requests'
    ) then
      create policy "Active admins can update verification requests"
        on public.verification_requests
        for update
        using (public.is_active_admin(auth.uid()))
        with check (public.is_active_admin(auth.uid()));
    end if;
  end if;
end $$;
