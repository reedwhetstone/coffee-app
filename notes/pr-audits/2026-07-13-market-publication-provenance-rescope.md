# PR #464 pre-submission red-team: provenance rescope

**Date:** 2026-07-13
**Branch:** `feat/market-publication-provenance`
**Base:** `origin/main`
**Final verdict:** Ready

## Intent

Rescope the market-publication foundation to additive, non-activating provenance and cohort infrastructure. The slice stores production-scoped scrape runs, fenced supplier observation sets, true-time price observations, and frozen versioned cohorts. It contains no publication, aggregate, builder, reader, promotion, or activation contract.

## Gate history

The first adversarial pass found three P1 defects and one P2: reversible cohort freezing, stale lease-fence reuse and direct lease mutation, mutable scrape-run provenance, and empty complete legacy/unknown sets. The first patch corrected those invariants.

The focused re-review found one P1 permission regression and one P2 lock-order risk. The final patch replaced direct completion with `seal_supplier_observation_set`, a fixed-search-path `SECURITY DEFINER` RPC that locks scrape run, supplier lease, then observation set. The service role can insert open sets and observations but cannot mutate leases or complete sets directly.

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: correct_boundary_and_independently_mergeable
```

## Validation

- `pnpm run verify:market-publication-migration`: pass
- Fresh ephemeral PostgreSQL migration and behavior suite: pass
- `pnpm run verify:market-provenance-concurrency`: pass
- `pnpm run check` with repository environment exports: pass, 0 errors and 0 warnings
- `pnpm test -- --runInBand`: pass, 881 tests passed and 11 skipped
- `git diff origin/main...HEAD --check`: pass

## Deferred program work

This slice intentionally does not publish snapshots. The next slices recover the scraper writer onto current `main`, replace the stacked builder with one database-owned build-and-activate transaction, validate continuous shadow evidence, and only then expose a reader/API contract.
