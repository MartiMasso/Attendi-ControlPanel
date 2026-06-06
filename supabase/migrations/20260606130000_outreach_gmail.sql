-- Gmail integration for outreach: shared mailbox connection + message tracking.

-- Single-row table holding the OAuth refresh token for the shared outreach
-- mailbox. Service-role only (RLS enabled, no policies, no grants to clients).
create table if not exists public.internal_hub_email_account (
  id text primary key default 'primary',
  email text not null default '',
  refresh_token text not null,
  scope text not null default '',
  connected_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internal_hub_email_account enable row level security;
revoke all on public.internal_hub_email_account from authenticated;
revoke all on public.internal_hub_email_account from anon;

-- Outbound/inbound tracking on contacts (feeds threading + reply detection).
alter table public.internal_hub_company_contacts
  add column if not exists last_outbound_at timestamptz;

alter table public.internal_hub_company_contacts
  add column if not exists last_inbound_at timestamptz;

alter table public.internal_hub_company_contacts
  add column if not exists gmail_thread_id text;
