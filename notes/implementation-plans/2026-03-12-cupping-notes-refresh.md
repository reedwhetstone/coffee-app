# Cupping Notes Save — Stale Display After Save Fix

**Date:** 2026-03-12
**Slug:** cupping-notes-refresh
**Status:** Planning only — awaiting Reed approval before coding

---

## Feature

Fix the bug where saving cupping notes via the `CuppingNotesForm` leaves the cupping tab
showing stale (or blank) notes after the form closes. After a successful save, the updated
notes and rating should appear immediately without requiring a manual page refresh.

---

## Why Now

This is a P2 UX bug that actively undermines a core differentiating workflow. Cupping
assessment (the radar chart, per-dimension scoring, brew method) is one of the most
distinctive features in the app. Saving detailed notes and then seeing "No cupping notes"
until you refresh is the kind of friction that teaches users not to trust the app.

Easy to fix, high perceived quality improvement, no architectural risk.

---

## Root Cause Diagnosis

The bug lives in the `onUpdate` callback in `src/routes/beans/+page.svelte`.

Current flow:

1. `CuppingNotesForm` calls `onSave(notes, rating)` → `BeanProfileTabs.handleCuppingSave()`
2. PUT `/api/beans?id=...` → returns fully-joined `updatedBean` (with fresh `cupping_notes`)
3. `showCuppingForm = false` → triggers re-render of cupping tab overview
4. `onUpdate(updatedBean)` → parent callback fires

In the parent's `onUpdate` callback:

```
selectedBean = updatedBean        // ← correct: sets fresh data
await refreshData()               // ← re-fetches all beans, updates clientData + filterStore
const refreshedBean = typedFilteredData.find(...)  // ← BUG: may read stale derived state
if (refreshedBean) { selectedBean = refreshedBean } // ← overwrites fresh data with stale bean
```

The problem: `typedFilteredData` is `$derived($filteredData)` where `$filteredData` derives
from a Svelte 4 `filterStore`. After `await refreshData()`, the store update batches
asynchronously before the derived computes. Reading `typedFilteredData.find()` in this
async context can return the old bean (with `cupping_notes: null`), and setting
`selectedBean = refreshedBean` overwrites the just-set fresh data.

Result: the cupping tab re-renders with empty notes. User has to hard-refresh.

The API PUT response (`updatedBean`) is already fully joined via `buildGreenCoffeeQuery`
(includes `coffee_catalog`, `roast_profiles`, `cupping_notes`, etc.). There is no need to
re-fetch `selectedBean` from the filter store after the update.

---

## Strategy Alignment Audit

**Active strategy themes this supports:**

1. **Data completeness and completeness for existing users** — Cupping notes are the
   primary user-generated data layer on top of catalog data. The "Who Profits When
   Coffee Data Stays Scarce?" post (Mar 11) argues that user-curated annotations are
   exactly the kind of data the industry systematically under-surfaces. Fixing the save
   flow makes the cupping assessment genuinely usable, not just decorative.

2. **Platform reliability and trust** — The recent blog posts frame purveyors.io as a
   serious data-first platform. A form that doesn't show your saved data erodes that
   positioning directly. Every bug like this is a credibility hit.

3. **Completing shipped features before starting new ones** — Cupping assessment (radar
   chart, per-dimension scoring, brew method) was a non-trivial build. The save feedback
   loop is the last mile. This closes the loop cleanly.

**Contradictions or concerns:**

None. This is a scoped bug fix in an existing feature with no schema changes.

**Verdict: Strongly aligned.** Closes a workflow gap in a differentiating feature,
supports platform reliability, zero architectural risk.

---

## Scope

**In:**

- Fix `onUpdate` callback in `+page.svelte` to not overwrite `selectedBean` with stale
  `typedFilteredData` after `refreshData()`
- Ensure `selectedBean` is updated from the API response (`updatedBean`) before form closes

**Out:**

- No changes to `BeanProfileTabs.svelte` or `CuppingNotesForm.svelte`
- No changes to `/api/beans` PUT endpoint
- No changes to `filterStore`
- Not fixing the broader "Poor page refresh management" item (different scope)
- Not adding optimistic updates

---

## Proposed Fix

### File: `src/routes/beans/+page.svelte`

Replace the `onUpdate` callback (currently ~lines 471-481):

**Before:**

```javascript
onUpdate={async (updatedBean) => {
    // Update selectedBean and refresh data
    selectedBean = updatedBean;
    await refreshData();
    // Update selectedBean from refreshed data
    const refreshedBean = typedFilteredData.find((bean) => bean.id === updatedBean.id);
    if (refreshedBean) {
        selectedBean = refreshedBean;
    }
}}
```

**After:**

```javascript
onUpdate={async (updatedBean) => {
    // Use the fully-joined API response directly — no need to re-find from
    // typedFilteredData (which may not have propagated yet after refreshData)
    selectedBean = updatedBean;
    // Refresh the list in the background so card data stays current
    refreshData();
}}
```

Key changes:

1. `selectedBean = updatedBean` stays as-is (correct — fresh data from API)
2. `await refreshData()` becomes non-awaited `refreshData()` (fire-and-forget background refresh of the list; not needed for the profile view)
3. Remove the `typedFilteredData.find()` + `selectedBean = refreshedBean` block entirely

The `updatedBean` returned by PUT `/api/beans` already goes through `buildGreenCoffeeQuery`

- `processGreenCoffeeData`, so it's fully hydrated with all joined fields. Using it directly
  is both correct and sufficient.

---

## Files to Change

1. **`src/routes/beans/+page.svelte`** — simplify `onUpdate` callback (~5 lines removed, 0 added)

---

## API / Data Impact

- No API changes
- No schema changes
- `refreshData()` still fires (keeps the card list up to date) — just not awaited

---

## Acceptance Criteria

- [ ] Open a bean profile, navigate to the Cupping tab
- [ ] Click "Add Cupping Notes" (or "Edit"), fill in scores + tags + rating, click "Save Cupping Notes"
- [ ] Form closes → cupping tab immediately shows the new radar chart, dimension scores, tags, and overall rating
- [ ] No manual refresh required to see the saved data
- [ ] Saving a bean edit (non-cupping) still works correctly (same `onUpdate` callback)
- [ ] `pnpm check` passes with no new TypeScript errors
- [ ] `pnpm lint` passes

---

## Test Plan

1. `pnpm check` — TypeScript strict mode
2. `pnpm lint` — ESLint clean
3. `pnpm test:unit` — vitest passes (no unit tests directly touch this callback)
4. **Manual E2E:**
   - Navigate to `/beans`, select a bean
   - Open Cupping tab, add cupping notes + rating, save
   - Verify: cupping tab shows updated radar and notes without page refresh
   - Verify: overall rating crescent at top of profile updates immediately
   - Verify: editing overview fields (notes, purchase_date, etc.) still works
5. Playwright existing beans E2E: should continue passing (no structural change)

---

## Risks and Rollback

**Risk level: Very low**

- Change removes 4 lines from an async callback; adds 0 lines
- `refreshData()` still fires — list still refreshes — only difference is `selectedBean`
  is no longer overwritten with a potentially stale value after the refresh
- Worst case: list card and profile briefly show slightly different data for ~200ms
  while background refresh completes (same as before, but the profile is now correct)
- Rollback: `git revert` the single commit; no DB changes, no migration

---

## Open Questions for Reed

1. **`refreshData()` fire-and-forget:** The list refresh is now non-awaited. In practice
   the list updates within ~200-400ms and the user is looking at the profile anyway.
   Is this acceptable, or do you want a subtle loading indicator on the card list?

2. **Same fix for the general "poor page refresh" issue?** The broader P2 item covers
   the same root cause pattern across `saveChanges()` on the overview tab. Should this
   PR also fix that callback, or keep it scoped to the cupping save path only?

3. **Rating crescent update:** After saving cupping notes (which also saves `rank`), the
   rating crescent at the top of the profile should update. Confirm this resolves it
   with the fix above, or flag if the crescent reads from a different reactive source.
