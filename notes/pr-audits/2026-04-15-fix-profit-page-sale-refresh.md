# PR Audit: fix/profit-page-sale-refresh (PR #269)

**Date:** 2026-04-15  
**Repository:** coffee-app  
**Intent:** Refresh /profit page immediately after a successful new sale submission so charts and summary data reflect the saved sale without a manual browser refresh. Keep the URL-driven modal flow intact, and if the post-save refresh fails, do not silently close the modal into stale data.

---

## Changes at a Glance

### `src/routes/profit/+page.svelte`

1. `handleFormSubmit`: `hideForm()` and `selectedSale = null` moved from `finally` into the `try` block — modal now only closes after successful data refresh.
2. On refresh failure: instead of `alert()` then fall-through, now `throw new Error(...)` — the error propagates back to SaleForm.
3. `fetchInitialSalesData()`: removes the inner try/catch; errors now surface to the caller (which is the right layer for error handling).

### `src/routes/profit/SaleForm.svelte`

- Changed `onSubmit(newSale); onClose();` to `await onSubmit(newSale);` — the form now waits for the parent's data refresh before returning.

---

## Acceptance Criteria Analysis

### AC1: "Creating a new sale from the profit page updates displayed sales/profit data without a manual browser refresh."

**Status: SATISFIED.**  
The flow is: SaleForm POSTs to `/api/profit` → on success, `await onSubmit(newSale)` calls `handleFormSubmit` in the parent → `handleFormSubmit` calls `fetchInitialSalesData()` which fetches fresh `/api/profit` data → sets `salesData` and `profitData` reactively → charts re-render. No browser refresh required.

### AC2: "The profit page modal closes only after the success path is complete, or otherwise does not leave the UI in a stale/ambiguous state."

**Status: PARTIALLY BROKEN — P0.**

The `finally` → `hideForm()` move is correct for the success path. But on the **failure path**, a critical gap exists.

When `fetchInitialSalesData()` throws in `handleFormSubmit`:

1. The error is thrown from within the `try` block.
2. The `finally` block runs: `isSaving = null` (saving indicator disappears silently).
3. The error propagates out to SaleForm's `await onSubmit(newSale)`.
4. SaleForm's own `catch` block runs: `console.error(...)` and **nothing else**. No alert, no toast, no error state.
5. SaleForm falls through and the function returns — the modal remains open (because `hideForm()` was never called), but the user sees nothing. No error message. No saving indicator. Just a dead-looking form.

The acceptance criterion explicitly requires the UI not be left "in a stale/ambiguous state." A blank open modal with no feedback is ambiguous and stale.

### AC3: "Sales and profit visualizations both reflect the saved record after submission."

**Status: SATISFIED (on success).**  
`salesData` and `profitData` are the reactive sources for `SalesChart` and `PerformanceChart`. After `fetchInitialSalesData()` populates both arrays, both charts receive updated props and re-render.

### AC4: "Existing route/modal behavior on /profit remains intact."

**Status: SATISFIED.**  
`isFormVisible` remains a `$derived` from `page.url.searchParams.get('modal') === 'new'`. `hideForm()` continues to use `goto()` with `replaceState: true` to remove the `modal` param. No behavioral change to the URL-driven modal pattern.

### AC5: "No regression to sale creation flow for stocked coffees and roast batch selection."

**Status: SATISFIED.**  
No changes to `availableCoffees`, `availableBatches`, `fetchAvailableCoffees()`, `fetchAvailableBatches()`, `handleCoffeeChange()`, `handleBatchChange()`, `filteredBatches`, or `filteredCoffees`. The selection and filtering logic is untouched.

---

## Error Handling Audit

### Confirmed Defect: Failure path leaves user with no feedback

**File:** `src/routes/profit/SaleForm.svelte`, lines ~58-66

```ts
} catch (error) {
    console.error(`Error ${isUpdate ? 'updating' : 'creating'} sale:`, error);
}
```

This `catch` block is for the **API call** failure (non-200 response from `/api/profit`). That error is handled correctly with an `alert()`.

However, after this PR, when `await onSubmit(newSale)` is called, `onSubmit` (which is `handleFormSubmit`) can **also** throw — specifically when the subsequent `fetchInitialSalesData()` call fails. This error propagates back into the same `catch` block above, but that block has no awareness of `onSubmit` throwing. It only handles API call errors and logs them to console.

**Result:** After a data refresh failure, the user sees nothing. The modal stays open but has no error state. The saving indicator disappears. The form is inert.

### Fix Options (concrete)

**Option A — SaleForm catches the onSubmit error and alerts:**

```ts
try {
	const newSale = await response.json();
	await onSubmit(newSale);
} catch (error) {
	alert('Sale was saved but the page could not refresh. Please refresh your browser manually.');
	onClose(); // close gracefully rather than leaving modal stuck open
}
```

**Option B — Parent returns structured result instead of throwing, SaleForm reads it:**

```ts
// In +page.svelte handleFormSubmit:
try {
	await fetchInitialSalesData();
	hideForm();
	selectedSale = null;
	return { ok: true };
} catch (error) {
	// throw and also signal via return
	return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
}
```

Then SaleForm checks the return value:

```ts
const result = await onSubmit(newSale);
if (!result.ok) {
	alert(`Sale saved but page refresh failed: ${result.error}. Please refresh manually.`);
	onClose();
}
```

Option A is simpler. Option B is cleaner architecturally. Both satisfy AC2.

### Minor: "create" hardcoded in alert even on update path

**File:** `src/routes/profit/SaleForm.svelte`, line ~61:

```ts
alert(`Failed to ${isUpdate ? 'update' : 'create'} sale: ${data.error}`);
```

This uses `isUpdate` correctly for API failures. No issue here.

### Minor: isSaving cleared before error propagates

**File:** `src/routes/profit/+page.svelte`

The `finally` block clears `isSaving` before the thrown error propagates to SaleForm. This means the saving indicator disappears before SaleForm can display any feedback. Low severity (the alert in Option A above would render on top regardless), but worth noting.

---

## Additional Observations

### No test coverage for the failure path

There is no `+page.test.ts` or equivalent for the profit page. The success path (data refresh after save) and the failure path (refresh fails after save) are not exercised. Given this PR introduces explicit error propagation across a component boundary, a test would have caught the silent failure immediately.

### No TypeScript error on the thrown Error

The `throw new Error(...)` construction is valid TypeScript. No issue.

### Error message specificity

The error message thrown on refresh failure is: `"Failed to refresh profit data after saving sale"` — this is a good descriptive message. It survives the Option A fix (where it would appear in the alert).

### No change to `formDataLoading`

The diff comment mentions "Removed fetchProfitData" and "Removed fetchRoastProfileData" but these were already removed before this PR. No issue.

---

## Verdict

**VERDICT: fail**  
**P0: 1** (SaleForm silently swallows the refresh failure error; user gets no feedback)  
**P1: 0**  
**P2: 0**  
**P3: 0**  
**NEXT_ACTION: patch_same_pr**  
**TOP_FIXES:**

- Wrap `await onSubmit(newSale)` in a try/catch in `SaleForm.svelte` that alerts the user on failure and calls `onClose()` gracefully rather than silently falling through.
- Alternatively, restructure `handleFormSubmit` to return a result object `{ ok, error? }` and have SaleForm read and act on it.

**CONFIDENCE: high**  
**SCOPE_ASSESSMENT: mergeable**  
**VALIDATION_STATUS:**

- Code review of success path: VALIDATION_PASS
- Code review of failure path: VALIDATION_FAIL (confirmed defect above)
- Local CI: VALIDATION_BLOCKED_ENV (no env exports for this host; CI will run Playwright tests)

---

## Summary

The PR correctly fixes the success path — moving `hideForm()` into the `try` block ensures the modal only closes after data refresh. The `await onSubmit()` change in SaleForm is the right pattern for coordinating across a component boundary.

However, the failure path is broken. When the data refresh throws, the error propagates to SaleForm where it is swallowed by the existing `console.error` catch block. The user sees nothing — no error message, no saving indicator, just an inert open form. This violates AC2 directly.

The fix is a ~5-line change in SaleForm's `handleSubmit` to wrap `await onSubmit(newSale)` in a try/catch that shows an alert on failure and closes the modal gracefully. Once that is in place, this PR is mergeable and the acceptance criteria are satisfied.
