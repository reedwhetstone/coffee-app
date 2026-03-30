# PR Verification Report

## Metadata

- Repo: `/root/.openclaw/workspace/repos/coffee-app`
- Base: `origin/main`
- Head: `origin/feat/principal-foundation-v1`
- PR # (if available): `180`
- Reviewer model: `github-copilot/gpt-5.4`
- Confidence: High
- Scope note: Read `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff` from `.verify-pr/20260326T211218Z-origin-feat-principal-foundation-v1`. Inspected the changed files in branch context from a detached worktree at `/tmp/coffee-app-pr180-audit`. Ran `pnpm run sync`, `vitest run src/lib/server/principal.test.ts src/lib/server/auth.test.ts`, and `svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` in that worktree; targeted tests passed and `svelte-check` passed once required static env vars were stubbed for type generation.

## Executive Verdict

- Merge readiness: Not ready
- Intent coverage: Partial
- Priority summary: P0: 0, P1: 1, P2: 2, P3: 0

## Intent Verification

- Stated intent:
  - Introduce a shared principal/auth normalization foundation.
  - Normalize session-backed and API-key-backed callers into one model.
  - Update auth helpers to use that model.
  - Wire it into hooks/locals.
  - Migrate the external catalog API to the shared API-key principal path.
  - Add `/v1` scaffolding and a placeholder `/v1/catalog` for later cutover.
- What was implemented:
  - Added `src/lib/server/principal.ts` with anonymous, session, and API-key principal shapes plus shared role, plan, scope, and request-trust helpers.
  - Updated `src/lib/server/auth.ts` to resolve principals centrally and added API-key access helpers.
  - Updated `src/hooks.server.ts` to memoize session context, populate `event.locals.principal`, and keep legacy `locals.session/user/role` wiring.
  - Migrated `src/routes/api/catalog-api/+server.ts` to the shared API-key principal path.
  - Added `/v1` and `/v1/catalog` scaffold endpoints.
  - Added targeted tests in `src/lib/server/principal.test.ts` and `src/lib/server/auth.test.ts`.
- Coverage gaps:
  - The rerun head correctly fixes the first-pass defects: API-key role lookup now fails closed, legacy underscore API roles are normalized, and `validateAdminAccess` now takes the full `RequestEvent` and enforces the mutation-trust gate.
  - One session auth helper still sits outside that trust model: `requireAuth()` resolves the normalized principal but does not apply the unsafe-method/session-origin check, so the foundation is still internally inconsistent.
  - Hooks expose `locals.principal`, but `locals.session/user/role` remain cookie-derived and can diverge from bearer/API-key principal resolution. That means the “wired into hooks/locals” part is only partial.

## Checklist Coverage

### 1) Intent Coverage
- Does implementation fully satisfy the stated PR intent? `CONCERN`
- Are acceptance criteria covered, not partially interpreted? `CONCERN`
- Any intent drift between description and code? `PASS`
- Any features implied by intent but missing in implementation? `CONCERN`

### 2) Correctness
- Logic correctness across happy path and edge cases: `CONCERN`
- Error handling completeness and failure mode behavior: `PASS`
- Input validation and type safety: `PASS`
- Null/undefined/empty-state handling: `PASS`
- Time/date/locale assumptions: `PASS`

### 3) Codebase Alignment
- Consistent with existing architecture and patterns: `CONCERN`
- Reuses existing abstractions where appropriate: `CONCERN`
- Avoids duplicating existing utilities/business logic: `CONCERN`
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
- Trust boundary assumptions explicitly safe?: `CONCERN`
- Secrets handling and logging hygiene: `PASS`

### 6) Test and Verification Quality
- Tests cover changed behavior and key edge cases: `CONCERN`
- Existing tests updated where behavior changed: `PASS`
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
- Failure UX acceptable and actionable: `PASS`
- Metrics/events support product decision-making where needed: `N/A`

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

#### 1) `requireAuth()` still bypasses the shared trusted-mutation guard for unsafe session-backed requests
- **Evidence:**
  - `src/lib/server/auth.ts:31-39` now resolves the normalized principal, but it returns any session principal directly and never calls `assertSessionMutationIsTrusted()`.
  - `src/lib/server/auth.ts:63-83` does apply that trust gate in `requireUserAuth()`, so the policy exists but is not shared across all session auth helpers.
  - `src/routes/api/ai/classify-roast/+server.ts:37-43` uses `requireAuth(event)` on a `POST` route, and the route comment still frames that endpoint as bearer-driven auth for CLI callers.
- **Impact:**
  - The PR’s new unsafe-method trust rule is still not consistently enforced across session-backed auth helpers.
  - A cookie-backed request can reach `POST /api/ai/classify-roast` through `requireAuth()` without the same cross-site/session trust check now enforced elsewhere.
  - Even if practical exploitability depends on browser/CORS behavior, this is still a concrete policy gap in the new auth foundation. It also means future routes that pick `requireAuth()` instead of `requireUserAuth()` can silently opt out of the trust model.
- **Correction:**
  - Route `requireAuth()` through the same trust-check path used by `requireUserAuth()` for session principals, or introduce a shared helper that both functions call.
  - If `requireAuth()` is intentionally meant to allow bearer-session CLI requests but block unsafe cookie-session mutations, make that distinction explicit in code rather than implicit in call-site behavior.
  - Add tests that cover:
    - cross-origin cookie-session `POST` via `requireAuth()` -> blocked
    - bearer-session `POST` without `Origin` -> allowed
    - same-origin cookie-session `POST` -> allowed

### P2 (important improvements)

#### 1) Hooks still expose contradictory auth state for bearer/API-key callers, so auth normalization in `locals` is only partial
- **Evidence:**
  - `src/hooks.server.ts:92-101` sets `event.locals.session`, `event.locals.user`, and `event.locals.role` exclusively from `safeGetSession()`, which is cookie-session derived.
  - `src/lib/server/principal.ts:337-350` then treats any explicit `Authorization` header as authoritative and can resolve `event.locals.principal` to a bearer-session user or an API-key principal instead.
  - For bearer/API-key requests, that means `locals.principal` can be authenticated while `locals.session/user/role` remain `null` / `viewer` from the cookie path.
- **Impact:**
  - The new principal abstraction exists, but hooks still expose two auth truths. Any code that mixes legacy locals with principal-aware helpers can mis-handle authenticated bearer/API-key callers.
  - This undercuts the “wire it into hooks/locals” part of the intent and makes the current foundation easier to misuse.
- **Correction:**
  - Either synchronize legacy auth locals from the resolved principal where that is safe and semantically correct, or explicitly define `locals.principal` as the only normalized auth source for server APIs and stop presenting `locals.session/user/role` as general-purpose auth state.
  - Add hook-level tests that assert the resolved local state for:
    - cookie session requests
    - bearer-session requests
    - API-key requests
    - invalid `Authorization` header plus valid cookie session

#### 2) Test coverage improved meaningfully, but still does not exercise route-level or hook-level integration for the new foundation
- **Evidence:**
  - `src/lib/server/principal.test.ts` covers normalization, scope parsing, role/plan checks, and request-trust helpers.
  - `src/lib/server/auth.test.ts` covers the newly patched behaviors: fail-closed API-key role lookup, authoritative invalid `Authorization`, and admin mutation trust enforcement.
  - There are still no tests for `src/hooks.server.ts` locals wiring or for the migrated `src/routes/api/catalog-api/+server.ts` handler itself.
- **Impact:**
  - The risky part of this PR is integration, not the small pure helpers.
  - The current suite would not catch drift between `locals.*` and `locals.principal`, nor would it verify end-to-end denial/allow behavior for the catalog API path.
- **Correction:**
  - Add request-handler tests for `/api/catalog-api` that cover valid key, invalid key, strict role-lookup failure, and insufficient scope/plan.
  - Add hook/auth integration tests for bearer vs cookie precedence and for principal/local-state coherence.

### P3 (nice to have)

None.

## Assumptions Review

- Assumption: `requireAuth()` is safe to leave outside the new unsafe-method trust gate.
  - Validity: Invalid
  - Why: It is used on a `POST` endpoint today (`/api/ai/classify-roast`), so it is not purely a read-only helper. The foundation’s session trust policy should not depend on which helper a route author happened to pick.
  - Recommended action: Unify session-helper trust enforcement so all unsafe session-backed paths inherit the same rule.

- Assumption: Exposing both `locals.principal` and cookie-derived `locals.session/user/role` does not create meaningful ambiguity.
  - Validity: Weak
  - Why: Bearer/API-key requests can produce contradictory local state. That is manageable if tightly documented, but the current code does not enforce or document a single source of truth.
  - Recommended action: Align locals or document and enforce `locals.principal` as authoritative for API/server auth.

- Assumption: Helper-level tests are enough to validate this PR’s integration risk.
  - Validity: Weak
  - Why: The most brittle behavior here lives at the seams: hooks, header precedence, and real route handlers.
  - Recommended action: Add hook and request-handler tests before broader `/v1` cutover work builds on this layer.

## Tech Debt Notes

- Debt introduced:
  - Session auth helper behavior is still split across `requireAuth()` and `requireUserAuth()` instead of sharing one policy path.
  - Hooks now expose both a normalized principal and legacy cookie-derived auth locals without a hard contract about which is authoritative.
- Debt worsened:
  - The codebase now has a stronger auth foundation, but only some server entry points are actually benefiting from it. That raises the cost of future mistaken assumptions about coverage.
- Suggested follow-up tickets:
  - Unify unsafe-method trust enforcement across all session-auth helpers.
  - Add hook-level auth-state coherence tests.
  - Add request-handler tests for `/api/catalog-api`.
  - Decide whether legacy `locals.session/user/role` should remain cookie-only or be reconciled with principal resolution.

## Product Alignment Notes

- Alignment wins:
  - The rerun head fixed the three first-pass issues that mattered most: fail-open API-key resolution, incomplete legacy role normalization, and request-blind admin trust checks.
  - `/api/catalog-api` now uses the shared API-key principal path as intended.
  - `/v1` and `/v1/catalog` scaffolding accurately communicate that the cutover is not complete yet.
- Misalignments:
  - The foundation is still not fully consistent across auth helpers.
  - Hook/local wiring still stops short of a genuinely unified request-auth model.
- Suggested product checks:
  - Confirm whether any server APIs are expected to support bearer-session callers via legacy `locals.*` access patterns.
  - Decide whether the normalized principal should become the documented contract for all server auth going forward.

## Test Coverage Assessment

- Existing tests that validate changes:
  - `src/lib/server/principal.test.ts` validates role normalization, role priority, scope parsing, role/plan/scope authorization checks, and session-origin trust helpers.
  - `src/lib/server/auth.test.ts` validates strict API-key failure on role lookup failure, authoritative invalid `Authorization`, and admin mutation trust enforcement.
  - Targeted compile/test checks passed in the detached worktree:
    - `pnpm run sync`
    - `vitest run src/lib/server/principal.test.ts src/lib/server/auth.test.ts`
    - `svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` with stubbed static env vars for type generation
- Missing tests:
  - `requireAuth()` trusted-mutation behavior
  - `hooks.server.ts` principal/local-state wiring
  - `/api/catalog-api` handler integration behavior
  - contradictory `Authorization` vs cookie cases at hook/request-handler level
- Suggested test additions:
  - Add auth-helper tests for `requireAuth()` on unsafe cookie-session requests.
  - Add hook/local-state tests for cookie, bearer-session, API-key, and invalid-header-plus-cookie cases.
  - Add route tests for `/api/catalog-api` success and denial paths.

## Minimal Correction Plan

1. Make `requireAuth()` share the same unsafe-method/session-origin trust enforcement used by `requireUserAuth()` for session principals.
2. Add at least one request-level or hook-level test proving the trusted-mutation rule applies consistently across `requireAuth()` and `requireUserAuth()`.
3. Decide whether `locals.principal` is the new authoritative auth contract or whether legacy `locals.session/user/role` need to be reconciled with bearer/API-key resolution; document or implement that choice before the `/v1` cutover builds on this layer.

## Optional Patch Guidance

- `src/lib/server/auth.ts`
  - Collapse session-helper logic onto one shared path so `requireAuth()` cannot bypass the trust check that `requireUserAuth()` applies.
  - Add an explicit contract in code comments about which helpers are cookie-safe, bearer-safe, and API-key-safe.
- `src/routes/api/ai/classify-roast/+server.ts`
  - Re-evaluate whether this endpoint should continue using `requireAuth()` directly once the helper semantics are clarified.
- `src/hooks.server.ts`
  - Either reconcile legacy locals with the resolved principal or make their cookie-only semantics explicit and narrow their use.
- `src/routes/api/catalog-api/+server.ts`
  - Add route tests that assert plan/scope and failure behavior end to end.
- `src/lib/server/auth.test.ts`
  - Add coverage for `requireAuth()` on unsafe session-backed requests.
