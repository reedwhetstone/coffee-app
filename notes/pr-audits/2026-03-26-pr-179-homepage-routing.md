# PR Verification Report

## Metadata

- Repo: `/root/.openclaw/workspace/repos/coffee-app`
- Base: `origin/main`
- Head: `HEAD` (`feat/homepage-routing`)
- PR # (if available): 179
- Reviewer model: `github-copilot/gpt-5.4` in OpenClaw subagent session
- Confidence: Medium
- Scope note: Reviewed `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff`; inspected the changed files in repo context plus adjacent auth/layout files. `pnpm run check` passed. Attempted `pnpm exec playwright test tests/e2e/smoke.spec.ts --project=chromium`, but the suite could not complete because `tests/e2e/auth.setup.ts` failed against the current environment with `Admin generate_link failed (403): bad_jwt`.

## Executive Verdict

- Merge readiness: Not ready
- Intent coverage: Partial
- Priority summary: P0: 0, P1: 1, P2: 3, P3: 1

## Intent Verification

- Stated intent:
  - Make `/` the public marketing landing page for all users, including signed-in users
  - Move the canonical logged-in app home to `/dashboard`
  - Update auth flows and navigation so signed-in users are directed to `/dashboard` instead of `/catalog`
  - Preserve the public homepage SEO/marketing experience
  - Add tests for the new behavior
- What was implemented:
  - `/` now always renders the marketing layout and signed-in users get a signed-in-aware hero/header instead of the old dashboard-on-home behavior
  - New authenticated `/dashboard` route was added with quick-start cards and recent arrivals
  - Primary auth entry points now target `/dashboard` instead of `/catalog`
  - Layout logic was updated so signed-in users still see the public homepage shell on `/`
  - Smoke coverage was expanded to include `/` and `/dashboard` for signed-in users
- Coverage gaps:
  - The redirect contract is still incomplete; signed-in users who hit protected/member/admin routes without permission are still sent to `/catalog`, which keeps the old canonical-home behavior alive in server-side guard flows
  - Signed-in homepage UX is only partially adapted; lower-page marketing CTAs still behave like the user is anonymous
  - Tests do not assert the most important routing outcomes this PR changes

## Checklist Coverage

- 1. Intent Coverage: `FAIL`
  - Core behavior mostly landed, but server-side fallback redirects still preserve `/catalog` as the effective home in several signed-in flows.
- 2. Correctness: `CONCERN`
  - Main paths look coherent; auth callback still trusts arbitrary `next`, and signed-in users still encounter stale redirect targets indirectly.
- 3. Codebase Alignment: `PASS`
  - The new `/dashboard` route and layout changes fit the existing SvelteKit structure and auth model.
- 4. Risk and Regressions: `CONCERN`
  - Routing-heavy change with incomplete redirect coverage and weak assertions around redirect destinations.
- 5. Security and Data Safety: `CONCERN`
  - No obvious auth boundary break was introduced, but `/auth/callback` still redirects to unsanitized `next` values.
- 6. Test and Verification Quality: `FAIL`
  - Tests cover rendering, not the redirect contract that this PR actually changes.
- 7. Tech Debt and Maintainability: `CONCERN`
  - Home/dashboard preview loading is duplicated; auth redirect behavior is still scattered across hooks, auth pages, callback, and marketing CTAs.
- 8. Product and UX Alignment: `CONCERN`
  - The public-first homepage goal landed, but signed-in UX still has duplicate nav items and anonymous acquisition CTAs.
- 9. Assumptions Audit: `CONCERN`
  - Several assumptions are weak or invalid; see dedicated section below.
- 10. Final Verdict: `Not ready`

## Findings by Severity

### P0 (must fix before merge)

- None confirmed.

### P1 (should fix before merge)

- **Title:** Signed-in fallback redirects still send users to `/catalog`, so the old app home remains active in guard flows
- **Evidence:** `src/hooks.server.ts:119-124` still redirects protected member and admin route failures to `/catalog`:
  - `if (requiresProtection && !requireRole(event.locals.role, 'member')) { throw redirect(303, '/catalog'); }`
  - `if (requiresAdminAccess && !requireRole(event.locals.role, 'admin')) { throw redirect(303, '/catalog'); }`
- **Impact:** This directly conflicts with the PR intent to make `/dashboard` the canonical logged-in home. A signed-in viewer who follows an old bookmark to `/beans`, `/roast`, `/profit`, `/chat`, or `/admin` still lands on `/catalog`, not `/dashboard`. That means the old home is still semantically alive anywhere the guard rejects access.
- **Correction:** Update the guard logic to branch on auth state and route signed-in users to `/dashboard` for protected/admin access failures. Unauthenticated users can still go to `/auth` or the relevant public fallback, but authenticated fallbacks should stop using `/catalog` as the default home. Add explicit tests for these redirects.

### P2 (important improvements)

- **Title:** Signed-in unified header duplicates `Catalog` in both desktop and mobile navigation
- **Evidence:** `src/lib/components/layout/UnifiedHeader.svelte`
  - Public nav always includes `Catalog` at `61-69`
  - Signed-in quick links also start with `Catalog` at `30-39`
  - Desktop signed-in block renders those extra quick links at `105-115`
  - Mobile public menu includes `Catalog` at `171-178`, and the signed-in section re-renders quick links at `213-227`
- **Impact:** Signed-in users on `/` see duplicate primary navigation entries. It looks unfinished and makes the signed-in header harder to parse.
- **Correction:** When signed in, either remove `Catalog` from `signedInQuickLinks` or conditionally change the base public nav so quick links only add routes not already present.

- **Title:** Signed-in homepage still renders anonymous acquisition CTAs that route through `/auth`
- **Evidence:**
  - `src/routes/(home)/+page.svelte:17-54` always renders `Pricing` and `CTA`, regardless of auth state
  - `src/lib/components/marketing/Pricing.svelte:4-10` routes the free plan to `/auth`
  - `src/lib/components/marketing/CTA.svelte:4-31` routes both primary buttons to `/auth`
- **Impact:** The hero and marketplace preview were correctly made signed-in aware, but the lower half of the page still treats authenticated users like anonymous leads. That produces contradictory messaging and unnecessary `/auth` hops before the user is bounced back to `/dashboard` by `src/routes/auth/+page.svelte`.
- **Correction:** Make `Pricing` and `CTA` session-aware, or suppress/replace their auth buttons for signed-in users. At minimum, signed-in homepage CTAs should route directly to `/dashboard`, `/subscription`, or another signed-in destination.

- **Title:** Tests do not validate the routing contract this PR actually changes
- **Evidence:** `tests/e2e/smoke.spec.ts:93-159` only verifies rendering/non-500 behavior for `/`, `/dashboard`, and other pages. It does not assert:
  - signed-in `/auth` -> `/dashboard`
  - unauthenticated `/dashboard` -> `/auth`
  - signed-in unauthorized member/admin routes -> `/dashboard` once corrected
  - auth callback default next behavior
- **Impact:** The existing redirect bug in `src/hooks.server.ts` survives precisely because the tests do not assert destination correctness. For a routing-heavy PR, this is the highest-value coverage and it is mostly missing.
- **Correction:** Add focused redirect tests instead of relying on smoke-only checks. If Playwright auth setup remains brittle, add server-level route tests where possible and fix the test environment separately.

### P3 (nice to have)

- **Title:** Dashboard/home preview loading is now duplicated and likely to drift
- **Evidence:** `src/routes/(home)/+page.server.ts` and `src/routes/dashboard/+page.server.ts` both fetch the same recent arrivals preview with the same `searchCatalog` parameters and similar error handling.
- **Impact:** Any future change to preview limits, sort order, or fallback behavior now needs to be updated in two places. This is low severity today, but it is unnecessary duplication in a PR that already touches routing and page identity.
- **Correction:** Extract a shared helper for the recent-arrivals preview load or centralize the query parameters in one utility.

## Assumptions Review

- Assumption: Updating auth page redirects and the new dashboard route is enough to make `/dashboard` the canonical logged-in home.

  - Validity: Invalid
  - Why: `src/hooks.server.ts:119-124` still routes failed protected/admin requests to `/catalog`.
  - Recommended action: Update server-side guard fallbacks for authenticated users and test them.

- Assumption: Leaving the rest of the marketing homepage anonymous-only is acceptable for signed-in users.

  - Validity: Weak
  - Why: `Hero` and the preview block are signed-in aware, but `Pricing` and `CTA` still present sign-up/sign-in acquisition flows.
  - Recommended action: Make lower-page CTAs conditional on session state or replace them with signed-in actions.

- Assumption: `next` on the auth callback is safe because current callers generate it.

  - Validity: Weak
  - Why: `src/routes/auth/callback/+server.ts:6,16` accepts any query-string `next` and redirects to it without validation.
  - Recommended action: Restrict `next` to same-origin relative paths, or whitelist allowed internal destinations.

- Assumption: Smoke tests are sufficient validation for a routing PR.
  - Validity: Invalid
  - Why: The tests prove pages render, not that the redirect destinations changed to the new canonical home.
  - Recommended action: Add explicit redirect assertions for the changed flows.

## Tech Debt Notes

- Debt introduced:
  - Duplicate recent-arrivals loading between home and dashboard
  - More session-aware behavior split across `Hero`, `UnifiedHeader`, homepage content blocks, auth page redirect logic, auth callback, and hooks
- Debt worsened:
  - `next` redirect trust in `src/routes/auth/callback/+server.ts` is still unresolved even though this PR increases the centrality of callback-driven routing
- Suggested follow-up tickets:
  1. Consolidate recent-arrivals preview loading for homepage and dashboard
  2. Centralize signed-in vs anonymous CTA behavior for marketing components
  3. Sanitize `next` in auth callback and add regression coverage for auth redirects

## Product Alignment Notes

- Alignment wins:
  - `/` is now genuinely public-first for signed-in users as well as anonymous users
  - `/dashboard` is a clearer mental model than overloading `/` as both marketing page and logged-in app shell
  - Header and hero copy acknowledge signed-in state without breaking public-page SEO/meta generation
- Misalignments:
  - Guard failures still land on `/catalog`, which undermines `/dashboard` as the canonical app home
  - Signed-in header duplicates `Catalog`
  - Lower-page CTAs still speak to signed-in users like new leads
- Suggested product checks:
  - Decide the intended fallback for signed-in users rejected from member/admin routes; I strongly recommend `/dashboard`
  - Decide whether signed-in users should see acquisition pricing/CTA sections unchanged, adapted, or hidden on `/`

## Test Coverage Assessment

- Existing tests that validate changes:
  - `tests/e2e/smoke.spec.ts` now checks that signed-in users can load `/` and `/dashboard`
  - `pnpm run check` passed locally with 0 errors / 0 warnings
- Missing tests:
  - Signed-in visit to `/auth` should redirect to `/dashboard`
  - Unauthenticated visit to `/dashboard` should redirect to `/auth`
  - Signed-in viewer hitting `/beans` or `/admin` should land on `/dashboard` after the guard fix
  - Auth callback should default to `/dashboard` and reject unsafe `next` values
  - Signed-in homepage should not render duplicate `Catalog` entries in nav
- Suggested test additions:
  1. Add focused Playwright tests for redirect destinations, not just page survival
  2. Add at least one server-level test or lightweight integration test around `auth/callback` next sanitization
  3. Add a signed-in header regression check to assert unique nav labels on `/`
- Verification limitations:
  - Browser smoke run could not complete in this environment because `tests/e2e/auth.setup.ts` failed with `403 bad_jwt` while generating the auth link, so I could not independently observe the full signed-in flow end-to-end here

## Minimal Correction Plan

1. Fix `src/hooks.server.ts` so authenticated fallback redirects for protected/admin routes go to `/dashboard`, then add explicit tests for those destinations.
2. Clean up `src/lib/components/layout/UnifiedHeader.svelte` so signed-in users do not see duplicate `Catalog` entries.
3. Make `src/lib/components/marketing/Pricing.svelte` and `src/lib/components/marketing/CTA.svelte` session-aware, or gate them from signed-in homepage users.

## Optional Patch Guidance

- `src/hooks.server.ts`
  - Split fallback behavior by auth state
  - For signed-in users who fail `member` or `admin` checks, redirect to `/dashboard`
  - Keep unauthenticated behavior explicit and intentional; do not rely on `/catalog` as a catch-all if the product now considers `/dashboard` the logged-in home
- `tests/e2e/smoke.spec.ts` or a new focused routing spec
  - Add redirect assertions for `/auth`, `/dashboard`, and protected routes under different auth/role states
- `src/lib/components/layout/UnifiedHeader.svelte`
  - Remove duplicated `Catalog` rendering in signed-in mode; quick links should only add app-specific destinations not already in the public nav
- `src/routes/(home)/+page.svelte`
  - Pass auth state into lower marketing blocks or conditionally render signed-in variants
- `src/lib/components/marketing/Pricing.svelte`
  - Free-plan CTA should not send an already-signed-in user to `/auth`
- `src/lib/components/marketing/CTA.svelte`
  - Replace `Sign In` / `Start free trial` with dashboard/subscription-oriented actions when `session` exists
- `src/routes/auth/callback/+server.ts`
  - Normalize `next` to a safe internal path before redirecting
