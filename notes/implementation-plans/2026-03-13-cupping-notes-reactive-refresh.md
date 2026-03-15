# Implementation Plan: Cupping Notes Reactive Refresh After Save

**Date:** 2026-03-13
**Slug:** cupping-notes-reactive-refresh
**Status:** Planning only — awaiting Reed approval before coding

---

## Feature

**DEVLOG item (Priority 2):** "Saving cupping notes doesn't refresh page data. After save, the UI should re-render to show the newly saved data without requiring manual refresh."

After saving cupping notes in `BeanProfileTabs`, the tasting radar chart and rating display do not reflect the newly saved data until the user manually reloads the page.

---

## Why Now

This is a direct continuation of the reactive-data work from PRs #91 and #94. Those PRs fixed stale-data bugs on the roast page (post-mutation `selectedBean` lookup, duplicate `syncData`, and the extracted `reloadProfile()` function). The cupping notes workflow has the same structural gap: mutation succeeds silently, but the display doesn't confirm it.

Fixing this now keeps momentum on the "reliable saves" thread while the code pattern is fresh and the scope is minimal (2-3 files, no API changes, no schema changes).

---

## Strategy Alignment Audit

**Active strategy themes supported:**

1. **Data reliability and professional workflow trust** — The tasting/cupping evaluation workflow is core to the product's value for serious roasters. A save that doesn't visibly confirm success undermines trust in the tool. This is the same reliability theme PR #91 addressed across roast/beans/profit.

2. **AI-first product differentiation** — The tasting notes radar chart (showing AI notes vs. user notes overlay) is one of the most visually distinctive features of the platform. If the user-side data doesn't refresh, the overlay comparison never updates after a first save. That's a product quality gap for a headline feature.

3. **User engagement loop** — The cupping notes form is a core retention mechanic: users who rate and annotate beans are more invested. A broken feedback loop (save → no visible result) discourages repeat use.

**Contradictions or conflicts with current direction:** None. This is pure reliability work with no architectural implications.

**Why now vs. other candidates:** Highest score (16) tied with two cosmetic fixes. Strategic alignment breaks the tie: this affects a core user workflow and continues an active repair thread rather than addressing cosmetic polish.

---

## Scope

**In scope:**

- Fix `handleCuppingSave` in `BeanProfileTabs.svelte` to ensure the cupping notes display refreshes immediately after a successful save
- Ensure `selectedBean` prop reflects the complete updated bean (with catalog join) after mutation
- Close the form and show updated notes/radar without requiring page reload

**Out of scope:**

- Cupping notes form UX redesign
- Changes to the `/api/beans` API contract
- Any schema or database changes
- Loading indicator (form already has submit behavior; a spinner can be a follow-up)

---

## Root Cause

### The flow that breaks

1. `handleCuppingSave` in `BeanProfileTabs.svelte` calls PUT `/api/beans?id=`
2. On success, it calls `onUpdate(updatedBean)` with the raw API response
3. `onUpdate` in `+page.svelte` does: `selectedBean = updatedBean` → `await refreshData()` → find refreshed bean in `typedFilteredData`

### Where it breaks

**Step 2 timing:** The PUT response from Supabase returns the `green_coffee_inv` row only — it does not include the `coffee_catalog` join. So `selectedBean = updatedBean` replaces the full joined object with a partial row, temporarily losing catalog data including `ai_tasting_notes`. The radar overlay collapses.

**Step 3 timing:** `typedFilteredData` is `$derived($filteredData)`, which is reactive to FilterStore. `refreshData()` updates `clientData` and calls `filterStore.initializeForRoute()`, but this is async. By the time `onUpdate` tries to read `typedFilteredData.find(...)`, FilterStore may not have propagated yet, so `refreshedBean` is `undefined` and `selectedBean` is never restored to the full joined object.

**Net result:** User sees the form close, and the radar chart either shows stale data or breaks entirely until a full page reload.

---

## Proposed Fix

Apply the pattern from PR #94 (`reloadProfile`): after a successful cupping save, fetch the full bean by ID (with catalog join) and set `selectedBean` directly, bypassing the filtered data lookup race.

### Option A (recommended): Fetch-after-save in `BeanProfileTabs`

Add a `reloadBean` async function that calls `GET /api/beans?id=<id>` (or the existing beans endpoint with an id filter) to retrieve the full joined bean. Call it after PUT succeeds, before `onUpdate`.

This keeps `BeanProfileTabs` self-contained for the refresh and eliminates the FilterStore race.

### Option B: Refetch in `onUpdate` callback (page.svelte)

Pass a `reload: true` signal through `onUpdate` and have `+page.svelte` call a dedicated `reloadBean(id)` function instead of `refreshData()` (which re-fetches the entire bean list). This is more efficient but requires adding a new API query parameter for single-bean fetching.

**Recommended: Option A** — consistent with how PR #94 handled it on the roast page, and doesn't require API changes.

---

## Files to Change

| File                                      | Change                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/beans/BeanProfileTabs.svelte` | Add `reloadBean(id)` after successful PUT in `handleCuppingSave`; call `onUpdate` with full refreshed bean                                                                                                      |
| `src/routes/beans/+page.svelte`           | Simplify `onUpdate` callback: remove the `typedFilteredData.find()` lookup (no longer needed if full bean arrives via `onUpdate`); keep `refreshData()` for list update or replace with lighter targeted update |

---

## API/Data Impact

None. Reads the same `/api/beans` endpoint that already exists. No new endpoints, no schema changes.

The GET endpoint for `/api/beans` needs to support filtering by `id` if it doesn't already. If not, the fix can use `GET /api/beans?id=<id>` or adapt to the existing endpoint shape. Check current implementation before coding.

---

## Acceptance Criteria

- [ ] User saves cupping notes; form closes; radar chart immediately shows updated user tasting notes
- [ ] User saves cupping notes; overall rating (rank) displayed in the header area reflects the new value without page reload
- [ ] AI tasting notes overlay (if present) is preserved after user notes save (catalog join not lost)
- [ ] Saving cupping notes does not cause the bean profile to collapse or flash to a loading state
- [ ] Editing cupping notes a second time shows the previously saved notes pre-populated in the form
- [ ] `pnpm check` passes (no TypeScript errors)
- [ ] `pnpm lint` passes (no lint errors)

---

## Test Plan

- **`pnpm check`** — zero type errors
- **`pnpm lint`** — clean
- **Manual (critical path):**
  1. Open a bean with existing cupping notes → edit → change a value → save → confirm radar updates in-place without reload
  2. Open a bean with no cupping notes → add notes → save → confirm radar appears in-place without reload
  3. Save notes → immediately open edit form → confirm pre-populated with newly saved values (not stale)
  4. Confirm AI tasting notes overlay (if bean has catalog AI notes) is still visible after user notes save
- **Playwright:** Existing E2E tests for beans page should still pass; no new E2E test required for this scoped fix (happy path is covered by manual verification; complex form interactions are out of Playwright scope here)

---

## Risks and Rollback

**Risk: GET /api/beans doesn't support id filter**

- Mitigation: Check first; if not, the fix can use the existing endpoint with a client-side find on fresh data
- Fallback: Option B (page.svelte onUpdate refetch)

**Risk: Full bean refetch adds latency between save and display**

- Probability: Low (single row fetch, Supabase is fast)
- Mitigation: Can show a brief loading state on the radar card (optional, not required for MVP fix)

**Rollback:** 2-3 file change, easy to revert. No API or DB changes.

---

## Open Questions for Reed

1. **Does `/api/beans` support `?id=<id>` for single-bean fetch?** If not, is it preferred to add that param or to use a different approach (like filtering client-side after a full list refresh)?

2. **Should we add an `isSaving` spinner/overlay to the cupping form submit button** as part of this PR (matching the PR #91 pattern on beans/profit), or keep that as a separate follow-up?

3. **Confirming the root cause:** Is the specific symptom you see "radar doesn't update after save" or "rank/rating doesn't update" or something else? Knowing the exact failure helps confirm we're targeting the right code path.
