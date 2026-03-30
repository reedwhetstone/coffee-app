# PR Verification Report

## Metadata

- Repo: `/root/.openclaw/workspace/repos/coffee-app`
- Base: `origin/main`
- Head: `origin/feat/principal-foundation-v1`
- PR # (if available): `180`
- Reviewer model: `github-copilot/gpt-5.4`
- Confidence: Medium-High
- Scope note: Read `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff` from `.verify-pr/20260326T205311Z-origin-feat-principal-foundation-v1`. Inspected the changed files in branch context with line-level review. Ran the new `principal.test.ts` in a temp export; it passed. A full `svelte-check` run from the temp export was not conclusive because generated env typings were unavailable in that isolated checkout, so confidence comes primarily from code inspection plus the targeted unit test run.

## Executive Verdict

- Merge readiness: Not ready
- Intent coverage: Partial
- Priority summary: P0: 0, P1: 2, P2: 3, P3: 0

## Intent Verification

- Stated intent:
  - Introduce a shared principal/auth normalization layer.
  - Normalize session-backed and API-key-backed callers into one model.
  - Update auth helpers to use that model.
  - Wire it into hooks/locals.
  - Migrate the external catalog API to the shared API-key principal path.
  - Add `/v1` scaffolding and a placeholder `/v1/catalog` without doing the full cutover yet.
- What was implemented:
  - Added `src/lib/server/principal.ts` with anonymous, session, and API-key principal shapes plus shared role/plan/scope helpers.
  - Updated `src/lib/server/auth.ts` to resolve principals centrally and added `requireApiKeyAccess`.
  - Updated `src/hooks.server.ts` to memoize session context, populate `event.locals.principal`, and keep locals/session wiring intact.
  - Migrated `src/routes/api/catalog-api/+server.ts` to the shared API-key principal path.
  - Added `/v1` and `/v1/catalog` scaffold endpoints.
  - Added unit tests for principal helper functions.
- Coverage gaps:
  - The new shared principal path is not fail-closed for API-key role lookup failures.
  - The new session-origin trust model is not actually enforced for admin mutation routes that go through `validateAdminAccess`.
  - Role normalization is not complete for legacy underscore spellings that the codebase still documents and maps elsewhere.
  - Tests cover only helper functions, not end-to-end principal resolution or route integration.

## Checklist Coverage

### 1) Intent Coverage
- Does implementation fully satisfy the stated PR intent? `CONCERN`
- Are acceptance criteria covered, not partially interpreted? `CONCERN`
- Any intent drift between description and code? `PASS`
- Any features implied by intent but missing in implementation? `FAIL`

### 2) Correctness
- Logic correctness across happy path and edge cases: `CONCERN`
- Error handling completeness and failure mode behavior: `FAIL`
- Input validation and type safety: `PASS`
- Null/undefined/empty-state handling: `CONCERN`
- Time/date/locale assumptions: `PASS`

### 3) Codebase Alignment
- Consistent with existing architecture and patterns: `PASS`
- Reuses existing abstractions where appropriate: `PASS`
- Avoids duplicating existing utilities/business logic: `PASS`
- Naming, file placement, and module boundaries match project conventions: `PASS`

### 4) Risk and Regressions
- Backward compatibility impact: `CONCERN`
- Side effects on adjacent systems or consumers: `CONCERN`
- Race conditions, ordering issues, idempotency risks: `PASS`
- Migration/deployment sequencing risk: `CONCERN`
- Monitoring/observability impact: `PASS`

### 5) Security and Data Safety
- Authz/authn boundaries preserved: `FAIL`
- Sensitive data handling unchanged or improved: `PASS`
- Injection, path traversal, unsafe eval/exec vectors introduced?: `PASS`
- Trust boundary assumptions explicitly safe?: `FAIL`
- Secrets handling and logging hygiene: `PASS`

### 6) Test and Verification Quality
- Tests cover changed behavior and key edge cases: `FAIL`
- Existing tests updated where behavior changed: `CONCERN`
- Missing tests for discovered high-risk paths: `FAIL`
- Assertions meaningful vs shallow snapshot checks: `PASS`

### 7) Tech Debt and Maintainability
- New debt introduced: `CONCERN`
- Existing debt worsened by this change: `CONCERN`
- Refactor opportunities that should be done now vs deferred: `CONCERN`
- Clarity/readability for future maintainers: `PASS`

### 8) Product and UX Alignment
- Behavior matches product intent, not just technical completion: `CONCERN`
- User-visible outcomes and copy are coherent: `PASS`
- Failure UX acceptable and actionable: `CONCERN`
- Metrics/events support product decision-making where needed: `PASS`

### 9) Assumptions Audit
- List assumptions made by implementation: covered below
- Mark each assumption as valid/weak/invalid: covered below
- Identify assumptions that conflict with current codebase reality: covered below
- Identify hidden assumptions not documented in PR: covered below

### 10) Final Verdict
- Merge readiness: `Not ready`
- Highest severity issue level found: `P1`
- Minimal fix set required before merge: covered below

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

#### 1) API-key principal resolution fails open when role lookup fails
- **Evidence:**
  - `src/lib/server/principal.ts:150-165` returns `['viewer']` whenever the `user_roles` lookup errors or returns no row.
  - `src/lib/server/principal.ts:297-311` always builds an API-key principal from that fallback role set.
  - `src/routes/api/catalog-api/+server.ts:30-38` only requires plan `viewer` plus scope `catalog:read`, which every fallback viewer principal receives.
- **Impact:**
  - A valid API key continues to access `/api/catalog-api` even if the principal's role lookup fails. That is a fail-open authorization path in the new shared foundation.
  - This is a regression relative to the old catalog route, which explicitly denied when the `user_roles` lookup failed.
  - It also bakes together two different semantics that should stay separate: UI-friendly fallback-to-viewer and authz-critical API-key identity resolution.
- **Correction:**
  - Split role loading into two modes:
    - a permissive `getUserRolesOrViewer` for non-critical UI/session decoration, if still needed
    - a strict `requireUserRoles` or `getUserRolesStrict` for principal resolution on API keys
  - In `resolveApiKeyPrincipal`, fail closed if the owning user's roles cannot be loaded.
  - Add route-level tests proving `/api/catalog-api` returns 401/403 when the role lookup fails after key validation.

#### 2) The new mutation trust check is not wired through admin auth, leaving admin POSTs outside the shared protection model
- **Evidence:**
  - `src/lib/server/auth.ts:63-66` defines the new session mutation trust gate.
  - `src/lib/server/auth.ts:69-88` applies it in `requireUserAuth`.
  - `src/lib/server/auth.ts:159-176` changed `validateAdminAccess` to accept only `locals`, so it has no access to the request/event and cannot apply the same check.
  - `src/routes/api/admin/stripe-role-discrepancies/+server.ts:236-239` uses `validateAdminAccess(locals)` for a POST endpoint that mutates roles.
- **Impact:**
  - The PR introduces a new source-aware trust model for session mutations, but admin mutation routes bypass it because the admin helper cannot inspect the request.
  - That makes the new foundation internally inconsistent and leaves the highest-privilege write path outside the new guardrail.
- **Correction:**
  - Change `validateAdminAccess` to accept `RequestEvent` or both `event` and `locals`.
  - Reuse the same shared trusted-mutation check for unsafe session-backed admin requests.
  - Add tests for a cross-origin admin POST and a same-origin admin POST.

### P2 (important improvements)

#### 1) Invalid Authorization headers silently fall back to cookie-session auth
- **Evidence:**
  - `src/lib/server/principal.ts:319-329` tries bearer resolution first, but if the header is present and invalid it simply falls through.
  - `src/lib/server/principal.ts:331-343` then resolves a cookie-session principal.
- **Impact:**
  - Requests that explicitly present bad bearer credentials can still succeed under a different principal if a browser cookie session exists.
  - That weakens source clarity and makes auth failures harder to reason about. It also increases the chance of accidental success under the wrong auth mechanism during the future `/v1` cutover.
- **Correction:**
  - Decide whether an explicit `Authorization` header should be authoritative.
  - If yes, stop on invalid bearer credentials instead of falling back to cookies.
  - If no, document that precedence explicitly and add tests for invalid-header-plus-cookie combinations.

#### 2) Shared role normalization does not actually normalize documented legacy underscore API roles
- **Evidence:**
  - `src/lib/server/principal.ts:126-145` only recognizes `api`, `api-member`, and `api-enterprise`; it does not accept `api_viewer`, `api_member`, or `api_enterprise`.
  - `src/lib/types/database.types.ts:1199` and `src/lib/types/database.types.ts:1334` still document underscore spellings.
  - `supabase/migrations/001_full_schema.sql:16-33` also defines underscore enum values in the schema history.
  - `src/lib/server/apiAuth.ts:34-42` already carries explicit legacy underscore mapping, which is evidence that these spellings matter in this codebase.
- **Impact:**
  - If any existing `user_roles.user_role` arrays still contain underscore spellings, the new principal layer downgrades them to `viewer`.
  - On the migrated catalog API path, that would incorrectly apply free-tier row and rate limits to paid API users.
- **Correction:**
  - Extend `normalizeRoleValue` to map underscore legacy spellings to canonical hyphenated role names.
  - Add tests for `api_viewer`, `api_member`, and `api_enterprise` inputs.
  - Audit production role data before relying on the new foundation for `/v1` cutover.

#### 3) Tests only cover helper functions, not the risky principal-resolution and route-integration paths
- **Evidence:**
  - `src/lib/server/principal.test.ts:18-134` covers helper normalization, scope matching, plan checks, and origin checks only.
  - There are no tests for `resolvePrincipal`, `requireApiKeyAccess`, `hooks.server.ts` principal wiring, header-vs-cookie precedence, or the migrated `/api/catalog-api` route behavior.
- **Impact:**
  - The highest-risk logic in this PR is integration logic, not the pure helper functions.
  - The current test suite would not catch either P1 issue above.
- **Correction:**
  - Add tests for:
    - valid API key -> API principal
    - valid bearer session -> session principal
    - invalid Authorization header with active cookie session
    - API-key principal when role lookup fails
    - cross-origin admin POST rejection once fixed
    - `/api/catalog-api` tier, scope, and denial behavior

### P3 (nice to have)

None.

## Assumptions Review

- Assumption: A `user_roles` lookup failure should degrade to `viewer` everywhere.
  - Validity: Invalid
  - Why: That is acceptable for some UI decoration flows, but not for API-key principal resolution where authorization should fail closed.
  - Recommended action: Split strict authz identity loading from permissive UI fallback logic.

- Assumption: Admin auth checks do not need access to the request object.
  - Validity: Invalid
  - Why: This PR introduces request-aware trust checks for session mutations. A helper that only receives `locals` cannot participate in that model.
  - Recommended action: Pass `RequestEvent` into `validateAdminAccess` and enforce the shared trust rule for unsafe methods.

- Assumption: The only API-role spellings that matter are the canonical hyphenated ones.
  - Validity: Weak
  - Why: The schema history, generated DB types, and explicit legacy mapping in `apiAuth.ts` all say underscore spellings are part of this codebase's reality.
  - Recommended action: Normalize both spellings now, before `/v1` cutover depends on this shared layer.

- Assumption: Falling back from an invalid Authorization header to cookies is acceptable behavior.
  - Validity: Weak
  - Why: It may be intentional, but it is not documented and creates ambiguous principal selection.
  - Recommended action: Make precedence explicit in code and tests.

## Tech Debt Notes

- Debt introduced:
  - `getUserRoles` now serves both permissive display/session use and security-critical principal resolution. Those two responsibilities want different failure behavior.
  - `validateAdminAccess(locals)` now hard-codes a request-blind interface into the shared auth layer.
- Debt worsened:
  - Legacy role spelling drift remains unresolved even though this PR is explicitly the normalization foundation.
  - The test suite still exercises only pure helpers while the branch now centralizes more cross-cutting auth behavior behind one resolver.
- Suggested follow-up tickets:
  - Add strict role-loading helpers for authz-critical resolution paths.
  - Normalize and backfill legacy role spellings in `user_roles.user_role`.
  - Add integration tests for principal resolution precedence and route auth behavior.
  - Define and document credential precedence rules for `/api/*` and future `/v1/*` endpoints.

## Product Alignment Notes

- Alignment wins:
  - The branch does establish a coherent principal abstraction and moves the catalog API onto it.
  - `/v1` and `/v1/catalog` scaffolding accurately communicate that cutover is not done yet.
- Misalignments:
  - The new foundation does not fully normalize known legacy role variants, which is exactly the kind of compatibility detail this PR should absorb.
  - Paid API behavior may be misclassified as free-tier behavior if legacy underscore role values still exist.
- Suggested product checks:
  - Verify what role strings are actually present in production `user_roles.user_role` arrays.
  - Verify whether any clients intentionally rely on cookie fallback when an Authorization header is present.
  - Confirm whether admin mutation routes are expected to be protected by the new session-origin rule.

## Test Coverage Assessment

- Existing tests that validate changes:
  - `src/lib/server/principal.test.ts` covers role normalization, primary-role selection, scope parsing, plan/scope checks, and origin-check helper behavior.
  - Targeted unit execution passed in temp export: `pnpm exec vitest run src/lib/server/principal.test.ts`.
- Missing tests:
  - `resolvePrincipal` precedence and fallback behavior
  - API-key principal creation when role lookup fails
  - Legacy underscore role normalization
  - `requireApiKeyAccess` route integration for `/api/catalog-api`
  - Admin mutation trust checks
  - Hook wiring for `event.locals.principal`
- Suggested test additions:
  - Mocked route tests around `resolvePrincipal` and `requireApiKeyAccess`
  - An auth integration suite for `/api/catalog-api`
  - A mutation-trust suite that covers session cookie, bearer session, and API-key callers separately

## Minimal Correction Plan

1. Make API-key principal resolution fail closed when `user_roles` cannot be loaded; add a route test proving `/api/catalog-api` denies in that case.
2. Refactor `validateAdminAccess` to accept `RequestEvent` and enforce the shared trusted-mutation rule for unsafe session-backed admin requests.
3. Extend shared role normalization to accept underscore legacy API-role spellings, then add tests covering those inputs.

## Optional Patch Guidance

- `src/lib/server/principal.ts`
  - Split permissive role fallback from strict authz resolution.
  - Add underscore legacy role mappings in `normalizeRoleValue`.
  - Decide and codify whether invalid `Authorization` should short-circuit cookie fallback.
- `src/lib/server/auth.ts`
  - Change `validateAdminAccess` to accept `RequestEvent` and run the shared trust check for unsafe methods.
- `src/routes/api/admin/stripe-role-discrepancies/+server.ts`
  - Pass the full event into `validateAdminAccess` after refactor.
- `src/routes/api/catalog-api/+server.ts`
  - Add tests for role-lookup failure, scope failure, and tier mapping.
- `src/lib/server/principal.test.ts`
  - Expand beyond helper-only tests to include resolver and precedence cases.
