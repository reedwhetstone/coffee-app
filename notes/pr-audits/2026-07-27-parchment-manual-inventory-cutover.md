# Pre-submission audit: Parchment manual inventory cutover

**Date:** 2026-07-27

**Branch:** `feat/parchment-manual-inventory-cutover`

**Base:** `origin/main`
**Final verdict:** `ready`

## Intent

Preserve the existing coffee-app manual inventory workflow while moving creation
of the owner-private catalog row and linked inventory lot to Parchment's atomic,
idempotent inventory create contract. Keep catalog-backed creation unchanged,
preserve the existing joined response projection, and make browser retries safe.

## Gate result

- P0: 0
- P1: 0
- P2: 0
- P3: 0
- Scope assessment: mergeable
- Next action: submit the PR

The initial gate found one P1: the authenticated API-contract and critical-path
E2E fixtures did not send the newly required `Idempotency-Key`. Commit
`ac5578ab` added stable per-logical-request keys to both fixtures. The focused
re-review confirmed the finding was resolved and found no remaining blockers.

## Validation

- `pnpm test`: 973 passed, 11 intentionally skipped
- `pnpm exec vitest run src/routes/api/beans/route.test.ts src/routes/beans/BeanForm.svelte.test.ts`: 14 passed
- Prettier and ESLint on changed source and E2E files: passed
- `pnpm exec playwright test tests/e2e/api-contracts.spec.ts tests/e2e/critical-path.spec.ts --list`: passed
- `pnpm check` with the primary checkout's repo-local environment exported: 0 errors and 0 warnings
- `pnpm build` with the primary checkout's repo-local environment exported: passed
- `git diff origin/main...HEAD --check`: passed

## Architecture alignment

The change follows the API-first direction in `notes/PRODUCT_VISION.md` and the
owner-write/idempotency model in Parchment PADR-0016. Parchment owns the atomic
multi-table mutation and replay contract; coffee-app remains the human surface
and adapts the canonical response back to its established component projection.
