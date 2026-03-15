# PR Verification Report

## Metadata

- **Repo:** reedwhetstone/coffee-app
- **Base:** origin/main
- **Head:** origin/refactor/data-layer-inventory
- **PR #:** 99
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High
- **Scope note:** Single commit; 6 files changed (+577 / -372). New `src/lib/data/inventory.ts` (518 lines), route handler simplification across 3 endpoints, shim for backwards compat, minor e2e test fix.

## Executive Verdict

- **Merge readiness:** Ready with fixes
- **Intent coverage:** Full
- **Priority summary:** P0: 0, P1: 2, P2: 2, P3: 2

## Intent Verification

- **Stated intent:** Extract all `green_coffee_inv` Supabase queries from scattered route handlers into `src/lib/data/inventory.ts`. Phase 0.0 PR 3/6 of data layer refactor.
- **What was implemented:** New data layer module created. CRUD operations (list, get, add, update, delete) and `updateStockedStatus` consolidated. GenUI tool endpoint (`/api/tools/green-coffee-inv`) refactored to use `getInventoryWithRoastSummary`. `stockedStatusUtils.ts` converted to re-export shim. Route handlers simplified to delegate to data layer.
- **Coverage gaps:** GET `/api/beans` still directly uses `buildGreenCoffeeQuery`/`processGreenCoffeeData` instead of the new `listInventory()`, meaning the "all green_coffee_inv CRUD goes through inventory.ts" goal is not fully achieved for reads. This is an intentional gap (share-token path complicates extraction), but worth noting.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

**P1-1: `updateStockedStatus` return shape changed**

- **Evidence:** Original `stockedStatusUtils.ts` returns `{ success, coffee_id, remaining_oz, stocked }` on success and `{ success, error }` on failure. The new version in `inventory.ts` returns `{ success, stocked, coffee_id?, remaining_oz?, error? }` — note `stocked` is now always present (even on error paths where it's `false`).
- **Impact:** The `/api/update-stocked-status` POST handler checks `result.success` then returns `json(result)` — so the response shape to the client changes. On error, the old response was `{ success: false, error: "..." }`, the new response is `{ success: false, stocked: false, error: "..." }`. On success, property order changes: old was `{ success, coffee_id, remaining_oz, stocked }`, new is `{ success, stocked, coffee_id, remaining_oz }`. The extra `stocked: false` on error paths is a minor shape change, unlikely to cause issues in practice (clients check `success` first), but violates the "identical response shapes" goal.
- **Correction:** Either match the exact return shape of the original (omit `stocked` from error returns), or verify all consumers tolerate the extra field. Low risk but technically a behavior change.

**P1-2: PUT handler returns stale data when `purchased_qty_lbs` changes**

- **Evidence:** In the PUT handler (`/api/beans`), `updateInventory()` is called first, which fetches and returns the row with full joins. _Then_ `updateStockedStatus()` runs (if `purchased_qty_lbs` changed and `stocked` wasn't manually set), which may flip the `stocked` flag. But the response (`return json(updated)`) returns the data from _before_ the stocked status update.
- **Impact:** This is actually the _same_ behavior as on `main` — the original code also called `updateStockedStatus` after the update and then fetched the row. Wait, on main the fetch happens _after_ the stocked status update. Let me re-check... On main: (1) update row, (2) auto-update stocked status, (3) fetch with joins, (4) return. On this branch: (1) `updateInventory()` does update + fetch internally, (2) auto-update stocked status, (3) return data from step 1. **This IS a regression.** The returned data may have a stale `stocked` value when `purchased_qty_lbs` was updated.
- **Correction:** Either re-fetch after the stocked status update, or move the auto-stocked-status logic inside `updateInventory()`, or at minimum re-query after the stocked update runs. The simplest fix: after `updateStockedStatus` succeeds, re-fetch the item via `getInventoryItem()` and return that instead.

### P2 (important improvements)

**P2-1: GET `/api/beans` not migrated to data layer**

- **Evidence:** `src/routes/api/beans/+server.ts` line 5 still imports `buildGreenCoffeeQuery` and `processGreenCoffeeData` directly for the GET handler. The `listInventory()` function in the data layer does exactly the same thing but the GET handler's share-token path and lack of `userId` filter in that branch makes extraction less clean.
- **Impact:** Partial migration; the stated goal was "all green_coffee_inv CRUD goes through `src/lib/data/inventory.ts`". GET is the primary read path. Two consumers of the same query builder live in different modules.
- **Correction:** Consider adding a `listInventoryForShareToken(supabase, shareData)` variant in the data layer, or a `listInventoryRaw()` that accepts arbitrary filters. Can be deferred to a follow-up PR within the Phase 0.0 series.

**P2-2: `roast-profiles` and `chat/execute-action` still import from old shim path**

- **Evidence:** `src/routes/api/roast-profiles/+server.ts` (5 call sites) and `src/routes/api/chat/execute-action/+server.ts` (2 call sites) still import `updateStockedStatus` from `'$lib/server/stockedStatusUtils'`. The shim works, but the stated goal is migration _to_ `$lib/data/inventory.js`.
- **Impact:** Functional — the shim re-exports correctly. But it's incomplete migration that leaves the shim as a permanent dependency rather than a transitional artifact.
- **Correction:** Migrate these imports in this PR or a follow-up. The shim is correctly marked `@deprecated`, so this is tracked.

### P3 (nice to have)

**P3-1: `addToInventory` doesn't validate column allowlist like the original**

- **Evidence:** The original POST handler had a `validInventoryColumns` allowlist that filtered unknown fields before insert. The new `addToInventory()` explicitly maps each field from `InventoryCreateInput`, which is type-safe. The route handler now passes explicit fields too. So the allowlist is effectively replaced by the typed interface.
- **Impact:** None in practice — the TypeScript types enforce the same constraint at compile time. Slightly different behavior: the old code would silently drop fields like `bean.rank` if `bean[field] !== undefined` was false; the new code passes `bean.rank` through (which could be `undefined`, and `undefined` values in the object literal are stripped by JSON serialization / Supabase SDK anyway).
- **Correction:** No fix needed. The typed interface is cleaner.

**P3-2: E2E test slider value change is unrelated to the data layer extraction**

- **Evidence:** `tests/e2e/crud.spec.ts` line 331: `slider.fill('6')` changed to `slider.fill('5')` with comment `// slider max is 5 (1-5 scale)`. This is a bug fix but unrelated to the PR's stated scope.
- **Impact:** Positive — fixes a test that would fail if the slider enforces max=5. But mixing concerns in a refactor PR.
- **Correction:** Could have been a separate commit. Not blocking.

## Assumptions Review

| #   | Assumption                                                                                           | Validity | Notes                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `buildGreenCoffeeQuery` + `processGreenCoffeeData` are the canonical query shape for inventory reads | Valid    | These are the established pattern on main                                                                                |
| 2   | All consumers of `stockedStatusUtils` will tolerate the re-export shim                               | Valid    | TypeScript re-export is transparent; tested by `roast-profiles` and `chat/execute-action` continuing to use the old path |
| 3   | The cascade delete order (temps → events → profiles → inv → catalog) matches original                | Valid    | Verified line-by-line against main's DELETE handler. Identical order.                                                    |
| 4   | `getInventoryWithRoastSummary` produces identical output to the original GenUI endpoint              | Valid    | Query, processing, and stripping logic are identical. Summary stats moved to route handler but computation is the same.  |
| 5   | `updateStockedStatus` return shape is identical                                                      | Weak     | See P1-1. Extra `stocked: false` field added to error returns.                                                           |
| 6   | PUT response data reflects final DB state                                                            | Invalid  | See P1-2. Data returned before stocked status auto-update runs.                                                          |

## Tech Debt Notes

- **Debt introduced:** None significant. The new module is well-structured with clear separation.
- **Debt reduced:** Substantial. 3 route handlers no longer contain raw Supabase query logic for CRUD. Cascade delete consolidated from 1 copy (was only in beans handler) to single reusable function.
- **Debt remaining:** GET `/api/beans` still has direct query access (P2-1). Old import paths still used in 2 files (P2-2).
- **Suggested follow-up tickets:**
  - Migrate GET `/api/beans` read path to data layer (Phase 0.0 continuation)
  - Migrate `roast-profiles` and `chat/execute-action` imports from shim to direct import

## Product Alignment Notes

- **Alignment wins:** No UI-facing changes. All response shapes are preserved (with minor P1-1 exception). Share-token path untouched and verified functional.
- **Misalignments:** P1-2 stale data on PUT could show incorrect stocked status momentarily in the UI after editing quantity.

## Test Coverage Assessment

- **Existing tests that validate changes:** `tests/e2e/crud.spec.ts` covers the CRUD flow end-to-end. The slider fix (P3-2) improves test reliability.
- **Missing tests:** No unit tests for `src/lib/data/inventory.ts` functions directly. No test for cascade delete behavior. No test for stocked status auto-update after PUT.
- **Suggested test additions:**
  - Unit tests for `deleteInventoryItem` cascade order (mock Supabase client, verify call sequence)
  - Integration test for PUT + auto-stocked-status to verify returned data reflects final state

## Minimal Correction Plan

1. **P1-2 (stale PUT response):** After `updateStockedStatus` runs in the PUT handler, re-fetch the item before returning. Either call `getInventoryItem()` or re-query via `buildGreenCoffeeQuery`. Example fix:
   ```typescript
   if (updateData.purchased_qty_lbs !== undefined && updateData.stocked === undefined) {
   	try {
   		await updateStockedStatus(supabase, parseInt(id), user.id);
   		// Re-fetch to include updated stocked status
   		const { getInventoryItem } = await import('$lib/data/inventory.js');
   		const refreshed = await getInventoryItem(supabase, Number(id), user.id);
   		if (refreshed) updated = refreshed;
   	} catch (stockError) {
   		console.warn('Failed to auto-update stocked status:', stockError);
   	}
   }
   ```
2. **P1-1 (return shape):** Remove `stocked: false` from error returns in `updateStockedStatus` to match original shape, or explicitly document the shape change as intentional.

## Optional Patch Guidance

- **`src/routes/api/beans/+server.ts` PUT handler (~line 208-216):** Wrap the stocked status block to re-fetch `updated` after the auto-update completes.
- **`src/lib/data/inventory.ts` `updateStockedStatus` (~line 368-370):** On error returns, remove `stocked: false` to match `{ success: false, error: "..." }`.
