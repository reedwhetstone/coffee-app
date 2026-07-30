# Pre-submission red-team audit: principal-only server auth

Date: 2026-07-30

## Contract

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:
- None; no legitimate pre-submission fixes identified.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
VALIDATION_STATUS:
- `git diff --check origin/main..HEAD`: VALIDATION_PASS
- `pnpm env:check`: VALIDATION_PASS
- `pnpm exec vitest run src/hooks.server.test.ts src/lib/server/principal.test.ts src/lib/server/parchmentClient.test.ts src/lib/server/pageAuth.test.ts src/lib/server/catalogAccess.test.ts src/lib/server/catalogVisibility.test.ts src/lib/server/auth.test.ts src/lib/server/billing/reconcile-session.test.ts`: VALIDATION_PASS (73 tests)
- `pnpm test -- --run src/hooks.server.test.ts src/lib/server/principal.test.ts src/lib/server/parchmentClient.test.ts src/lib/server/pageAuth.test.ts src/lib/server/catalogAccess.test.ts src/lib/server/catalogVisibility.test.ts`: VALIDATION_PASS (full repository suite: 1087 passed, 11 skipped)
- `pnpm exec prettier --check` on all changed files: VALIDATION_PASS
- `pnpm exec eslint` on all changed TypeScript/Svelte files: VALIDATION_PASS
- env-backed `pnpm check`: VALIDATION_PASS (0 errors, 0 warnings)
- env-backed `pnpm build`: VALIDATION_PASS
- `pnpm verify:migration-authority`: VALIDATION_PASS
- logged-out preview smoke: VALIDATION_PASS (`/catalog` 200, `/dashboard` 303
  to `/auth`, `/beans` 303 to `/catalog`, `/auth` 200)
- `pnpm lint`: VALIDATION_FAIL — repository-wide Prettier check reports 18 pre-existing unrelated files outside this diff; all changed files pass targeted formatting and ESLint checks.

## Review scope and method

Reviewed the committed `f6c1498b` branch against `origin/main`, using the generated
context artifacts in `.verify-pr/20260730T171834Z-refactor-principal-only-server-auth`,
the complete 72-file diff, adjacent callers, `notes/PRODUCT_VISION.md`, accepted
ADRs 005, 007, and 008, and the connected authentication, BFF, page-data, catalog,
billing, Stripe, CLI-consent, roast, profit, and dashboard paths.

The implementation actually does the claimed refactor:

- `src/hooks.server.ts:43-76` keeps `safeGetIdentity()` as the Supabase identity
  hydration cache, resolves one Parchment-backed principal, and no longer projects
  legacy auth locals.
- `src/lib/server/principal.ts:261-329` preserves header-over-cookie precedence,
  checks bearer-session identity against the canonical user ID, and resolves
  cookie sessions through the same Parchment principal contract.
- `src/lib/server/parchmentClient.ts:151-185` forwards the exact authorized header
  credential for header-authenticated requests and only forwards a cookie token for
  a cookie-session principal, preventing mixed-credential confusion.
- `src/hooks.server.ts:100-136`, `src/lib/server/pageAuth.ts:5-22`, and the changed
  route handlers consistently distinguish a browser cookie session from bearer/API-key
  principals where page or mutation semantics require it.
- `src/app.d.ts:13-20` and `src/types/global.d.ts:10-18` require the canonical
  principal while retaining `safeGetIdentity`; `src/app.d.ts:21-46` retains the
  existing browser `PageData` shape.

## Findings

No confirmed P0, P1, P2, or P3 defects were found.

Specifically, the audit found no authorization bypass, cookie/header principal mix-up,
API-key fallback to a cookie or demo credential, loss of page-session behavior, missing
implementation caller, or browser PageData contract change. The focused auth and
credential tests were updated to exercise those boundaries, and the full Vitest run
passed (1087 tests passed, 11 skipped).

## Boundary assessment

The slice is independently coherent and does not depend on the separately described
browser PageData follow-up: the server locals contract is narrowed, while the layout
loader continues to emit the existing session/user/role/ppiAccess PageData projection.
No accepted ADR drift was identified. The refactor reinforces ADR-007's canonical
Parchment principal and BFF forwarding boundary and ADR-008's cookie/header-aware
cache/auth distinction.
