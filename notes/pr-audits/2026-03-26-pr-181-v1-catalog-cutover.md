# PR Verification Report

## Metadata

- Repo: `/root/.openclaw/workspace/repos/coffee-app`
- Base: `origin/main`
- Head: `origin/feat/v1-catalog-cutover`
- PR # (if available): 181
- Reviewer model: `github-copilot/gpt-5.4` (subagent audit run under OpenClaw)
- Confidence: High
- Scope note: Reviewed `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff`; inspected the PR head directly via `git show` plus repo-context files outside the diff; ran the branch in an isolated worktree and executed the affected Vitest suite successfully. `pnpm check` in the isolated worktree was not a reliable signal because env-backed `$env/static/*` exports were unavailable there.

## Executive Verdict

- Merge readiness: Not ready
- Intent coverage: Partial
- Priority summary: P0: 0, P1: 2, P2: 1, P3: 1

## Checklist Summary

- 1. Intent Coverage: **FAIL**
  - Canonical `/v1/catalog` exists and legacy routes delegate to shared builders, but page-side catalog consumers still do not consistently enforce the same visibility/auth policy, and the external compatibility alias no longer preserves legacy contract details.
- 2. Correctness: **FAIL**
  - Viewer and anonymous page flows can still see inconsistent catalog data/filter metadata versus the canonical resource.
- 3. Codebase Alignment: **CONCERN**
  - The new canonical builder is solid, but page SSR preview and filter metadata still bypass it with bespoke queries.
- 4. Risk and Regressions: **FAIL**
  - `/api/catalog-api` regresses compatibility on field projection, ordering, and cache semantics.
- 5. Security and Data Safety: **FAIL**
  - Non-member page consumers still have paths that can observe non-public catalog details or metadata outside the canonical visibility rules.
- 6. Test and Verification Quality: **CONCERN**
  - New tests cover route delegation and some auth edge cases, but there is no regression coverage for public/viewer catalog visibility on page loads or for the legacy external alias contract.
- 7. Tech Debt and Maintainability: **CONCERN**
  - Visibility policy is still split across canonical resource code, page SSR code, and filter metadata code.
- 8. Product and UX Alignment: **FAIL**
  - Public/viewer catalog UX can show filter options or SSR preview items that the canonical API immediately hides.
- 9. Assumptions Audit: **FAIL**
  - Several implementation assumptions are weak or invalid; see Assumptions Review.
- 10. Final Verdict: **Not ready**, highest severity **P1**

## Intent Verification

- Stated intent:

  - Make `/v1/catalog` the canonical catalog resource.
  - Cut both internal and external consumers over to shared logic/contract.
  - Turn `/api/catalog` and `/api/catalog-api` into explicit compatibility shims.
  - Absorb the remaining page-auth alignment work where catalog/page consumption intersects.

- What was implemented:

  - Added a substantial shared catalog builder in `src/lib/server/catalogResource.ts`.
  - Wired `/v1/catalog`, `/api/catalog`, and `/api/catalog-api` through that shared builder.
  - Updated catalog client fetches to hit `/v1/catalog`.
  - Added principal-aware hooks/page-auth plumbing and docs updates.

- Coverage gaps:
  - Page-side catalog preview and filter metadata still do not share the canonical visibility rules.
  - The external alias only reshapes the top-level envelope; it does not preserve the legacy external contract's restricted field set, ordering, or cache behavior.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

#### 1) Page-side catalog consumers still bypass the canonical visibility policy

- **Evidence:**
  - Canonical visibility is member-gated, not merely session-gated: `src/lib/server/catalogResource.ts:253-263` sets `publicOnly` to `!isPrivilegedSession`, where `isPrivilegedSession` requires `principalHasRole(principal, 'member')`.
  - The public catalog SSR preview still checks only `locals.session`: `src/routes/catalog/+page.server.ts:8-20`. A logged-in `viewer` session skips the `public_coffee` filter and can receive non-public rows in the initial SSR payload.
  - The public catalog filter metadata route never applies any `public_coffee` restriction at all: `src/routes/api/catalog/filters/+server.ts:4-23`.
  - The public catalog UI now hydrates from `/v1/catalog`, but still fetches filter options from the old direct table route: `src/lib/stores/filterStore.ts:145` and `src/lib/stores/filterStore.ts:171-190`.
- **Impact:**
  - Logged-in viewers can receive non-public catalog preview rows on first render, even though the canonical resource correctly treats them as public-only.
  - Anonymous and viewer users can see filter values sourced from non-public coffees, creating both an information leak and dead-end UX where a visible filter option yields zero canonical results.
  - This is a direct miss against the stated page-auth alignment goal.
- **Correction:**
  - Extract a shared catalog visibility helper from the canonical access logic, for example a `canSeeInternalCatalog(principal|locals)` decision, and apply it to both `src/routes/catalog/+page.server.ts` and `src/routes/api/catalog/filters/+server.ts`.
  - Do not key internal catalog visibility off mere session presence; use the same member/admin privilege rule as `/v1/catalog`.
  - Add regression tests for anonymous and viewer sessions covering SSR preview data and filter metadata.

#### 2) `/api/catalog-api` no longer behaves like a compatibility shim; it changes the legacy external contract

- **Evidence:**
  - The legacy external route is now a thin delegate: `src/routes/api/catalog-api/+server.ts` calls `buildLegacyExternalCatalogResponse()`.
  - That compatibility builder forwards `body.data` directly from the canonical response: `src/lib/server/catalogResource.ts:503-544`.
  - Canonical non-dropdown responses come from `searchCatalog(...select('*')...)` with default ordering `arrival_date desc`: `src/lib/server/catalogResource.ts:325-352` and `src/lib/data/catalog.ts` shared search path.
  - On `origin/main`, `/api/catalog-api` explicitly used `getPublicCatalog(supabase, CATALOG_API_COLUMNS)` and `getPublicCatalog()` explicitly ordered by `name`: `origin/main:src/routes/api/catalog-api/+server.ts` and `origin/main:src/lib/data/catalog.ts`.
  - The old route also carried cache semantics; the new alias hardcodes `cached` from canonical `meta.cache.hit`, but canonical cache metadata is always `hit: false` / `timestamp: null`: `src/lib/server/catalogResource.ts:317-320`, `386-389`, `519-531`.
- **Impact:**
  - Existing `/api/catalog-api` consumers now receive a broader row shape than before, including fields the old external contract intentionally did not expose through `CATALOG_API_COLUMNS`.
  - Default item ordering changes from name-sorted to arrival-date-sorted.
  - Legacy cache-related semantics now silently degrade.
  - That is not an explicit compatibility shim; it is a behavior change behind a legacy URL.
- **Correction:**
  - In `buildLegacyExternalCatalogResponse`, project canonical data back down to the legacy external column set and preserve the legacy default ordering.
  - Decide explicitly whether legacy cache semantics are still supported. If yes, reintroduce them at the alias layer. If no, this needs a deliberate breaking-change/versioning decision, not a silent alias drift.
  - Add route-level regression tests that assert `/api/catalog-api` field projection, ordering, and cache metadata behavior.

### P2 (important improvements)

#### 1) Page auth normalization is still incomplete; role is preserved even when page session auth is intentionally stripped

- **Evidence:**
  - `getPageAuthState()` nulls `user` when there is no page session, but still returns `role: locals.role ?? 'viewer'`: `src/lib/server/pageAuth.ts:4-15`.
  - `src/routes/+layout.server.ts:4-34` exports that role to all pages.
  - For bearer-session requests, `hooks.server.ts` intentionally normalizes page auth away from cookie-less auth, but role can still remain elevated in layout data.
- **Impact:**
  - Public pages can render member/admin affordances based on a bearer-authenticated request that is not supposed to count as a page session.
  - This is a partial miss of the PR A alignment work absorbed here.
- **Correction:**
  - Treat `role` as page-session-derived in `getPageAuthState()`, or add a distinct `pageRole` that degrades to `viewer` when `session` is null.
  - Add a layout/page-load regression test for bearer-session requests to public pages.

### P3 (nice to have)

#### 1) Test coverage still misses the highest-risk integration regressions introduced by the cutover

- **Evidence:**
  - New tests cover canonical builder happy paths and route delegation.
  - There are no tests covering:
    - anonymous/viewer public catalog SSR preview visibility,
    - `/api/catalog/filters` public-only behavior,
    - `/api/catalog-api` field projection/order/cache compatibility.
- **Impact:**
  - The two biggest regressions in this PR are precisely the ones current tests would not catch.
- **Correction:**
  - Add focused route/integration tests around public/viewer visibility and alias compatibility, not just delegate wiring.

## Assumptions Review

- Assumption: Any cookie-backed session may see the internal catalog preview on `/catalog`.
- Validity: Invalid
- Why: The canonical resource only grants internal visibility to privileged member/admin sessions, not to any logged-in viewer session.
- Recommended action: Replace the `if (!locals.session)` check with the same privilege predicate used by the canonical resource.

- Assumption: Legacy external compatibility only requires a top-level JSON reshaping.
- Validity: Invalid
- Why: The previous `/api/catalog-api` contract also encoded a specific field projection, ordering, and cache semantics.
- Recommended action: Reconstruct those semantics deliberately in `buildLegacyExternalCatalogResponse()` or explicitly version the break.

- Assumption: `/api/catalog/filters` can continue querying `coffee_catalog` directly after the `/v1/catalog` cutover.
- Validity: Invalid
- Why: It now diverges from the canonical resource's visibility rules and exposes metadata for rows the user cannot actually fetch.
- Recommended action: Reuse the shared access/visibility policy or source unique values from the canonical query path.

- Assumption: Preserving elevated `role` while stripping session/user is harmless for page auth.
- Validity: Weak
- Why: Layout and navigation code still consume that role and can render misleading page affordances.
- Recommended action: Normalize page-facing role alongside session/user.

## Tech Debt Notes

- Debt introduced:

  - Visibility policy is still duplicated across canonical resource code, page SSR preview code, and filter metadata code.
  - The external alias now depends on implicit canonical behavior instead of an explicit compatibility contract.

- Debt worsened:

  - `CATALOG_API_COLUMNS` and `getPublicCatalog()` remain in the codebase, but the new alias path no longer uses them, which makes the intended external contract ambiguous.

- Suggested follow-up tickets:
  - Extract `resolveCatalogVisibility()` / `canSeeInternalCatalog()` into a shared server helper.
  - Add explicit contract tests for `/v1/catalog`, `/api/catalog`, and `/api/catalog-api`.
  - Decide whether legacy alias cache behavior is preserved, deprecated, or versioned away.

## Product Alignment Notes

- Alignment wins:

  - `/v1/catalog` is real and the app now points its primary filter-store fetches at the canonical resource.
  - Legacy aliases clearly annotate the canonical resource via `X-Purveyors-Canonical-Resource`.

- Misalignments:

  - Viewer and anonymous catalog experiences can still expose data or filter metadata outside the canonical public contract.
  - The external alias drifts from compatibility while still presenting itself as a legacy alias.

- Suggested product checks:
  - Confirm whether non-member logged-in users are ever allowed to see non-public catalog rows. Current canonical logic says no; page SSR must match.
  - Confirm whether `/api/catalog-api` is promised to remain backward compatible for existing external integrations. If yes, restore contract details before merge.

## Test Coverage Assessment

- Existing tests that validate changes:

  - `src/lib/server/catalogResource.test.ts` covers anonymous, member-session, and API-key happy paths for the canonical builder.
  - `src/hooks.server.test.ts` covers invalid Authorization handling and bearer-session page-route redirects.
  - Route tests for `/v1/catalog`, `/api/catalog`, and `/api/catalog-api` confirm delegation wiring.
  - In isolated worktree validation, the relevant Vitest suite passed.

- Missing tests:

  - Viewer-session SSR preview on `/catalog` should remain public-only.
  - `/api/catalog/filters` should match canonical public-only/member-only visibility.
  - `/api/catalog-api` should assert legacy field projection, default ordering, and cache metadata behavior.
  - Layout/public page behavior under bearer-session requests should not expose elevated page affordances.

- Suggested test additions:
  - A route test for `/catalog/+page.server.ts` with viewer vs member locals.
  - A route test for `/api/catalog/filters/+server.ts` under anonymous/viewer/member contexts.
  - A compatibility contract test for `buildLegacyExternalCatalogResponse()`.

## Minimal Correction Plan

1. Extract the catalog visibility/privilege rule from `resolveCatalogAccessContext()` into a shared helper and apply it to all page-side catalog consumers, especially `src/routes/catalog/+page.server.ts` and `src/routes/api/catalog/filters/+server.ts`.
2. Restore explicit legacy external alias semantics in `src/lib/server/catalogResource.ts`, including field projection and default ordering; make cache behavior an explicit decision instead of an accidental loss.
3. Normalize page-facing auth state so role does not stay elevated when `session` is null, then add regression tests for viewer/bearer public-page behavior.

## Optional Patch Guidance

- `src/lib/server/catalogResource.ts`

  - Add a reusable access helper for canonical/page-side consumers.
  - For `buildLegacyExternalCatalogResponse()`, map canonical rows back to the legacy public external field subset before responding.
  - Reapply legacy ordering and decide explicitly on cache behavior.

- `src/routes/catalog/+page.server.ts`

  - Replace `if (!locals.session)` with a privilege-aware check that matches canonical access rules.
  - Consider sourcing the SSR preview through a shared query helper so visibility and ordering cannot drift again.

- `src/routes/api/catalog/filters/+server.ts`

  - Apply the same public-only/member-only visibility policy as `/v1/catalog`.
  - Consider reusing shared query/filter helpers rather than raw table queries.

- `src/lib/server/pageAuth.ts` and `src/routes/+layout.server.ts`

  - Normalize page-facing role to viewer when there is no cookie-backed session, or expose a separate session-derived page role.

- Tests
  - Add regression tests for viewer/anonymous visibility, filter metadata, and legacy external alias compatibility.
