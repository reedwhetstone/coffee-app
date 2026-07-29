# Parchment roast-list consumer cutover

## Intent

Move the operative `/api/roast-profiles` GET read from direct Supabase access to
the canonical Parchment roast contract without changing roast mutations or the
browser response envelope.

The upstream prerequisites are:

- Parchment PR #155: catalog-owned `is_wholesale` projection
- Parchment PR #157: `dry_end_time` projection
- Parchment PR #159: deterministic `roast_date DESC, roast_id DESC` pagination

## Implementation

- Bumped `@purveyors/sdk` to `^0.23.0`.
- Added exhaustive, stable-key offset pagination through `client.roasts.list`.
- Preserved the legacy `{ data }` BFF envelope.
- Removed the duplicate direct-Supabase SSR roast-list query.
- Removed the now-unreferenced direct-Supabase `listRoasts` helper.
- Left POST, PUT, and DELETE behavior unchanged.
- Kept the browser BFF cookie-session-only by gating on the hook-resolved
  `locals.session` and `locals.user` authority.

## Validation

- `VALIDATION_PASS`:
  `pnpm exec vitest run src/lib/server/parchmentRoasts.test.ts src/routes/api/roast-profiles/route.test.ts src/routes/api/roast-profiles/read-boundary.test.ts`
  (7 tests)
- `VALIDATION_PASS`: `pnpm test` (1,061 passed, 11 skipped)
- `VALIDATION_PASS`:
  `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test STRIPE_SECRET_KEY=test STRIPE_WEBHOOK_SECRET=test pnpm check`
  (0 errors, 0 warnings)
- `VALIDATION_PASS`:
  `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test STRIPE_SECRET_KEY=test STRIPE_WEBHOOK_SECRET=test pnpm build`
- `VALIDATION_PASS`: targeted Prettier and ESLint checks
- `VALIDATION_PASS`: `git diff --check`

## Pre-submission red-team gate

Initial verdict: `ready_with_fixes`, P0/P1/P2/P3 `0/0/1/0`.

The reviewer found split credential authority: GET re-read the Supabase cookie
through `safeGetSession()` while the SDK forwarded the hook-resolved
authoritative credential. The route now gates on `locals.session` and
`locals.user`; coverage verifies that header-only principals cannot enter the
browser BFF path and that GET does not re-read the cookie session.

Focused re-review: `ready`, P0/P1/P2/P3 `0/0/0/0`, scope mergeable, confidence
high.
