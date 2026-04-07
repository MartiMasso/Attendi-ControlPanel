-- Business Performance foundation:
-- - commission agent assignment to entities
-- - hotel/company commission split settings
-- - query indexes for monthly performance aggregation

create extension if not exists pgcrypto;

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

create table if not exists public.platform_commission_settings (
  id integer primary key default 1,
  k_hotel numeric(6,4) not null default 0.4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_commission_settings_singleton check (id = 1),
  constraint platform_commission_settings_k_hotel_range check (k_hotel >= 0 and k_hotel <= 1)
);

insert into public.platform_commission_settings (id, k_hotel)
values (1, 0.4)
on conflict (id) do nothing;

create table if not exists public.hotel_company_commission_overrides (
  id bigserial primary key,
  hotel_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.profiles(id) on delete cascade,
  ce_p_pct numeric(5,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_company_commission_overrides_pct_range check (ce_p_pct >= 0 and ce_p_pct <= 100),
  constraint hotel_company_commission_overrides_unique unique (hotel_id, company_id)
);

create index if not exists idx_hotel_company_commission_overrides_hotel
  on public.hotel_company_commission_overrides (hotel_id);

create index if not exists idx_hotel_company_commission_overrides_company
  on public.hotel_company_commission_overrides (company_id);

create index if not exists idx_hotel_company_commission_overrides_active
  on public.hotel_company_commission_overrides (active);

create index if not exists idx_hotel_company_commission_overrides_lookup
  on public.hotel_company_commission_overrides (hotel_id, company_id, active);

create table if not exists public.commission_agent_entity_assignments (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.profiles(id) on delete restrict,
  entity_user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_agent_entity_assignments_unique_pair unique (agent_user_id, entity_user_id),
  constraint commission_agent_entity_assignments_not_self check (agent_user_id <> entity_user_id)
);

create unique index if not exists idx_commission_agent_entity_active_unique_entity
  on public.commission_agent_entity_assignments (entity_user_id)
  where active = true;

create index if not exists idx_commission_agent_entity_agent_active
  on public.commission_agent_entity_assignments (agent_user_id, active);

create index if not exists idx_commission_agent_entity_entity_active
  on public.commission_agent_entity_assignments (entity_user_id, active);

create index if not exists idx_profiles_account_type_created_at
  on public.profiles (account_type, created_at desc);

create index if not exists idx_products_user_id
  on public.products (user_id);

create index if not exists idx_reservations_product_created_at
  on public.reservations (product_id, created_at desc);

create index if not exists idx_reservations_source_hotel_created_at
  on public.reservations (source_hotel_id, created_at desc);

create index if not exists idx_reservations_payment_authorized_at
  on public.reservations (payment_authorized_at);

drop trigger if exists trg_platform_commission_settings_set_updated_at on public.platform_commission_settings;
create trigger trg_platform_commission_settings_set_updated_at
before update on public.platform_commission_settings
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_hotel_company_commission_overrides_set_updated_at on public.hotel_company_commission_overrides;
create trigger trg_hotel_company_commission_overrides_set_updated_at
before update on public.hotel_company_commission_overrides
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_commission_agent_entity_assignments_set_updated_at on public.commission_agent_entity_assignments;
create trigger trg_commission_agent_entity_assignments_set_updated_at
before update on public.commission_agent_entity_assignments
for each row
execute function public.set_row_updated_at();

alter table public.platform_commission_settings enable row level security;
alter table public.hotel_company_commission_overrides enable row level security;
alter table public.commission_agent_entity_assignments enable row level security;

grant select on public.platform_commission_settings to authenticated;
grant select on public.hotel_company_commission_overrides to authenticated;
grant select, insert, update on public.commission_agent_entity_assignments to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_commission_settings'
      and policyname = 'Active admins can read platform commission settings'
  ) then
    create policy "Active admins can read platform commission settings"
      on public.platform_commission_settings
      for select
      using (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_company_commission_overrides'
      and policyname = 'Active admins can read hotel company commission overrides'
  ) then
    create policy "Active admins can read hotel company commission overrides"
      on public.hotel_company_commission_overrides
      for select
      using (public.is_active_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commission_agent_entity_assignments'
      and policyname = 'Active admins can read commission agent assignments'
  ) then
    create policy "Active admins can read commission agent assignments"
      on public.commission_agent_entity_assignments
      for select
      using (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commission_agent_entity_assignments'
      and policyname = 'Active admins can insert commission agent assignments'
  ) then
    create policy "Active admins can insert commission agent assignments"
      on public.commission_agent_entity_assignments
      for insert
      with check (public.is_active_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'commission_agent_entity_assignments'
      and policyname = 'Active admins can update commission agent assignments'
  ) then
    create policy "Active admins can update commission agent assignments"
      on public.commission_agent_entity_assignments
      for update
      using (public.is_active_admin(auth.uid()))
      with check (public.is_active_admin(auth.uid()));
  end if;
end $$;
