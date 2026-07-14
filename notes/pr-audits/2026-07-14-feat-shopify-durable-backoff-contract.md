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

- Fenced clean resets with a monotonic rate-limit generation captured at admission. A
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

**Verdict:** `ready`
**Findings:** P0 0, P1 0, P2 0, P3 0
**Scope:** mergeable

The final fresh-context review confirmed that the monotonic generation blocks
the ABA reset sequence and found no remaining legitimate P0-P2 defects.

## Round 2

**Verdict:** `ready_with_fixes`
**Findings:** P0 0, P1 1, P2 0, P3 0

The focused re-review found that the resettable strike count was ABA-prone. The
fence now uses a separate monotonic `rate_limit_generation` that increments on
every 429 and is never cleared by a clean reset. Regression coverage exercises
the `1 → 2 → reset → 1` strike-count sequence and proves that the oldest clean
run's captured generation cannot erase the latest cooldown.
