alter table if exists public.hotel_company_commission_overrides
  add column if not exists k_hotel numeric;

alter table if exists public.hotel_company_commission_overrides
  drop constraint if exists hotel_company_commission_overrides_k_hotel_range;

alter table if exists public.hotel_company_commission_overrides
  add constraint hotel_company_commission_overrides_k_hotel_range
  check (k_hotel is null or (k_hotel >= 0 and k_hotel <= 1));

create index if not exists idx_hotel_company_commission_overrides_location_lookup
  on public.hotel_company_commission_overrides (hotel_id, hotel_location_id, company_id, active);

grant select, insert, update on public.hotel_company_commission_overrides to authenticated;

grant select, insert, update on public.hotel_commission_split_settings to authenticated;

do $$
begin
  if to_regclass('public.hotel_company_commission_overrides') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_company_commission_overrides'
        and policyname = 'Active admins can insert hotel company commission overrides'
    ) then
      create policy "Active admins can insert hotel company commission overrides"
        on public.hotel_company_commission_overrides
        for insert
        with check (public.is_active_admin(auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_company_commission_overrides'
        and policyname = 'Active admins can update hotel company commission overrides'
    ) then
      create policy "Active admins can update hotel company commission overrides"
        on public.hotel_company_commission_overrides
        for update
        using (public.is_active_admin(auth.uid()))
        with check (public.is_active_admin(auth.uid()));
    end if;
  end if;

  if to_regclass('public.hotel_commission_split_settings') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_commission_split_settings'
        and policyname = 'Active admins can read hotel commission split settings'
    ) then
      create policy "Active admins can read hotel commission split settings"
        on public.hotel_commission_split_settings
        for select
        using (public.is_active_admin(auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_commission_split_settings'
        and policyname = 'Active admins can insert hotel commission split settings'
    ) then
      create policy "Active admins can insert hotel commission split settings"
        on public.hotel_commission_split_settings
        for insert
        with check (public.is_active_admin(auth.uid()));
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_commission_split_settings'
        and policyname = 'Active admins can update hotel commission split settings'
    ) then
      create policy "Active admins can update hotel commission split settings"
        on public.hotel_commission_split_settings
        for update
        using (public.is_active_admin(auth.uid()))
        with check (public.is_active_admin(auth.uid()));
    end if;
  end if;
end $$;
