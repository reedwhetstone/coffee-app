# Pre-submission red-team re-review: sanitized PageAuthView

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:

- None.
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable
  VALIDATION_STATUS:
- `pnpm check --fail-on-warnings`: VALIDATION_BLOCKED_ENV (isolated worktree lacked the five required static Supabase/Stripe exports)
- `env PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role-key STRIPE_SECRET_KEY=sk_test_placeholder STRIPE_WEBHOOK_SECRET=whsec_placeholder pnpm check --fail-on-warnings`: VALIDATION_PASS
- `pnpm exec vitest run src/routes/layout.server.test.ts src/lib/components/layout/Actionsbar.svelte.test.ts src/lib/components/layout/MobileAppMenu.test.ts src/lib/components/layout/MobileAppShell.svelte.test.ts src/lib/components/layout/Navbar.svelte.test.ts src/lib/components/layout/Settingsbar.test.ts src/lib/components/layout/UnifiedHeader.svelte.test.ts src/routes/analytics/page.svelte.test.ts src/routes/catalog/page.svelte.test.ts src/routes/chat/page.svelte.test.ts src/routes/auth/page.svelte.test.ts src/routes/auth/cli/page.test.ts src/routes/api-dashboard/keys/keys.test.ts src/routes/api/roast-profiles/read-boundary.test.ts`: VALIDATION_PASS
- `git diff --check origin/main...HEAD`: VALIDATION_PASS
- `pnpm test` (parent validation at `98cb84e9`): VALIDATION_PASS
- `pnpm build` (parent validation at `98cb84e9` with normal repository environment): VALIDATION_PASS

## Review target

- Repository: `coffee-app`
- Base: `origin/main` at `d8f96521062188b042d28ec1a05af723822094a3`
- Head: `98cb84e9424fa1f8059eda630eb4bec974dbd404`
- Branch: `refactor/sanitized-page-auth-view`
- Diff: 59 files, 353 insertions, 349 deletions
- Intent reviewed: replace browser-visible Supabase session/user/role/PPI compatibility payloads with a sanitized `PageAuthView`, retain server-side Supabase SSR identity plumbing and existing UI/access behavior, preserve the analytics navigation added on current `origin/main`, and remain independent of the server-locals cleanup in PR #529.

The supplied `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and complete 2,045-line `full.diff` were read. The changed files and connected loaders, root layout, auth helpers, navigation model, component call sites, and tests were inspected in the worktree rather than inferred from the patch alone.

## What the code actually does

`PageAuthView` is a deliberately narrow browser contract containing only signed-in state, user ID/email, primary app role, and Parchment Intelligence access (`src/lib/types/auth.types.ts:8-16`). The root server layout creates that projection from the existing request-local identity/principal state (`src/routes/+layout.server.ts:4-21`). It does not return the Supabase `Session`, full Supabase `User`, access or refresh tokens, expiry fields, identities, app metadata, user metadata, or provider objects.

The root universal layout preserves the browser-created Supabase client and the existing `supabase:auth` invalidation dependency, but no longer duplicates `session`, `role`, or `user` into its return (`src/routes/+layout.ts:4-12`). SvelteKit then merges the root `auth` projection into descendant page data. Child loaders that formerly repeated auth compatibility fields now return only route-specific data, while their server-side authentication and authorization checks continue to use `event.locals`, `safeGetSession`, or the canonical principal.

All changed UI surfaces read the same centralized `auth` projection. Signed-in shell selection, chat availability, role gates, PPI gates, catalog limits, marketing CTAs, account labels, admin labels, portfolio actions, and route redirects retain their previous predicates with `auth.isSignedIn`, `auth.user`, `auth.role`, and `auth.ppiAccess` substituted for the old compatibility fields.

## Findings

No confirmed defects or actionable concerns were found.

## Audit detail

### Browser/server boundary and token exposure

- The only auth object returned by the root server layout is the explicit scalar projection at `src/routes/+layout.server.ts:9-20`.
- `App.PageData` now requires `auth: PageAuthView` and no longer declares the credential-bearing session compatibility shape (`src/app.d.ts`).
- Searches across all `+page.server.ts`, `+layout.server.ts`, `+page.ts`, and `+layout.ts` files found no loader returning top-level `session`, `user`, `role`, or `ppiAccess` compatibility fields. Remaining references use those values server-side for guards, SDK credential mode, or route-specific feature-state construction.
- Searches across non-test page and component consumers found no remaining `data.session`, `data.user`, `data.role`, `data.ppiAccess`, `$page.data.*` equivalent, or `PageData['session'|'user'|'role'|'ppiAccess']` access.
- `src/hooks.server.ts` and `src/lib/server/pageAuth.ts` remain unchanged. Supabase sessions and full users continue to exist on request locals for SSR identity plumbing and BFF JWT forwarding, which is the intended boundary and keeps this branch independent of PR #529.
- The focused root-layout tests inject credential-bearing session data and assert the exact sanitized output plus absence of access and refresh secrets (`src/routes/layout.server.test.ts:39-66`).

### SvelteKit data inheritance and client auth plumbing

- The root server layout supplies `auth` for every route.
- The root universal layout spreads the server data and adds only a browser-created Supabase client (`src/routes/+layout.ts:4-12`), so descendant pages receive `auth` through normal SvelteKit layout inheritance.
- No child layout or page loader overrides `auth`.
- The existing `depends('supabase:auth')` invalidation key remains in place, and sign-out flows still reload the page. The change therefore removes serialized credentials without removing the client identity mechanism.

### UI and access behavior

- The root shell uses `auth.isSignedIn` for public versus authenticated shell selection and combines `auth.role`/`auth.ppiAccess` for chat access (`src/routes/+layout.svelte:105-119`, `157-199`).
- Server-side route protection remains in `hooks.server.ts`; this PR changes browser presentation data, not authorization enforcement.
- Catalog anonymous limits, pagination, upsells, member filters, and scrolling now use `auth.isSignedIn` while role/PPI gates use the same canonical values as before.
- Admin, API console, beans, chat, dashboard, profit, roast, subscription, subscription-success, auth, and marketing surfaces were traced to the new projection. Removed page loaders for `/profit` and `/roast` only duplicated role/user data; those pages now inherit the root projection and retain their role predicates.
- The sanitized shape intentionally retains only the identity metadata needed for display (`id`, `email`) and the role/PPI values needed for route UX. No server-only credential is required by a changed client consumer.

### Rebased analytics navigation

- `Navbar` now derives role, PPI access, and signed-in state from `data.auth`, while preserving the report-route detection and `getAnalyticsSectionLinks` call introduced on `origin/main` (`src/lib/components/layout/Navbar.svelte:18-28`).
- `UnifiedHeader` accepts `PageAuthView` directly and preserves public navigation, signed-in console routing, member quick links, and Market Index section depth (`src/lib/components/layout/UnifiedHeader.svelte:12-50`).
- Updated tests cover the rebased behavior: report links appear only on the analytics route, anonymous users do not receive the signed-in Disclosure Index link, signed-in users do, and desktop report jumps still close the panel (`src/lib/components/layout/Navbar.svelte.test.ts:43-86`; `src/lib/components/layout/UnifiedHeader.svelte.test.ts:43-67`).

### Direction and scope

The branch aligns with accepted ADR-007. It keeps Supabase Auth as the browser identity/session provider and preserves BFF session forwarding while narrowing what coffee-app exposes as page data (`notes/decisions/007-headless-api-extraction-web-as-reference-client.md:54-65`). It also matches the verified architecture boundary that full Supabase session/provider objects remain server-side (`notes/ARCHITECTURE.md:47-55`) and supports the product vision's API-first, thin-reference-client direction.

The slice is independently mergeable if PR #529 never ships. It relies on the existing server-local session/principal implementation but does not require that implementation to be cleaned up, moved, or merged concurrently.

## Validation notes

The focused Vitest command passed 14 files and 105 tests, including the root serialization contract, layout/navigation behavior, analytics, catalog, chat, auth, API-key page loading, and the deleted roast page-loader boundary.

The first bare `pnpm check --fail-on-warnings` attempt was `VALIDATION_BLOCKED_ENV`, not a code failure: this isolated worktree lacked `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`. Re-running the same check with non-secret in-process test values passed with zero errors and zero warnings. The Node 24 runtime emitted the repository's existing Node 22 engine warning; it did not affect the check or focused tests.

Parent-provided final-head validation additionally records the full `pnpm test` suite as passing 1,099 tests with 11 skipped, `pnpm build` as passing with the normal repository environment, changed-file Prettier and ESLint as passing, and `git diff --check` as passing. This re-review independently repeated the type check, focused tests, and diff check.

## Post-merge conflict resolution

PR #529 merged after this audit, making the branch conflict with `main`. The
branch was rebased onto merge commit `b7bf0241`. Seven overlapping paths were
resolved by preserving #529's principal-only server contract while retaining
this PR's sanitized browser projection:

- the architecture record now documents both boundaries
- homepage and analytics loaders no longer depend on removed legacy locals
- subscription loaders use `getPageAuthState(locals.principal)` only for
  server-side identity and role needs
- the profit and roast compatibility loaders remain deleted because their
  browser auth fields are inherited from the root `PageAuthView`

Post-resolution validation:

- `git diff --check origin/main...HEAD`: `VALIDATION_PASS`
- `env PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role-key STRIPE_SECRET_KEY=sk_test_placeholder STRIPE_WEBHOOK_SECRET=whsec_placeholder pnpm check --fail-on-warnings`: `VALIDATION_PASS` with zero errors and zero warnings
- `pnpm test`: `VALIDATION_PASS` with 1,096 tests passed and 11 skipped
- bare `pnpm build`: `VALIDATION_BLOCKED_ENV` because the isolated worktree lacked the required static Supabase exports
- `env PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role-key STRIPE_SECRET_KEY=sk_test_placeholder STRIPE_WEBHOOK_SECRET=whsec_placeholder pnpm build`: `VALIDATION_PASS`
