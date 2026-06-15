# Attendi Control Panel

Private internal backoffice for Attendi platform operations.

## Overview

Attendi Control Panel is a **Next.js 14 App Router** admin web app for Attendi internal teams to monitor and manage:

- Global KPIs and platform activity
- Users (`consumer`, `business`, `hotel`)
- Verification requests
- Reservations
- Incidents
- Internal notes, flags, and audit logs

This is **not** a partner/hotel dashboard. It is intended only for Attendi internal admins.

## Tech Stack 

- Next.js 14+ (App Router)
- TypeScript (strict)
- Tailwind CSS
- Supabase (Auth + Postgres)

## Implemented Routes

Public:
- `/login`

Private (admin-only):
- `/dashboard`
- `/business-performance`
- `/users`
- `/users/[id]`
- `/verifications`
- `/verifications/[id]`
- `/reservations`
- `/reservations/[id]`
- `/incidents`
- `/incidents/[id]`
- `/audit-logs`
- `/settings`
- `/mockups`
- `/internal-hub`

## Security Model

Access requires:
1. Valid Supabase session
2. Active admin row in `public.admins` (`user_id = auth.uid()`, `is_active = true`)

Enforcement points:
- `middleware.ts` route protection
- server-side guard in protected layout (`requireActiveAdmin`)
- API route authorization checks for admin mutations

## Environment Variables

Copy `.env.example` to `.env.local` and provide:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
VERIFICATION_EMAIL_FROM=
VERIFICATION_EMAIL_REPLY_TO=
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is optional and used server-side only for better email enrichment (`auth.users`).
- The panel works without service role key, but some user emails may show as `Not exposed`.
- Verification review emails are sent through Resend when `RESEND_API_KEY` and `VERIFICATION_EMAIL_FROM` are configured.

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env.local
```

3. Run database migrations in Supabase (recommended)

- Apply SQL from:
  - `supabase/migrations/20260306160000_admin_panel_core.sql`

4. Start development server

```bash
npm run dev
```

5. Open:
- `http://localhost:3000/login`

## Database Notes

Expected schema reference:
- `docs/expected-schema.md`

The app is built to tolerate missing optional tables/columns and display safe empty states.

## Project Structure

```txt
app/
  (protected)/
  api/
  login/
components/
  forms/
  layout/
  ui/
lib/
  auth/
  supabase/
  utils/
services/
types/
supabase/migrations/
docs/
```

## Key Functional Capabilities Included

- Real Supabase login flow
- Admin-only route protection
- Sidebar/topbar private app shell
- KPI dashboard with recent activity
- Business Performance section with monthly business/hotel metrics and commission calculator
- User listing + detail + internal notes/flags
- Manual user account-type upgrades/downgrades (`consumer` / `business` / `hotel`)
- Verification listing + detail + approve/reject actions
- Reservation listing + detail + related incidents/notes/flags
- Incidents listing + detail + status/priority update
- Audit logs section
- Settings section with current admin context
- Mockups section for internal hotel/company demo accounts with Yopmail credentials
- Internal Hub section with assignable team tasks and persistent internal notes

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

## Production Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Use RLS for all panel-exposed tables.
- Restrict admin assignment workflow around `public.admins`.
- Extend audit logging for every privileged mutation as panel scope grows.
