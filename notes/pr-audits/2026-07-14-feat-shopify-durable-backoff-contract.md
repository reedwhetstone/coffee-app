# Pre-submission audit: durable Shopify backoff contract

**Date:** 2026-07-14
**Branch:** `feat/shopify-durable-backoff-contract`
**Base:** `origin/main`

## Claimed intent

Add a dormant, independently mergeable Supabase contract for durable Shopify
fleet backoff. The coffee scraper will call the service-role RPCs directly in a
later PR; coffee-app has no runtime role.

## Round 1

**Verdict:** `ready_with_fixes`
**Findings:** P0 0, P1 1, P2 2, P3 0
**Scope:** mergeable

The audit found that an overlapping older clean run could reset a newer 429,
the mutation response used stale eligibility semantics after lock contention,
and direct table reads duplicated the read RPC contract.

Corrections:

- Fenced clean resets with the strike generation captured at admission. A
  stale reset now reports `reset_applied = false` and preserves the newer 429.
- Anchored production transition time after row-lock acquisition and computed
  returned eligibility from fresh database time.
- Removed service-role table reads so state is available only through the
  database-time read RPC.
- Added deterministic and real-concurrency regression coverage for the reset
  race and post-lock timing.

## Validation

- `pnpm run verify:shopify-backoff-migration`: `VALIDATION_PASS`
- `pnpm run verify:shopify-backoff-concurrency`: `VALIDATION_PASS`
- `pnpm check --fail-on-warnings`: `VALIDATION_PASS`
- `pnpm lint --max-warnings 0`: `VALIDATION_PASS`
- `pnpm test`: `VALIDATION_PASS` (914 passed, 11 skipped)
- `git diff --check`: `VALIDATION_PASS`

## Final gate

Pending focused re-review of the corrected contract.
