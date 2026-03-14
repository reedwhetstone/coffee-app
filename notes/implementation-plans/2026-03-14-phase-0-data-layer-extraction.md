# Phase 0.0: Data Access Layer Extraction

_Created: 2026-03-14_
_Status: Planning_
_Context: Groundwork for purveyors-cli. Extract scattered Supabase queries into a shared data service layer._

## Problem

Supabase queries are duplicated across 15+ API route handlers. The same "search the catalog" or "create a roast profile" logic exists in multiple files with slight variations. This makes it impossible to share data access between the web app and the CLI without duplicating again.

## Current State

### Tables and Where They're Queried

| Table                | Files                                                                                                    | Total Query Sites |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| `coffee_catalog`     | homepage, /api/catalog, /api/catalog-api, /api/tools/coffee-catalog, /api/tools/bean-tasting, /api/beans | 8                 |
| `green_coffee_inv`   | /api/beans, /api/tools/green-coffee-inv, /api/roast-profiles, /api/update-stocked-status, /api/profit    | 10                |
| `roast_profiles`     | /api/roast-profiles, /api/tools/roast-profiles, /api/beans (cascade), /api/clear-roast                   | 12                |
| `sales`              | /api/profit                                                                                              | 6                 |
| `roast_temperatures` | /api/roast-profiles, /api/clear-roast, roastDataUtils                                                    | 4                 |
| `roast_events`       | /api/roast-profiles, /api/clear-roast, roastDataUtils                                                    | 4                 |
| `api_usage`          | /api-dashboard/+page.server.ts, /api-dashboard/usage/+page.server.ts                                     | 2 (identical)     |

### Known Duplications

1. **Catalog search query** — built with dynamic filters in `/api/catalog`, `/api/catalog-api`, and `/api/tools/coffee-catalog`. Three separate implementations of the same filtering logic (origin, process, price range, flavor keywords, stocked).

2. **Roast data deletion** — `roast_temperatures` + `roast_events` DELETE in `/api/clear-roast/+server.ts` (inline), `/api/roast-profiles/+server.ts` DELETE handler (inline), and `roastDataUtils.ts` (as a function). Three copies.

3. **Green coffee inventory with catalog join** — queried in `/api/beans` (with full catalog details), `/api/tools/green-coffee-inv` (with roast summary), and `/api/roast-profiles` POST (for ownership verification). Different select columns but same base pattern.

4. **API usage stats** — identical query and aggregation logic in two dashboard pages.

5. **Stocked status calculation** — `stockedStatusUtils.ts` exists and is used, but `/api/update-stocked-status` PUT handler reimplements similar logic inline.

6. **Artisan file parsing** — 450 lines embedded in `/api/artisan-import/+server.ts`. Not reusable outside the route handler.

### Inconsistent Response Shapes

| Endpoint                          | Shape                                                  |
| --------------------------------- | ------------------------------------------------------ |
| GET /api/roast-profiles           | `{ data: RoastProfile[] }`                             |
| POST /api/roast-profiles (batch)  | `{ profiles, roast_ids }`                              |
| POST /api/roast-profiles (single) | raw array                                              |
| PUT /api/roast-profiles           | raw object                                             |
| GET /api/beans                    | `{ data: Bean[] }`                                     |
| GET /api/profit                   | `{ sales, profit }`                                    |
| POST /api/tools/coffee-catalog    | `{ coffees, total, filters_applied, search_strategy }` |
| POST /api/tools/green-coffee-inv  | `{ inventory, total_count }`                           |
| POST /api/tools/roast-profiles    | `{ profiles, total_count, calculations }`              |

### Existing Shared Utilities

- `src/lib/server/stockedStatusUtils.ts` — `updateStockedStatus()`. Used correctly.
- `src/lib/server/roastDataUtils.ts` — `clearRoastData()`, `insertTemperatures()`, `insertEvents()`, `saveRoastData()`. Exists but bypassed in some routes.
- `src/lib/server/greenCoffeeUtils.ts` — Type definitions only, no query functions.
- `src/lib/server/auth.ts` — `requireMemberRole()`, `requireAdminRole()`. Clean.
- `src/lib/server/apiAuth.ts` — API key validation. Clean.

## Proposed Architecture

### New: `src/lib/data/` — Shared Data Service Layer

Each file exports pure async functions that accept a Supabase client and return typed results. No request/response handling, no auth checks; those stay in the route handlers.

```
src/lib/data/
├── catalog.ts          # searchCatalog(), getCatalogItem(), getCatalogStats()
├── inventory.ts        # listInventory(), addToInventory(), updateInventory(), deleteInventory()
├── roast.ts            # listRoasts(), getRoast(), createRoast(), updateRoast(), deleteRoast(), clearRoastData()
├── sales.ts            # listSales(), recordSale(), updateSale(), deleteSale(), getProfitData()
├── tasting.ts          # getTastingNotes(), rateCoffee()
├── artisan.ts          # parseArtisanFile(), importArtisanData()
├── api-usage.ts        # getUsageStats(), getDailySummary()
└── types.ts            # Shared response types, query option interfaces
```

### Standardized Response Shape

Every data function returns:

```typescript
interface DataResult<T> {
	data: T;
	count?: number;
	error?: string;
}
```

Route handlers wrap these in `json()`. The CLI prints them directly. One shape everywhere.

### Migration Pattern

For each data function:

1. Extract the Supabase query from the route handler into `src/lib/data/<domain>.ts`
2. Type the inputs (filter options) and outputs (result type)
3. Replace the inline query in the route handler with a call to the data function
4. Find all other routes that duplicate the same query and replace them too
5. Verify behavior unchanged (existing E2E tests cover the routes)

Route handlers become thin:

```typescript
// Before: 40 lines of query building inline
export const GET: RequestHandler = async (event) => {
	const { user } = await requireMemberRole(event);
	const { data, error } = await event.locals.supabase
		.from('coffee_catalog')
		.select('*')
		.eq('stocked', true);
	// ... 20 more filter lines
	return json({ data });
};

// After: 3 lines
export const GET: RequestHandler = async (event) => {
	const { user } = await requireMemberRole(event);
	const result = await searchCatalog(event.locals.supabase, { stocked: true, ...filters });
	return json(result);
};
```

## Implementation Plan

### PR 1: `catalog.ts` — Catalog Search Consolidation

**Scope:** Extract catalog query logic into `src/lib/data/catalog.ts`
**Files affected:**

- NEW: `src/lib/data/catalog.ts`
- MODIFY: `src/routes/api/catalog/+server.ts` (190 lines → ~40)
- MODIFY: `src/routes/api/catalog-api/+server.ts` (310 lines → ~60, keeps API key auth)
- MODIFY: `src/routes/api/tools/coffee-catalog/+server.ts` (182 lines → ~30)
- MODIFY: `src/routes/(home)/+page.server.ts` (minor: use `searchCatalog()`)
  **Risk:** Low. All routes tested by Playwright.
  **Estimated effort:** Medium. The three catalog query builders have subtle differences in default filters, column selection, and response shaping.

### PR 2: `roast.ts` — Roast Profile CRUD + Clear Data

**Scope:** Extract roast operations into `src/lib/data/roast.ts`
**Files affected:**

- NEW: `src/lib/data/roast.ts`
- MODIFY: `src/routes/api/roast-profiles/+server.ts` (510 lines → ~80)
- MODIFY: `src/routes/api/clear-roast/+server.ts` (call `clearRoastData` from data layer)
- MODIFY: `src/routes/api/tools/roast-profiles/+server.ts` (use shared query)
- DEPRECATE: parts of `src/lib/server/roastDataUtils.ts` (absorbed into `roast.ts`)
  **Risk:** Medium. Roast profile CRUD is complex (batch create, cascade delete, weight loss calc, milestone updates).
  **Estimated effort:** High. Most complex extraction.

### PR 3: `inventory.ts` — Green Coffee Inventory

**Scope:** Extract inventory operations into `src/lib/data/inventory.ts`
**Files affected:**

- NEW: `src/lib/data/inventory.ts`
- MODIFY: `src/routes/api/beans/+server.ts` (362 lines → ~60)
- MODIFY: `src/routes/api/tools/green-coffee-inv/+server.ts` (use shared query)
- CONSOLIDATE: `src/lib/server/greenCoffeeUtils.ts` types into data layer
- CONSOLIDATE: stocked status logic from `stockedStatusUtils.ts`
  **Risk:** Medium. Bean deletion has cascade logic (delete roasts, temps, events first).

### PR 4: `sales.ts` + `tasting.ts` — Sales/Profit + Tasting Notes

**Scope:** Extract remaining data operations
**Files affected:**

- NEW: `src/lib/data/sales.ts`
- NEW: `src/lib/data/tasting.ts`
- MODIFY: `src/routes/api/profit/+server.ts` (322 lines → ~60)
- MODIFY: `src/routes/api/tools/bean-tasting/+server.ts`
  **Risk:** Low. Sales and tasting are simpler domains.

### PR 5: `artisan.ts` — Artisan Parser Extraction

**Scope:** Move Artisan parsing and import logic to shared module
**Files affected:**

- NEW: `src/lib/data/artisan.ts`
- MODIFY: `src/routes/api/artisan-import/+server.ts` (650 lines → ~30)
  **Risk:** Low. Self-contained; no other routes duplicate this logic.

### PR 6: `api-usage.ts` + Response Shape Cleanup

**Scope:** Deduplicate API usage queries, standardize response shapes
**Files affected:**

- NEW: `src/lib/data/api-usage.ts`
- MODIFY: `src/routes/api-dashboard/+page.server.ts`
- MODIFY: `src/routes/api-dashboard/usage/+page.server.ts`
- MODIFY: All API routes to use consistent `{ data, count?, error? }` shape
  **Risk:** Medium. Response shape changes could break frontend expectations.

## Sequencing

PRs 1-4 are the critical path for CLI groundwork. They establish the `src/lib/data/` pattern and cover the four main domains (catalog, roasts, inventory, sales).

PR 5 (Artisan) is important for `prvrs roast import-artisan` but doesn't block other CLI work.

PR 6 (response shapes) is a quality improvement that can happen in parallel.

**Total estimated effort:** 5-7 working days across 6 PRs.

## Success Criteria

After Phase 0.0:

- Every Supabase query lives in `src/lib/data/*.ts`
- Route handlers are < 100 lines each (auth + call data function + return json)
- Zero duplicated queries across routes
- All existing Playwright tests still pass
- The CLI repo can import `@purveyors/data` functions directly (once published as a package)
