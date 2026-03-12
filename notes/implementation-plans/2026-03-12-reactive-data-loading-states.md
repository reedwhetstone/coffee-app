# Implementation Plan: Reactive Data After Mutations + Loading Indicators

**Date:** 2026-03-12  
**Branch:** `fix/reactive-data-and-loading-states`  
**Status:** Implemented

---

## Problem Summary

### Issue 1: Stale data after roast save (critical bug)

After any mutation on the roast page, `syncData()` refreshes `clientData` from the API. However,
three functions then looked for profiles in `data?.data` (the server-side page prop, only populated
on initial server render) instead of the freshly-fetched `clientData`. This meant the updated
profile was never found after a save, and the UI showed stale data until a full page reload.

**Affected functions:**

- `handleFormSubmit` — used `(data?.data || []).find(...)` to locate the newly-created profile
- `handleProfileUpdate` — used `(data?.data || []).find(...)` to reload the updated profile
- `saveRoastProfile` — used `(data?.data || []).find(...)` to select the saved profile

Additionally, `handleFormSubmit` called `syncData()` twice back-to-back (once before setting
`selectedBean`, once after). The first call was redundant; the second already covered the refresh.

### Issue 2: Missing loading indicators on beans and profit pages

The roast page has a `operationInProgress` state variable with a toast overlay showing a spinner
and status message during mutations. The beans and profit pages had no equivalent feedback — users
could click Save and see no visual indication that anything was happening.

---

## Changes Made

### `src/routes/roast/+page.svelte`

1. **`handleFormSubmit`**: Removed the first (duplicate) `await syncData()` call. Changed
   `(data?.data || []).find(...)` to `clientData.find(...)` for the new-profile lookup after sync.

2. **`handleProfileUpdate`**: Changed `(data?.data || []).find(...)` to `clientData.find(...)`
   for the post-sync profile lookup.

3. **`saveRoastProfile`**: Changed `(data?.data || []).find(...)` to `clientData.find(...)`
   for the saved-profile lookup in the non-roasting path.

### `src/routes/beans/+page.svelte`

Added `let isSaving = $state(false)` and wrapped `deleteBean()` and `handleFormSubmit()` with
saving-state guards. Added a fixed toast overlay (matching roast page style) that shows while
`isSaving` is true with an appropriate message.

### `src/routes/profit/+page.svelte`

Added `let isSaving = $state(false)` and wrapped `handleFormSubmit()` with saving-state guards.
Added the same fixed toast overlay pattern.

---

## Design Decisions

- **Consistent pattern**: The `isSaving` + toast approach on beans/profit mirrors the
  `operationInProgress` + toast on roast. Same visual design (blue spinner, fixed top-right
  overlay). Easy to scan across pages.
- **No new dependencies**: Pure Svelte 5 `$state`. No toast libraries.
- **Minimal footprint**: Only three files changed, exactly as scoped.

---

## Verification

- `pnpm check` — zero type errors
- `pnpm lint` — clean
- Manual: save a roast profile, confirm the profile is selected immediately without page reload
- Manual: delete a bean, confirm the spinner shows during the request
