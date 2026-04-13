create table if not exists public.analytics_cutover (
  id integer primary key check (id = 1),
  business_performance_from timestamptz not null
);

insert into public.analytics_cutover (id, business_performance_from)
values (1, now())
on conflict (id) do nothing;

grant select on public.analytics_cutover to authenticated, service_role;
