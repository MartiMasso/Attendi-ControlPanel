# Attendi Control Panel - Expected Schema

This panel is designed to work defensively against partial schemas. Missing optional tables do **not** break rendering; affected sections show safe empty states.

## Required tables (MVP runtime)

- `public.admins`
  - used for admin access control (`user_id`, `is_active`, `role`, `permissions`)
- `public.profiles`
  - used for users directory and cross-entity relations
- `public.reservations`
  - used for reservation lists/detail and KPI metrics
- `public.verification_requests`
  - used for verification queue/review flow
- `public.admin_verification_requests_v1`
  - denormalized admin read model (verification queue filters + real pending logic)
- `public.internal_hub_tasks`
  - team task assignment and execution tracking in Internal Hub
- `public.internal_hub_notes`
  - pinned announcements, decisions, reminders, and internal resources

## Strongly recommended existing tables

- `public.business_details`
- `public.business_documents`
- `public.products`
- `public.user_hotel_links` (used as `last_seen_at` fallback)
- `public.reservation_hotel_attributions`
- `public.payments` (optional in current Attendi DB; panel falls back cleanly if missing)

## New internal admin tables introduced by migration

Migration file:
- `supabase/migrations/20260306160000_admin_panel_core.sql`
- `supabase/migrations/20260312113000_verification_review_queue_alignment.sql`
- `supabase/migrations/20260312170000_internal_hub_workspace.sql`

Creates:
- `public.incidents`
- `public.admin_notes`
- `public.admin_flags`
- `public.admin_audit_logs`

Also creates:
- `public.is_active_admin(uuid)` helper
- indexes for list/detail performance
- row-level security policies focused on active admins

## Auth model

- Login uses Supabase Auth (`email` + `password`)
- Access allowed only if authenticated user exists in `public.admins` with `is_active = true`
- Middleware + server guards enforce this on all private routes and API mutations

## Notes on user email

`auth.users.email` is not directly available from the client anon key flow. This panel resolves email using:
1. `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional) for secure admin lookups
2. fallback to `business_details.email` when available
3. otherwise displays `Not exposed`

## Defensive behavior implemented

- Missing table/column in optional queries (`42P01`, `42703`) resolves to empty arrays / null blocks
- UI sections remain functional and clearly communicate missing data sources
- core pages still render even if incidents/admin tables are not yet migrated
