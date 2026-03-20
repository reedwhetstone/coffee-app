# PR Audit: feat/wholesale-markers-inventory (PR #121)

**Date:** 2026-03-19
**Reviewer:** claude-opus-4-6 (independent subagent)
**Verdict:** SHIP IT ✅

## Summary

P0: 0 | P1: 0 | P2: 0 | P3: 2 (both pre-existing patterns, not regressions)

## Intent Validation: PASS

PR adds wholesale badge to bean cards on `/beans`. Satisfies all acceptance criteria:

- `wholesale` added to `CoffeeCatalog` TS interface
- `wholesale` added to `buildGreenCoffeeQuery` Supabase select
- Blue pill badge (`bg-blue-100 text-blue-800`) in desktop badge row
- Strict equality check handles `null`/`false` correctly

## Findings

### P3 — Wholesale badge is desktop-only

`class="hidden gap-1 sm:flex"` means badges are invisible below `sm` (640px). This matches the existing `hasUserRating` and `hasUserCupping` pattern exactly — not a regression. Future mobile badge work should address all three badge types together.

### P3 — `pr-16 sm:pr-0` title padding includes `isWholesale`

Consistent with how `hasUserRating` and `hasUserCupping` handle this. Negligible extra padding on mobile for wholesale-only beans.

## Areas With No Issues

- Type safety: strict `=== true`, `boolean | null` matches DB schema
- Query correctness: correct FK join path
- UI consistency: matches existing badge pattern
- Performance: one boolean added to existing query, negligible
- Security: `wholesale` already exposed via catalog API, no new surface
- Accessibility: WCAG AA contrast passes, screen-reader readable
- Edge cases: null catalog_id handled by optional chain

## Pre-Existing Tech Debt (Not Introduced)

- Mobile badge visibility gap — all badge types are desktop-only
- Beans page uses hand-rolled cards instead of `CoffeeCard.svelte`, which already has wholesale badge support. Unifying could be future work.
