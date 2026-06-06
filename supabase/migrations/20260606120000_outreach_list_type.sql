-- Split company contacts into two outreach lists: empresas vs alojamientos.

alter table public.internal_hub_company_contacts
  add column if not exists list_type text not null default 'empresa';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'internal_hub_company_contacts_list_type_check'
  ) then
    alter table public.internal_hub_company_contacts
      add constraint internal_hub_company_contacts_list_type_check
      check (list_type in ('empresa', 'alojamiento'));
  end if;
end $$;

create index if not exists idx_internal_hub_company_contacts_list_type
  on public.internal_hub_company_contacts (list_type)
  where deleted_at is null;
