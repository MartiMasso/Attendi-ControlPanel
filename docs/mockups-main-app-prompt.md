# Prompt for the main Attendi web app

Implement support for Control Panel-created mockup hotel/company accounts.

Database context:
- The Control Panel migration `supabase/migrations/20260615120000_mockup_accounts.sql` adds:
  - `profiles.is_mockup`
  - `profiles.mockup_created_at`
  - `profiles.mockup_created_by_admin_user_id`
  - `profiles.mockup_converted_at`
  - `profiles.mockup_metadata`
  - `profiles.can_publish`
  - `profiles.company_setup_complete`
  - `products.is_mockup`
  - triggers that set `products.is_mockup` from the owner profile
  - restricted RPC `public.complete_mockup_exit(p_user_id uuid)`
- Mockup accounts are created only from the Control Panel.
- Default credentials are generated as `attendi******@yopmail.com` with password `Attendi12345@`.

Required behavior in the main app:

1. Login and session
- Let mockup users sign in normally with email/password.
- Load `profiles.is_mockup`, `profiles.can_publish`, `profiles.company_setup_complete`, `verification_status`, and Stripe fields wherever the seller/hotel dashboard checks permissions.
- Support Supabase magic link redirects for mockup admin access. The Control Panel generates an admin `magiclink` with `redirectTo = <main-app>/seller/<user_id>`, so the main app must persist the Supabase session from that callback/hash/code before rendering the profile.

2. Mockup permissions
- If `profile.is_mockup = true`, treat the account as verified and allowed to publish/edit products even if there is no Stripe account.
- Do not require email confirmation, verification upload, or Stripe onboarding while `is_mockup = true`.
- Do not expose any client-side path that can set `profiles.is_mockup` or `products.is_mockup`.

3. Product visibility
- Every public discovery query must exclude mockup products:
  - search results
  - homescreen/home feed
  - category pages
  - nearby/recommended products
  - hotel partner/recommendation feeds, unless the view is explicitly the mockup owner's own dashboard/profile preview
- Prefer filtering `products.is_mockup = false`.
- If a query joins profiles, also protect it with `coalesce(owner.is_mockup, false) = false`.
- Owner dashboards can show their own products even while `products.is_mockup = true`.

4. Settings UI: "Salir de mockup"
- Show a clear "Salir de mockup" action only when the logged-in profile has `is_mockup = true`.
- The flow must ask the user to:
  - set a real email
  - set a new password
  - connect/complete Stripe onboarding
- The user should not become a normal public seller until those steps are complete.

5. Server flow for leaving mockup
- Implement the flow in server routes/actions using the service role key.
- Validate that the current authenticated user owns the profile and `profiles.is_mockup = true`.
- Update Supabase Auth email and password server-side. Confirm the new email server-side if that is the intended onboarding behavior.
- Create or reuse a Stripe connected account and complete onboarding.
- Only after the required Stripe state is valid, call:

```sql
select public.complete_mockup_exit('<user_id>'::uuid);
```

- After this RPC, the account should have:
  - `profiles.is_mockup = false`
  - `profiles.mockup_converted_at` set
  - `profiles.verification_status = 'approved'`
  - `profiles.can_publish = true`
  - `profiles.company_setup_complete = true`
  - existing products moved to `products.is_mockup = false`

6. QA checklist
- Mockup hotel/company can log in with generated Yopmail credentials.
- Control Panel "visit signed in" magic link opens the main app as the mockup user.
- Mockup hotel/company can create products without Stripe.
- Mockup products do not appear in public search/home/category/recommendation results.
- Mockup owner can still see and edit their own products.
- "Salir de mockup" blocks completion until real email/password and Stripe are done.
- After exiting mockup, products can appear publicly under the normal visibility rules.
