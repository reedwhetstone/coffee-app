# Pre-submission audit: Parchment tracked-lots consumer cutover

## Intent

Retire coffee-app's direct `tracked_lots` Supabase reads and writes in favor of
the released Parchment SDK 0.13.0 portfolio contract.

## Initial gate

`VERDICT: blocked`

- P0: 0
- P1: 2
- P2: 0
- P3: 0
- Scope assessment: mergeable

The initial review found:

1. Concurrent same-lot browser requests could reorder explicit desired states
   or let a stale failure roll back a newer optimistic state.
2. A failed critical tracked-only portfolio read could throw the entire catalog
   SSR load instead of preserving unknown/degraded state.

The review also identified an external rollout precondition: production
portfolio writes are fail-closed behind `PORTFOLIO_WRITES_ENABLED=true`, and
contract deployment alone does not prove activation.

## Corrections

- Added a shared per-lot mutation controller with one in-flight request per
  catalog id, latest-intent coalescing, generation-aware reconciliation, and
  independent concurrency across separate lots.
- Preserved tracked-only read failures as explicit unknown state, skipped the
  catalog query, disabled tracked controls, and rendered an unavailable state
  instead of a false empty watchlist.
- Added deterministic rapid-toggle, stale-failure, separate-lot concurrency,
  loader-degradation, and rendered-shell tests.

## Focused re-review

`VERDICT: blocked`

- P0: 0
- P1: 0
- P2: 0
- P3: 0
- Scope assessment: mergeable
- Confidence: high

The code gate is clean. Submission remains blocked on external production
rollout evidence:

1. operator-visible proof that `PORTFOLIO_WRITES_ENABLED=true` in production;
2. authenticated member/PPI PUT and DELETE canaries that preserve and restore a
   designated lot's prior tracked state.

## Validation

- Focused adapter, BFF, loader, page, and browser-state tests
- Full test suite: 966 passed, 11 skipped
- `pnpm check --fail-on-warnings`
- Targeted Prettier and ESLint for every affected file
- Production-shaped build
- Direct `tracked_lots` boundary proof
- `git diff --check`

All change-scoped validation passed. The repository-wide `pnpm lint` wrapper
still stops on 18 pre-existing, unchanged notes-formatting failures.
