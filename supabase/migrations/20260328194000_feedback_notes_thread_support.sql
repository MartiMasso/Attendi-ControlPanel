-- Ensure internal notes thread support for feedback detail view.
-- Safe to run even if admin_notes/policies already exist.

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

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  note text not null,
  created_by_admin_id uuid not null references public.admins(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notes_entity
  on public.admin_notes (entity_type, entity_id, created_at desc);

alter table public.admin_notes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_notes'
      and policyname = 'Active admins can read notes'
  ) then
    create policy "Active admins can read notes"
      on public.admin_notes
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_notes'
      and policyname = 'Active admins can insert notes'
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

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_notes'
      and policyname = 'Active admins can delete notes'
  ) then
    create policy "Active admins can delete notes"
      on public.admin_notes
      for delete
      using (public.is_active_admin(auth.uid()));
  end if;
end $$;
