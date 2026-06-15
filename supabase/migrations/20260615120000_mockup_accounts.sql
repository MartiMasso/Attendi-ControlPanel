-- Mockup hotel/company accounts.
-- These accounts are created only by the Control Panel, can log in to the main app,
-- and their products stay out of public discovery while the account is in mockup mode.

alter table if exists public.profiles
  add column if not exists can_publish boolean,
  add column if not exists company_setup_complete boolean,
  add column if not exists is_mockup boolean,
  add column if not exists mockup_created_at timestamptz,
  add column if not exists mockup_created_by_admin_user_id uuid,
  add column if not exists mockup_converted_at timestamptz,
  add column if not exists mockup_metadata jsonb;

update public.profiles
set can_publish = true
where can_publish is null
  and account_type in ('business', 'hotel')
  and coalesce(verification_status::text, '') = 'approved';

update public.profiles
set can_publish = false
where can_publish is null;

update public.profiles
set company_setup_complete = false
where company_setup_complete is null;

update public.profiles
set is_mockup = false
where is_mockup is null;

update public.profiles
set mockup_metadata = '{}'::jsonb
where mockup_metadata is null;

alter table if exists public.profiles
  alter column can_publish set default false,
  alter column can_publish set not null,
  alter column company_setup_complete set default false,
  alter column company_setup_complete set not null,
  alter column is_mockup set default false,
  alter column is_mockup set not null,
  alter column mockup_metadata set default '{}'::jsonb,
  alter column mockup_metadata set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_mockup_created_by_admin_user_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_mockup_created_by_admin_user_id_fkey
      foreign key (mockup_created_by_admin_user_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_profiles_mockup_created_at
  on public.profiles (mockup_created_at desc)
  where mockup_created_at is not null;

create index if not exists idx_profiles_active_mockups
  on public.profiles (is_mockup, account_type, mockup_created_at desc)
  where mockup_created_at is not null;

do $$
begin
  if to_regclass('public.products') is not null then
    alter table public.products
      add column if not exists is_mockup boolean;

    update public.products product
    set is_mockup = coalesce(owner.is_mockup, false)
    from public.profiles owner
    where product.user_id = owner.id
      and product.is_mockup is distinct from coalesce(owner.is_mockup, false);

    update public.products
    set is_mockup = false
    where is_mockup is null;

    alter table public.products
      alter column is_mockup set default false,
      alter column is_mockup set not null;

    create index if not exists idx_products_mockup_owner
      on public.products (is_mockup, user_id);
  end if;
end $$;

create or replace function public.protect_mockup_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  can_manage boolean := coalesce(auth.role(), '') = 'service_role' or public.is_active_admin(auth.uid());
begin
  if can_manage then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_mockup, false) = true
      or new.mockup_created_at is not null
      or new.mockup_created_by_admin_user_id is not null
      or new.mockup_converted_at is not null
      or coalesce(new.mockup_metadata, '{}'::jsonb) <> '{}'::jsonb then
      raise exception 'mockup profile fields can only be managed internally' using errcode = '42501';
    end if;
  elsif new.is_mockup is distinct from old.is_mockup
    or new.mockup_created_at is distinct from old.mockup_created_at
    or new.mockup_created_by_admin_user_id is distinct from old.mockup_created_by_admin_user_id
    or new.mockup_converted_at is distinct from old.mockup_converted_at
    or new.mockup_metadata is distinct from old.mockup_metadata then
    raise exception 'mockup profile fields can only be managed internally' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_mockup_fields on public.profiles;
create trigger trg_profiles_protect_mockup_fields
before insert or update on public.profiles
for each row
execute function public.protect_mockup_profile_fields();

create or replace function public.sync_products_for_mockup_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_mockup is distinct from new.is_mockup
    and to_regclass('public.products') is not null then
    update public.products
    set is_mockup = new.is_mockup
    where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_mockup_products on public.profiles;
create trigger trg_profiles_sync_mockup_products
after update of is_mockup on public.profiles
for each row
execute function public.sync_products_for_mockup_profile();

create or replace function public.set_product_mockup_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_is_mockup boolean := false;
begin
  if new.user_id is null then
    new.is_mockup = false;
    return new;
  end if;

  select coalesce(profile.is_mockup, false)
  into owner_is_mockup
  from public.profiles profile
  where profile.id = new.user_id;

  new.is_mockup = coalesce(owner_is_mockup, false);

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.products') is not null then
    drop trigger if exists trg_products_set_mockup_flag on public.products;

    create trigger trg_products_set_mockup_flag
    before insert or update of user_id, is_mockup on public.products
    for each row
    execute function public.set_product_mockup_flag();
  end if;
end $$;

create or replace function public.complete_mockup_exit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_active_admin(auth.uid()) then
    raise exception 'mockup exit can only be completed internally' using errcode = '42501';
  end if;

  update public.profiles
  set
    is_mockup = false,
    mockup_converted_at = coalesce(mockup_converted_at, now()),
    verification_status = 'approved',
    can_publish = true,
    company_setup_complete = true
  where id = p_user_id
    and mockup_created_at is not null;

  if to_regclass('public.products') is not null then
    update public.products
    set is_mockup = false
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.complete_mockup_exit(uuid) from public;
grant execute on function public.complete_mockup_exit(uuid) to authenticated;
grant execute on function public.complete_mockup_exit(uuid) to service_role;
