-- Align verification review flow with manual admin queue requirements.

-- 1) Ensure enum supports admin "needs_changes" decision.
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'account_verification_status'
      and n.nspname = 'public'
  ) then
    begin
      alter type public.account_verification_status add value if not exists 'needs_changes';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- 2) Coherent defaults.
alter table if exists public.profiles
  alter column verification_status set default 'not_required';

alter table if exists public.verification_requests
  alter column status set default 'pending';

-- 3) Admin review metadata columns.
alter table if exists public.verification_requests
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz;

-- Keep old/new review note fields aligned when legacy field exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'verification_requests'
      and column_name = 'review_note'
  ) then
    update public.verification_requests
    set review_notes = coalesce(review_notes, review_note)
    where review_note is not null;
  end if;
end $$;

-- 4) Queue and filter indexes.
create index if not exists idx_verification_requests_status_updated_at
  on public.verification_requests(status, updated_at desc);

create index if not exists idx_verification_requests_payload_source_normalized
  on public.verification_requests ((lower(coalesce(payload->>'source', ''))));

create index if not exists idx_verification_requests_user_status
  on public.verification_requests(user_id, status);

-- 5) Admin read model for list/filter pages.
create or replace view public.admin_verification_requests_v1 as
select
  vr.id as request_id,
  vr.user_id,
  p.full_name,
  p.username as profile_username,
  p.account_type as current_account_type,
  p.verification_status as profile_verification_status,
  p.can_publish,
  bd.email as business_details_email,
  vr.status as request_status,
  vr.requested_account_type as target_account_type,
  vr.legal_name,
  vr.tax_id,
  vr.company_email,
  vr.company_phone,
  vr.payload,
  coalesce(vr.payload->>'source', '') as request_source_raw,
  lower(coalesce(vr.payload->>'source', '')) as request_source_normalized,
  case
    when lower(coalesce(vr.payload->>'source', '')) in ('settings_upgrade', 'settings_verified_update', 'register')
      then lower(coalesce(vr.payload->>'source', ''))
    else 'other'
  end as request_source_bucket,
  coalesce(vr.payload->>'request_kind', '') as request_kind,
  coalesce(vr.payload->>'category', '') as category,
  coalesce(vr.payload->'contact'->>'phone', '') as contact_phone,
  coalesce(vr.payload->'address'->>'street', '') as address_street,
  coalesce(vr.payload->'address'->>'street_number', '') as address_street_number,
  coalesce(vr.payload->'address'->>'postal_code', '') as address_postal_code,
  coalesce(vr.payload->'address'->>'city', '') as address_city,
  coalesce(vr.payload->'opening_hours'->>'mon_fri', '') as opening_hours_mon_fri,
  coalesce(vr.payload->'opening_hours'->>'saturday', '') as opening_hours_saturday,
  coalesce(vr.payload->'opening_hours'->>'sunday', '') as opening_hours_sunday,
  coalesce(vr.last_submitted_at, vr.updated_at, vr.submitted_at) as last_activity_at,
  vr.last_submitted_at,
  vr.last_admin_email_sent_at,
  vr.last_email_action,
  coalesce(vr.reminder_count, 0) as reminder_count,
  vr.review_note,
  vr.review_notes,
  vr.reviewed_by,
  vr.reviewed_at,
  vr.admin_notes,
  vr.rejected_reason,
  vr.submitted_at,
  vr.created_at,
  vr.updated_at,
  (
    lower(coalesce(vr.status::text, '')) = 'pending'
    and lower(coalesce(vr.payload->>'source', '')) <> 'register'
  ) as is_real_pending,
  (
    lower(coalesce(vr.status::text, '')) <> 'pending'
    or lower(coalesce(vr.payload->>'source', '')) <> 'register'
  ) as is_visible_for_admin_queue
from public.verification_requests vr
left join public.profiles p on p.id = vr.user_id
left join public.business_details bd on bd.user_id = vr.user_id;

grant select on public.admin_verification_requests_v1 to authenticated, service_role;

-- 6) Optional legacy cleanup (run manually if desired):
-- update public.verification_requests
-- set
--   status = 'not_required',
--   review_notes = coalesce(review_notes, '') || case
--     when coalesce(review_notes, '') = '' then 'Auto-closed legacy register request.'
--     else ' | Auto-closed legacy register request.'
--   end,
--   reviewed_at = now()
-- where
--   lower(coalesce(status::text, 'pending')) = 'pending'
--   and lower(coalesce(payload->>'source', '')) = 'register';
--
-- update public.profiles p
-- set
--   verification_status = 'not_required',
--   can_publish = false
-- where
--   lower(coalesce(p.verification_status::text, '')) = 'pending'
--   and coalesce(p.can_publish, false) = false
--   and not exists (
--     select 1
--     from public.verification_requests vr
--     where vr.user_id = p.id
--       and lower(coalesce(vr.status::text, 'pending')) = 'pending'
--       and lower(coalesce(vr.payload->>'source', '')) <> 'register'
--   );
