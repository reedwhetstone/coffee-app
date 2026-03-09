# Form Architecture Refactor

**Date**: 2026-03-06
**Status**: PROPOSED
**Scope**: `/roast`, `/beans`, `/profit` pages + Actionsbar + FormShell

---

## Problem Statement

Forms have bad time-to-interactive and a confusing render sequence. When a user clicks "New Roast" from the sidebar, they:

1. Navigate to `/roast`
2. See a skeleton/loading state
3. Wait for `onMount` → `syncData()` (fetches ALL roast profiles)
4. Wait for `onMount` → `fetchAvailableCoffees()` (fetches beans)
5. Wait for `page.state` check + `setTimeout(100)` to show the form

The user wanted to open a form. They got a full page load instead.

Same pattern on `/beans` and `/profit`.

---

## Current Data Flow (per page)

### `/roast` page

**Server load** (`+page.server.ts`): Returns `{ role, user: { id } }` only.

**Client mount** does 3 things:

1. `fetchAvailableCoffees()` → `GET /api/beans` → filters to `stocked === true` → passed to `RoastProfileForm` as `availableCoffees`
2. `syncData()` → `GET /api/roast-profiles` → populates `clientData`, inits `filterStore`
3. Checks `page.state.showRoastForm` → `setTimeout(100)` → `isFormVisible = true`

**RoastProfileForm needs:**

- `availableCoffees` (stocked green_coffee_inv with coffee_catalog.name) — for the coffee select dropdown
- `selectedBean` (optional pre-selection with `{ id, name }`)
- `onSubmit` callback
- `onClose` callback
- No other page data required

### `/beans` page

**Server load**: Returns `{ role, user: { id } }` only.

**Client mount** via `$effect`:

1. `GET /api/beans` → `clientData` (user's inventory)
2. `GET /api/catalog` → `catalogData` (full catalog for form dropdown)
3. Inits `filterStore` with clientData
4. Checks `page.state.showBeanForm` → `setTimeout(100)` → `handleAddNewBean()`

**BeanForm needs:**

- `catalogBeans` (coffee_catalog rows, filtered to stocked in form) — for "from catalog" entry mode
- `bean` (existing inventory item when editing, null for new)
- `onSubmit` / `onClose` callbacks

### `/profit` page

**Server load**: No `+page.server.ts` at all.

**Client `$effect`**:

1. `fetchInitialSalesData()` → `GET /api/profit` → sales + profit data
2. `fetchAvailableCoffees()` → `GET /api/beans` → stocked coffees for sale dropdown
3. `fetchAvailableBatches()` → `GET /api/roast-profiles` → batches for sale dropdown
4. Checks `page.state.showSaleForm` → `setTimeout(100)` → `showSaleForm()`

**SaleForm needs:**

- `availableCoffees` (stocked green_coffee_inv) — coffee select
- `availableBatches` (roast_profiles) — batch select
- `sale` (existing sale when editing, null/undefined for new)
- `onSubmit` / `onClose` callbacks

### CuppingNotesForm

- Not part of Actionsbar flow
- Embedded inside BeanProfileTabs (inline, not modal)
- Zero data fetching; pure form component
- **No changes needed**

---

## Root Causes

### 1. Form intent is invisible to the server

`goto('/roast', { state: { showRoastForm: true } })` uses client-only history state. The server load function has no idea a form is being requested. It cannot optimize for that path.

### 2. Form data is fetched as a side effect of the whole page

Every page fetches ALL its data on mount, even when the user only wants a form. The form's data requirements are a subset of the page's, but they're bundled together.

### 3. Timing hacks compensate for architecture gaps

`setTimeout(100)` appears 8+ times across these pages. Each one exists because the code needs to wait for something that should have been available from the start.

### 4. Custom window events are a fragile event bus

`window.dispatchEvent(new CustomEvent('show-roast-form'))` only works if the target page is already mounted. The Actionsbar has to branch on `routeId === '/roast'` vs navigate-then-hope.

---

## Proposed Architecture

### Core Principle: URL is the source of truth for intent

Replace `page.state` + custom events with query parameters:

- `/roast?modal=new` → show roast form immediately
- `/beans?modal=new` → show bean form immediately
- `/profit?modal=new` → show sale form immediately
- `/roast?modal=new&beanId=123&beanName=Ethiopia` → pre-select bean

### Server-side form data loading

When the server load detects `?modal=new`, it can pre-fetch ONLY the data the form needs alongside the minimal page data. This eliminates the client-side waterfall for the form-open path.

```
+page.server.ts (roast):
  const wantsForm = url.searchParams.get('modal') === 'new'

  // Always needed:
  const role = locals.role

  // Page data (parallel):
  const profilesPromise = fetchProfiles(...)

  // Form data (only if modal):
  const formCoffeesPromise = wantsForm
    ? fetchStockedCoffees(...)
    : Promise.resolve(null)

  const [profiles, formCoffees] = await Promise.all([profilesPromise, formCoffeesPromise])

  return { role, profiles, formCoffees, showForm: wantsForm }
```

### Simplified Actionsbar

```svelte
function handleNewRoast() {
  goto('/roast?modal=new');
  onClose();
}
```

No branching on current route. No custom events. Just navigate.

### Page-level form rendering

```svelte
// In +page.svelte
let showForm = $state(data.showForm ?? false);

// Derived from URL for client-side open/close too
$effect(() => {
  const modal = page.url.searchParams.get('modal');
  showForm = modal === 'new';
});

// Close handler clears the URL param
function closeForm() {
  const url = new URL(page.url);
  url.searchParams.delete('modal');
  goto(url.pathname + url.search, { replaceState: true });
}
```

### Remove setTimeout chains

Every `setTimeout` in the form-open path gets eliminated because:

- Form visibility is derived from URL (reactive, not imperative)
- Form data comes from server load (available on first render)
- No need to wait for mount, then check state, then delay

---

## Execution Plan

### Phase A: Roast page (pilot)

**Files touched:**

- `src/routes/roast/+page.server.ts` — fetch profiles + form coffees
- `src/routes/roast/+page.svelte` — URL-driven form, remove setTimeout/custom events/state checks
- `src/lib/components/layout/Actionsbar.svelte` — `goto('/roast?modal=new')`
- `src/routes/beans/BeanProfileTabs.svelte` — update "New Roast" links to use `?modal=new`

**Data verified:**

- RoastProfileForm needs: `availableCoffees` (stocked beans with catalog name). Source: `GET /api/beans` filtered client-side to `stocked === true`. Move to server: query `green_coffee_inv` join `coffee_catalog(name)` where `stocked = true`.
- Page needs: roast profiles (`GET /api/roast-profiles`). Keep fetching.
- Both can be fetched in parallel in server load.

**What gets removed:**

- `fetchAvailableCoffees()` function in +page.svelte
- `window.addEventListener('show-roast-form', ...)` in onMount
- `page.state.showRoastForm` check
- All `setTimeout` calls related to form visibility
- Custom `show-roast-form` window event path in Actionsbar

### Phase B: Beans page

**Files touched:**

- `src/routes/beans/+page.server.ts` — fetch inventory + catalog
- `src/routes/beans/+page.svelte` — URL-driven form, remove client fetch waterfall

**Data verified:**

- BeanForm needs: `catalogBeans` (full coffee_catalog, filtered to stocked in form). Source: `GET /api/catalog`. Move to server.
- Page needs: user inventory (`GET /api/beans`). Move to server.
- Page also needs catalog for card display (coffee_catalog join already in beans query).

### Phase C: Profit page

**Files touched:**

- `src/routes/profit/+page.server.ts` (create new)
- `src/routes/profit/+page.svelte` — URL-driven form, server data

**Data verified:**

- SaleForm needs: `availableCoffees` (stocked beans), `availableBatches` (roast profiles). Both currently fetched client-side.
- Page needs: profit + sales data (`GET /api/profit`).
- All 3 can be fetched in parallel in server load.

### Phase D: FormShell cleanup

After A-C land, revisit FormShell:

- Ensure `<form>` submit semantics work (enter-to-submit, validation)
- Consider whether modal forms should own their `<form>` or if FormShell wraps it
- CuppingNotesForm (inline, no modal) stays card-mode only

---

## What This Does NOT Change

- Form field markup and business logic (unchanged)
- API endpoints (unchanged)
- CuppingNotesForm (not part of Actionsbar flow)
- RoastChartInterface lazy loading (still deferred, unrelated to form)
- filterStore initialization pattern (still needed for page content)

---

## Expected Outcome

- "New Roast" click → form visible on first paint (no skeleton, no setTimeout)
- Form data arrives with the page (server-fetched, parallel)
- URL is bookmarkable (`/roast?modal=new`)
- Custom window events eliminated
- setTimeout count in form paths: 8+ → 0
