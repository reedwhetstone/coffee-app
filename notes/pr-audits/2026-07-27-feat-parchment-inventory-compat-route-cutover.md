# Pre-submission audit: Parchment inventory compatibility route

Date: 2026-07-27
Branch: `feat/parchment-inventory-compat-route-cutover`
Base: `origin/main`

## Claimed intent

Move the deprecated `/api/tools/green-coffee-inv` compatibility route off direct
Supabase reads and onto the authenticated Parchment SDK while preserving its
legacy response envelope.

## Scope assessment

The boundary is independently mergeable. The route already requires a member
session, and the deployed Parchment contracts cover inventory, catalog
hydration, and roast reads. The change does not depend on PR #507, does not add
inventory mutations, and does not route structured tasting data through the
generic inventory contract.

## Adversarial review

No P0, P1, P2, or P3 findings survived review.

Reviewed failure surfaces:

- authentication remains member-only and the SDK uses the caller's session
- inventory ownership remains enforced by the Parchment principal
- stocked filtering and the legacy 15-row limit remain intact
- catalog hydration uses explicit IDs and retains the compact inventory catalog
  object if a full catalog row is unavailable
- the no-catalog-details projection still emits `coffee_name`
- roast summaries include the legacy `total_oz_in` and `total_oz_out` fields
- summary totals and the response envelope remain unchanged
- transport and API errors still fail the request instead of returning partial
  data

The repository runtime forbade spawning a review sub-agent in this turn, so the
adversarial pass was performed inline against the committed diff and both the
old Supabase implementation and generated SDK contracts.

## Validation

- `pnpm vitest run src/routes/api/tools/green-coffee-inv/route.test.ts src/lib/services/tools/shared.test.ts src/lib/services/tools.test.ts`
  passed: 15 tests
- `pnpm check` passed: 0 errors, 0 warnings
- targeted Prettier and ESLint passed
- `git diff --check` passed
- `pnpm test` passed: 968 tests, 11 skipped
- `pnpm build` passed

The host used Node 24.18.0 while the repository declares Node 22. The complete
validation suite still passed.

## Verdict

VERDICT: ready
P0/P1/P2/P3: 0/0/0/0
NEXT_ACTION: merge
CONFIDENCE: medium
SCOPE_ASSESSMENT: correct_boundary
VALIDATION_STATUS: VALIDATION_PASS
