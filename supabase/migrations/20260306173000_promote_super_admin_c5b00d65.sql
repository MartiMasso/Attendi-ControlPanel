-- Promote existing profile to super admin for Attendi Control Panel
-- Target user_id: c5b00d65-ddb5-49a6-a1c6-81dc8f903298

update public.admins
set
  role = 'super_admin',
  permissions = '{
    "users": true,
    "products": true,
    "reservations": true,
    "verifications": true,
    "incidents": true,
    "audit_logs": true,
    "settings": true
  }'::jsonb,
  is_active = true
where user_id = 'c5b00d65-ddb5-49a6-a1c6-81dc8f903298';

insert into public.admins (user_id, role, permissions, is_active)
select
  'c5b00d65-ddb5-49a6-a1c6-81dc8f903298',
  'super_admin',
  '{
    "users": true,
    "products": true,
    "reservations": true,
    "verifications": true,
    "incidents": true,
    "audit_logs": true,
    "settings": true
  }'::jsonb,
  true
where not exists (
  select 1
  from public.admins
  where user_id = 'c5b00d65-ddb5-49a6-a1c6-81dc8f903298'
);
