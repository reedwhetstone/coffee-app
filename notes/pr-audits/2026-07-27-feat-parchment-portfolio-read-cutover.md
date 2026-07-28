# Pre-submission audit: Parchment Portfolio read cutover

Date: 2026-07-27
Branch: `feat/parchment-next-consumer-cutover`
Base: `origin/main`

## Claimed intent

Move authenticated `/api/beans` Portfolio reads from direct Supabase inventory,
catalog, and roast joins to owner-scoped Parchment SDK contracts while retaining
the existing response projection. Keep shared-token reads on their existing
app-local path.

## Scope assessment

The slice is independently mergeable and uses deployed SDK 0.18.0 contracts.
It does not depend on the closed manual-inventory PR #507, its upstream
replacement Parchment PR #133, the future roast/profit parity contracts, or the
Market Index backfill.

Shared-token reads deliberately remain unchanged because they read another
principal's explicitly shared rows and do not fit the caller-owned Parchment
inventory contract.

## Adversarial review

Final findings: P0/P1/P2/P3 = 0/0/0/0.

Review covered:

- owner scoping through the forwarded browser session
- Parchment Intelligence readers receiving inventory without Mallard roast data
- Mallard members retaining the legacy nested roast projection
- complete offset pagination for inventory and roast resources
- exact-ID requests filtering both inventory and upstream roast reads
- catalog hydration for full legacy card fields and owner-private rows
- JSON serialization and rounding parity for tasting and roast fields
- invalid shared tokens, cross-owner share reads, and shared role gating staying
  on the unchanged Supabase path
- Parchment failures retaining the route's established closed response
- no authenticated fallback to a direct Supabase inventory query

One review improvement was applied before the final verdict: exact-ID reads now
send `coffee_id` to the roast endpoint, avoiding an unnecessary full owner-roast
scan. Coverage also rejects unrelated roast rows.

The runtime forbade spawning a review sub-agent in this turn, so the adversarial
pass was performed inline against the committed diff, generated SDK types, and
the deployed Parchment route implementation.

## Backlog reconciliation

The canonical backlog now records merged coffee-app cutovers #500, #501, #503,
#504, #505, #506, and #508. It also corrects #507 from "open and green" to
closed/superseded by upstream-first Parchment PR #133.

The legacy coffee-chunks retirement was evaluated but not selected: repository
evidence shows no supported caller, while production route telemetry was not
available. Its deletion gate therefore remains unsatisfied.

## Validation

- focused Portfolio tests: 10 passed
- full Vitest suite: 972 passed, 11 skipped, 0 failed
- `pnpm check`: 0 errors, 0 warnings
- targeted Prettier and ESLint: passed
- `git diff --check`: passed
- `pnpm build`: passed

The host used Node 24.18.0 while the repository declares Node 22. The validation
suite still passed.

## Verdict

VERDICT: ready
P0/P1/P2/P3: 0/0/0/0
NEXT_ACTION: merge
CONFIDENCE: medium
SCOPE_ASSESSMENT: correct_boundary
VALIDATION_STATUS: VALIDATION_PASS
