# Pre-submission audit: Parchment principal boundary

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

## Intent

Retain Supabase Auth as coffee-app's browser identity and session provider while
making Parchment `GET /v1/me` the canonical authority for request principals,
application roles, API plans, PPI access, API scopes, and API-key validation.
Authorization headers take precedence over cookie sessions, and Parchment
resolution failures fail closed.

## Findings

The initial adversarial review found two P1 authority leaks:

- the legacy `safeGetSession()` compatibility helper could recover a cookie
  identity after an Authorization header selected a different principal
- the milestone backfill endpoint still authorized the current principal from
  a direct local `user_roles` read

Both were corrected. Raw Supabase cookie bootstrap is now private to canonical
principal resolution, while `safeGetSession()` exposes identity only for the
matching canonical cookie-session principal. The backfill endpoint now uses the
Parchment-backed member guard and its mutation-origin enforcement.

The second review found one P2 fail-closed defect: a canonical null API plan
could be inferred as enterprise from an admin role. Both session and API-key
principals now default a missing plan to viewer, with regression coverage.

The final fresh-context review found no legitimate P0-P3 findings. The slice is
independently mergeable. The remaining direct shared-link owner role lookup is
an intentional cross-principal boundary, while billing reconciliation and other
embedded control-plane reads require whole-operation cutovers rather than
partial authorization substitutions.

## Validation

- `pnpm test`: 1,090 passed, 11 skipped
- standalone env-backed `pnpm check`: 0 errors, 0 warnings
- affected-file Prettier and ESLint: passed
- env-backed production build: passed
- logged-out preview smoke: `/catalog` 200, `/dashboard` 303 to `/auth`,
  `/beans` 303 to `/catalog`, `/auth` 200
- `git diff --check origin/main...HEAD`: passed

Repo-wide `pnpm lint` remains baseline-blocked by 18 unrelated pre-existing
Markdown formatting files. Every file changed by this branch passes Prettier
and ESLint directly.

This diff exceeds the usual size target because it removes the duplicate API-key
validator, replaces the central request-principal implementation and its test
matrix, and closes the downstream compatibility leaks as one security boundary.
Splitting those pieces would leave an intermediate branch with two competing
authorization authorities.
