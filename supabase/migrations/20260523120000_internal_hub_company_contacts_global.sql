-- Global, recoverable company-contact workspace for Internal Hub.

create extension if not exists pgcrypto;

create table if not exists public.internal_hub_company_contacts (
  id text primary key,
  company_name text not null default '',
  email text not null default '',
  phone text not null default '',
  category text not null default 'Hotel/Hub',
  status text not null default 'Por contactar' check (status in ('Por contactar', 'Contactado', 'Interesado', 'En negociación', 'Cerrado', 'Descartado')),
  priority text not null default 'Media' check (priority in ('Baja', 'Media', 'Alta')),
  owner_member_id text not null default '',
  next_step text not null default 'Enviar email' check (next_step in ('Enviar email', 'Llamar', 'Agendar demo', 'Enviar propuesta', 'Esperar respuesta', 'Cerrar')),
  follow_up_date date,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  deleted_by_user_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_hub_company_events (
  id text primary key,
  company_id text,
  event_date date not null,
  event_time time not null default '09:00',
  event_type text not null default 'Llamada' check (event_type in ('Llamada', 'Correo pendiente', 'Demo', 'Follow-up', 'Recordatorio', 'Otro')),
  title text not null default '',
  notes text not null default '',
  reminder_enabled boolean not null default true,
  reminder_lead_days integer not null default 1 check (reminder_lead_days >= 0 and reminder_lead_days <= 365),
  reminder_email text not null default 'attendi.rent.app@gmail.com',
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  deleted_by_user_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_hub_company_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company_contact', 'company_event')),
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'soft_delete', 'restore')),
  old_record jsonb,
  new_record jsonb,
  changed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_hub_company_contacts_active_updated
  on public.internal_hub_company_contacts (deleted_at, updated_at desc);

create index if not exists idx_internal_hub_company_contacts_follow_up
  on public.internal_hub_company_contacts (follow_up_date)
  where deleted_at is null;

create index if not exists idx_internal_hub_company_events_active_date
  on public.internal_hub_company_events (deleted_at, event_date, event_time);

create index if not exists idx_internal_hub_company_events_company
  on public.internal_hub_company_events (company_id)
  where deleted_at is null;

create index if not exists idx_internal_hub_company_revisions_lookup
  on public.internal_hub_company_revisions (entity_type, entity_id, created_at desc);

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

drop trigger if exists trg_internal_hub_company_contacts_set_updated_at on public.internal_hub_company_contacts;
create trigger trg_internal_hub_company_contacts_set_updated_at
before update on public.internal_hub_company_contacts
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_internal_hub_company_events_set_updated_at on public.internal_hub_company_events;
create trigger trg_internal_hub_company_events_set_updated_at
before update on public.internal_hub_company_events
for each row
execute function public.set_row_updated_at();

create or replace function public.record_internal_hub_company_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  revision_action text;
  entity_kind text;
  actor_id uuid;
begin
  entity_kind := case
    when TG_TABLE_NAME = 'internal_hub_company_contacts' then 'company_contact'
    else 'company_event'
  end;

  if TG_OP = 'INSERT' then
    revision_action := 'insert';
    actor_id := coalesce(NEW.created_by_user_id, NEW.updated_by_user_id, auth.uid());
  elsif OLD.deleted_at is null and NEW.deleted_at is not null then
    revision_action := 'soft_delete';
    actor_id := coalesce(NEW.deleted_by_user_id, NEW.updated_by_user_id, auth.uid());
  elsif OLD.deleted_at is not null and NEW.deleted_at is null then
    revision_action := 'restore';
    actor_id := coalesce(NEW.updated_by_user_id, NEW.created_by_user_id, auth.uid());
  else
    revision_action := 'update';
    actor_id := coalesce(NEW.updated_by_user_id, auth.uid());
  end if;

  insert into public.internal_hub_company_revisions (
    entity_type,
    entity_id,
    action,
    old_record,
    new_record,
    changed_by_user_id
  )
  values (
    entity_kind,
    NEW.id,
    revision_action,
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    to_jsonb(NEW),
    actor_id
  );

  return NEW;
end;
$fn$;

drop trigger if exists trg_internal_hub_company_contacts_revision on public.internal_hub_company_contacts;
create trigger trg_internal_hub_company_contacts_revision
after insert or update on public.internal_hub_company_contacts
for each row
execute function public.record_internal_hub_company_revision();

drop trigger if exists trg_internal_hub_company_events_revision on public.internal_hub_company_events;
create trigger trg_internal_hub_company_events_revision
after insert or update on public.internal_hub_company_events
for each row
execute function public.record_internal_hub_company_revision();

alter table public.internal_hub_company_contacts enable row level security;
alter table public.internal_hub_company_events enable row level security;
alter table public.internal_hub_company_revisions enable row level security;

grant select, insert, update on public.internal_hub_company_contacts to authenticated;
grant select, insert, update on public.internal_hub_company_events to authenticated;
grant select on public.internal_hub_company_revisions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_contacts'
      and policyname = 'Active admins can read company contacts'
  ) then
    create policy "Active admins can read company contacts"
      on public.internal_hub_company_contacts
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_contacts'
      and policyname = 'Active admins can insert company contacts'
  ) then
    create policy "Active admins can insert company contacts"
      on public.internal_hub_company_contacts
      for insert
      with check (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_contacts'
      and policyname = 'Active admins can update company contacts'
  ) then
    create policy "Active admins can update company contacts"
      on public.internal_hub_company_contacts
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_events'
      and policyname = 'Active admins can read company events'
  ) then
    create policy "Active admins can read company events"
      on public.internal_hub_company_events
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_events'
      and policyname = 'Active admins can insert company events'
  ) then
    create policy "Active admins can insert company events"
      on public.internal_hub_company_events
      for insert
      with check (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_events'
      and policyname = 'Active admins can update company events'
  ) then
    create policy "Active admins can update company events"
      on public.internal_hub_company_events
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_hub_company_revisions'
      and policyname = 'Active admins can read company revisions'
  ) then
    create policy "Active admins can read company revisions"
      on public.internal_hub_company_revisions
      for select
      using (public.is_active_admin(auth.uid()));
  end if;
end $$;
