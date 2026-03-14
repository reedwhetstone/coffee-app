# PR Verification Report

## Metadata

- Repo: reedwhetstone/coffee-app
- Base: origin/main (352533d)
- Head: origin/refactor/data-layer-roast (50be8f8)
- PR #98
- Reviewer model: anthropic/claude-opus-4-6
- Confidence: High
- Scope note: Phase 0.0 PR 2/6 — extract roast data layer from route handlers

## Executive Verdict

- Merge readiness: **Ready with fixes**
- Intent coverage: Full
- Priority summary: P0: 0, P1: 2, P2: 3, P3: 2

## Intent Verification

- **Stated intent:** Extract all roast_profiles Supabase queries into `src/lib/data/roast.ts`. Consolidate 3-way clear-roast duplication. No behavior changes. Re-export shim for artisan-import compat.
- **What was implemented:** New 775-line data layer module with `listRoasts`, `createRoasts`, `updateRoast`, `deleteRoast`, `deleteBatch`, `clearRoastData`, `saveRoastData`, and supporting functions. All three route handlers (`roast-profiles`, `clear-roast`, `beans`) refactored to use it. `roastDataUtils.ts` reduced to re-export shim. Bonus: E2E test slider fix.
- **Coverage gaps:** None. All stated goals are met.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

- **P1-1: `deleteRoast()` double-queries for ownership (route handler + data layer)**

  - **Evidence:** In `roast-profiles/+server.ts` DELETE handler (lines 73-84), the route already queries `.select('user, coffee_id').eq('roast_id', parsedId).single()` and checks ownership, then calls `deleteRoast(supabase, parsedId, user.id)` which internally calls `verifyRoastOwnership()` — another `.select('*').eq('roast_id', roastId).single()`. That's 2 round-trips to Supabase for the same verification.
  - **Impact:** Performance: each single-roast DELETE does 2 ownership queries instead of 1. Same issue exists in `updateRoast()` (route handler queries for coffee_id, then `updateRoast` calls `verifyRoastOwnership` again). Not a correctness bug but is avoidable overhead and violates DRY.
  - **Correction:** Either (a) have the data layer functions accept a pre-verified flag / the existing profile row, or (b) have the route handlers not pre-verify and instead call the data layer function which does it. The route handler needs coffee_id for `updateStockedStatus`, so option (b) means the data layer should return the coffee_id. `deleteRoast` could return `{ coffee_id }` and `updateRoast` already returns the profile. Simplest fix: remove the route-level ownership check for PUT, use `updated.coffee_id` from the returned profile. For DELETE, have `deleteRoast` return `coffee_id`.

- **P1-2: `verifyRoastOwnership()` selects `*` instead of minimal columns**
  - **Evidence:** `roast.ts` line ~198: `.select('*').eq('roast_id', roastId).single()`. This function is called from `updateRoast()` and `deleteRoast()`, both of which only need to verify the `user` column matches. Fetching the full row (with potentially large jsonb columns like `roast_targets`) is wasteful.
  - **Impact:** Over-fetching on every update and delete operation.
  - **Correction:** Change to `.select('roast_id, user')` (or whatever minimal columns are needed). The return type can remain `RoastProfile` for the interface, or narrow it.

### P2 (important improvements)

- **P2-1: `createRoasts()` single path adds `weight_loss_percent`; old code did not**

  - **Evidence:** In the old `roast-profiles/+server.ts`, the single-profile POST path did NOT compute `weight_loss_percent` (only the batch path did via `calculateWeightLoss`). The new `createRoasts()` computes it for both paths (line ~274 in `roast.ts`: `weight_loss_percent: calculateWeightLoss(...)`). This is technically a behavior change, but it's a bug fix (the old code should have computed it).
  - **Impact:** Positive behavior change; single-profile creation now correctly populates `weight_loss_percent`. Not a regression. Calling this out for documentation purposes since the PR states "no behavior changes."
  - **Correction:** Mention in PR description as an intentional improvement.

- **P2-2: `oz_in` / `oz_out` falsy coercion difference**

  - **Evidence:** Old single-profile path: `oz_in: profileData.oz_in || null`. New data layer: `oz_in: profileData.oz_in ?? null`. The `||` operator treats `0` as falsy and converts it to `null`. The `??` operator preserves `0`. Since `0` oz is not a meaningful roast weight, this is unlikely to cause real issues, but it is a behavior difference.
  - **Impact:** Low. An oz_in of `0` would now be stored as `0` instead of `null`. This actually seems more correct.
  - **Correction:** Document as intentional. No fix needed.

- **P2-3: Cascade delete in `beans/+server.ts` now uses `deleteRoast()` per-profile instead of batch `.in()` queries**
  - **Evidence:** Old code: `await supabase.from('roast_temperatures').delete().in('roast_id', roastIds)` (single batch delete). New code: loops `for (const profile of roastProfiles) { await deleteRoast(...) }`. Each `deleteRoast` call does 3 deletes (temps, events, profile) + 1 ownership check.
  - **Impact:** For a bean with N roast profiles, old code did 3 DB calls total. New code does 4\*N calls. For small N this is fine; for large N it's noticeably slower. Correctness is preserved.
  - **Correction:** Consider adding a `deleteRoasts(supabase, roastIds, userId)` batch function to the data layer for this use case. Not blocking.

### P3 (nice to have)

- **P3-1: `clearRoastData` full-clear path doesn't check error results**

  - **Evidence:** In `roast.ts`, the full-clear branch (no source) does `await supabase.from('artisan_import_log').delete()...select('import_id')` but never checks the `error` property of the result. The old route handler returned 500 on each step's error. The new data layer silently ignores delete errors.
  - **Impact:** Very low. These deletes will almost never fail, and if they do, the overall try/catch in the route handler will still catch thrown errors. But partial failures could leave orphaned data.
  - **Correction:** Either check errors or document that partial failures are acceptable.

- **P3-2: `any` cast on profile reset update**
  - **Evidence:** `roast.ts` line ~436: `await (supabase.from('roast_profiles') as any).update(...)`. This was inherited from the old code. The `as any` is needed because the update includes columns the TypeScript types don't expose.
  - **Impact:** Purely cosmetic / type safety. Inherited tech debt.
  - **Correction:** Leave as-is (already has eslint-disable comment). Consider fixing the DB types in a future PR.

## Assumptions Review

- **Assumption:** `roastDataUtils.ts` is only imported by `artisan-import/+server.ts`

  - Validity: **Valid** — confirmed via `git grep`. Only one consumer.
  - Recommended action: None.

- **Assumption:** The clear-roast DELETE endpoint's ownership check (still inline) provides the same security as before

  - Validity: **Valid** — the route handler still queries the profile and checks `user === userId` before calling `clearRoastData()`. The data layer function itself is auth-free by design.
  - Recommended action: None.

- **Assumption:** `deleteRoast()` not cleaning up `artisan_import_log` is acceptable

  - Validity: **Valid** — the old DELETE handler also didn't clean it up. Only the full clear-roast path does.
  - Recommended action: Consider adding `artisan_import_log` cleanup to `deleteRoast` in a future PR if orphaned records are a concern.

- **Assumption:** `computeMilestoneUpdate()` and `extractMilestoneProfileData()` compute the same values
  - Validity: **Weak** — They use slightly different rounding. `computeMilestoneUpdate` rounds to 1 decimal via `Math.round(x * 1000) / 10`. `extractMilestoneProfileData` multiplies by 100 without rounding. However, `computeMilestoneUpdate` is only called from the live-update path in `updateRoast()`, while `extractMilestoneProfileData` is called from `saveRoastData()` (artisan import path). They serve different callers and the old code had this same split, so this is not a regression.
  - Recommended action: Unify rounding logic in a future PR.

## Tech Debt Notes

- **Debt introduced:** Minimal. The double-query pattern (P1-1) is new debt, but the overall deduplication massively reduces total codebase debt.
- **Debt worsened:** None.
- **Debt reduced:** ~700 lines of duplicated Supabase query logic removed from route handlers. `roastDataUtils.ts` went from 212 lines of duplicated functions to 15 lines of re-exports. Three separate clear-roast implementations consolidated to one parameterized function.
- **Suggested follow-up tickets:**
  1. Eliminate double ownership queries (P1-1) by having data layer functions return needed metadata
  2. Narrow `verifyRoastOwnership` select to minimal columns (P1-2)
  3. Add batch `deleteRoasts()` for bean cascade delete (P2-3)
  4. Unify milestone rounding between `computeMilestoneUpdate` and `extractMilestoneProfileData`

## Product Alignment Notes

- **Alignment wins:** No user-facing changes. API response shapes preserved. Clear separation of concerns makes future feature work easier.
- **Misalignments:** None.
- **Suggested product checks:** None needed; this is a pure refactor.

## Test Coverage Assessment

- **Existing tests that validate changes:** `tests/e2e/crud.spec.ts` exercises CRUD flows end-to-end including roast creation, update, and deletion. The slider fix (5 -> max scale) is a legitimate test correction.
- **Missing tests:** No unit tests for the new data layer functions. The data layer is tested indirectly through E2E tests via the API endpoints.
- **Suggested test additions:** Unit tests for `calculateWeightLoss`, `computeMilestoneUpdate`, `clearRoastData` (with/without source parameter), `createRoasts` (batch vs single), `resolveCatalogName`. These would catch regressions without requiring a Supabase connection if mocked.

## Checklist Summary

| Section                       | Verdict                                  |
| ----------------------------- | ---------------------------------------- |
| Intent Coverage               | PASS                                     |
| Correctness                   | PASS (minor behavior improvements noted) |
| Codebase Alignment            | PASS                                     |
| Risk and Regressions          | PASS (no regressions found)              |
| Security and Data Safety      | PASS (auth boundaries preserved)         |
| Test and Verification Quality | CONCERN (no unit tests for new module)   |
| Tech Debt and Maintainability | PASS (net positive)                      |
| Product and UX Alignment      | PASS (N/A for refactor)                  |

## Minimal Correction Plan

1. **P1-1:** Remove the redundant ownership query in the route handler's DELETE and PUT paths. For DELETE: have `deleteRoast()` return `{ coffee_id }`. For PUT: use `updated.coffee_id` from the returned profile instead of pre-querying.
2. **P1-2:** Change `verifyRoastOwnership()` to `.select('roast_id, user')` instead of `.select('*')`.

## Optional Patch Guidance

### P1-1 fix (DELETE path in roast-profiles/+server.ts)

In `deleteRoast()` in `roast.ts`: change return type to `Promise<{ coffee_id: number }>`, return the profile's coffee_id from the already-fetched ownership check.

In `roast-profiles/+server.ts` DELETE handler: remove the pre-query for `user, coffee_id`, call `deleteRoast()` directly, use returned `coffee_id` for stocked status update.

### P1-2 fix (verifyRoastOwnership in roast.ts)

```typescript
// Change:
.select('*')
// To:
.select('roast_id, user')
```

Narrow the return type accordingly or keep returning `RoastProfile` with a comment that only partial columns are populated.
