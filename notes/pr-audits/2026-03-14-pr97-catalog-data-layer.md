# PR Verification Report — PR #97: Extract Catalog Data Layer

## Metadata

- **Repo:** reedwhetstone/coffee-app
- **Base:** origin/main (352533d)
- **Head:** origin/refactor/data-layer-catalog (99850b7)
- **PR:** #97
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High
- **Scope note:** Phase 0.0 PR 1/6 — extract `coffee_catalog` queries into `src/lib/data/catalog.ts`

## Executive Verdict

- **Merge readiness:** Ready with fixes
- **Intent coverage:** Partial (see P1-1 below)
- **Priority summary:** P0: 2, P1: 3, P2: 3, P3: 2

## Intent Verification

- **Stated intent:** Extract all `coffee_catalog` Supabase queries from scattered route handlers into `src/lib/data/catalog.ts`. Route handlers become thin (auth + call + return). No behavior changes.
- **What was implemented:** New shared module with `searchCatalog`, `getCatalogItem`, `getCatalogDropdown`, `getCatalogItemsByIds`, and `getPublicCatalog`. Four route files refactored to use these functions. CATALOG_API_COLUMNS moved to shared module.
- **Coverage gaps:**
  - 6 additional files still contain direct `.from('coffee_catalog')` calls that were not extracted (see P1-1)
  - Two behavioral changes introduced (see P0-1, P0-2)

## Findings by Severity

### P0 (must fix before merge)

#### P0-1: Wholesale filter added to home page — behavior change

- **Evidence:** `src/routes/(home)/+page.server.ts` — the new code passes `showWholesale: false` to `searchCatalog`, which applies `.eq('wholesale', false)`. The original code on `main` had NO wholesale filter at all — it was just `.eq('stocked', true)`.
- **Impact:** The home preview section will now exclude wholesale coffees. If any stocked coffees have `wholesale=true`, they will disappear from the marketing landing page. This is a **silent data regression** that changes what visitors see.
- **Correction:** Either:
  - (a) Pass `showWholesale: true` in the home page call so wholesale items are included (matching original behavior), or
  - (b) Explicitly document this as an intentional behavior change. Given the PR intent says "no behavior changes," option (a) is correct.

#### P0-2: Wholesale filter added to tools endpoint — behavior change

- **Evidence:** `src/routes/api/tools/coffee-catalog/+server.ts` — new code passes `showWholesale: false`, which applies `.eq('wholesale', false)`. The original code on `main` had NO wholesale filter — it only filtered `public_coffee=true` and optionally `stocked=true`.
- **Impact:** The GenUI tools endpoint will now silently exclude wholesale coffees from search results. This changes what the AI chat model can find and recommend.
- **Correction:** Pass `showWholesale: true` to match original behavior, or remove the `showWholesale` parameter entirely (the `searchCatalog` function defaults `showWholesale` to `false`... but that's the problem — see P1-2).

### P1 (should fix before merge)

#### P1-1: Intent says "all" queries extracted, but 6 files still have direct `.from('coffee_catalog')` calls

- **Evidence:** These files still contain direct Supabase queries on `coffee_catalog`:
  - `src/routes/api/beans/+server.ts` (4 occurrences)
  - `src/routes/api/chat/execute-action/+server.ts` (1 occurrence)
  - `src/routes/api/catalog/filters/+server.ts` (1 occurrence)
  - `src/routes/api/tools/coffee-chunks/+server.ts` (1 occurrence)
  - `src/routes/api/tools/bean-tasting/+server.ts` (1 occurrence)
  - `src/routes/catalog/+page.server.ts` (1 occurrence — authenticated catalog page)
  - `src/lib/services/ragService.ts` (1 occurrence)
- **Impact:** The stated goal was "all coffee_catalog queries now go through functions in `src/lib/data/catalog.ts`." This is only partially achieved. The 4 touched files are clean, but 7+ more remain with direct queries.
- **Correction:** Either:
  - (a) Extract the remaining queries in this PR (scope creep risk), or
  - (b) Update the PR description to clarify this is "Phase 0.0 PR 1/6: extract _read-only search/list queries_" and explicitly list the remaining files as follow-up work. The `beans` endpoint has write queries (INSERT/UPDATE) which are a different concern. The `catalog/filters` and `catalog/+page.server.ts` are read queries that arguably should be in this PR.

#### P1-2: `searchCatalog` default `showWholesale: false` is a hidden behavior landmine

- **Evidence:** In `catalog.ts` line ~163: when `showWholesale` is falsy (including undefined, the default), the function applies `.eq('wholesale', false)`. This means **every caller that doesn't explicitly pass `showWholesale: true` silently filters out wholesale items**.
- **Impact:** Any future consumer of `searchCatalog` that forgets to set `showWholesale` will get unexpected filtering. The `wholesaleOnly` / `showWholesale` / default-hidden triangle is confusing. The original behavior varied by endpoint — some filtered wholesale, some didn't. The shared function imposes one default on all callers.
- **Correction:** Consider making the default behavior explicit and safe: either `showWholesale: true` by default (no hidden filtering) and let callers opt into exclusion, or require the parameter (no default) to force callers to be explicit.

#### P1-3: `count: 'exact'` now runs on every `searchCatalog` call, including non-paginated ones

- **Evidence:** `catalog.ts` lines ~148-149:
  ```typescript
  const usePagination = offset !== undefined || limit !== undefined;
  const selectClause = usePagination ? ('*' as const) : ('*' as const);
  let query = supabase
  	.from('coffee_catalog')
  	.select(selectClause, usePagination ? { count: 'exact' } : { count: 'exact' });
  ```
  Both branches of the ternary are identical — `{ count: 'exact' }` always runs. The `selectClause` ternary is also identical (`'*'` both ways). This is dead code / copy-paste artifact.
- **Impact:** The `count: 'exact'` option triggers a full count query in PostgREST. For the home page preview (6 rows) and tools endpoint (max 15 rows), this is unnecessary overhead. The original code on these endpoints did NOT request count. For the internal `/api/catalog` paginated path, count was already used — that's fine.
- **Correction:** Only use `{ count: 'exact' }` when pagination is actually requested. The dead ternary should be simplified:
  ```typescript
  let query = supabase.from('coffee_catalog').select('*', usePagination ? { count: 'exact' } : {});
  ```

### P2 (important improvements)

#### P2-1: `filtersApplied` in response is incomplete

- **Evidence:** `catalog.ts` lines ~264-276 — the `filtersApplied` object only tracks a subset of the options (origin, process, variety, priceRange, flavorKeywords, name, dryingMethod, supplier, coffeeIds, stockedOnly, stockedDays, limit). It omits: continent, country, source, processing, cultivarDetail, type, grade, appearance, region, scoreValueMin/Max, costLbMin/Max, arrivalDate, stockedDate, offset, orderBy, orderDirection, publicOnly, showWholesale, wholesaleOnly.
- **Impact:** The tools endpoint relies on `filtersApplied` for its response. Currently the tools endpoint builds its own `filters_applied` object, so this is not a functional bug today. But any future consumer relying on `CatalogSearchResult.filtersApplied` gets an incomplete picture.
- **Correction:** Either populate all applied filters, or remove the feature and let callers build their own (which they already do).

#### P2-2: `process` and `processing` can double-filter

- **Evidence:** `catalog.ts` lines ~196-197:
  ```typescript
  if (process) query = query.ilike('processing', `%${process}%`);
  if (processing) query = query.ilike('processing', `%${processing}%`);
  ```
  If a caller passes both `process` and `processing`, two ilike filters are applied to the same column. Same issue with `variety`/`cultivarDetail` and `origin`/`region`.
- **Impact:** Low risk today since the GenUI endpoint uses `process` and the internal catalog uses `processing`, and no caller currently passes both. But the interface allows it and silently over-filters.
- **Correction:** Consider normalizing to a single property name per concept, or add a guard to prefer one over the other.

#### P2-3: `catalog/+page.server.ts` (authenticated catalog SSR) was NOT touched

- **Evidence:** `src/routes/catalog/+page.server.ts` still has a direct query: `.from('coffee_catalog').select('*').eq('stocked', true).eq('wholesale', false)...`.
- **Impact:** This is a clear candidate for extraction — it's a straightforward stocked catalog read. It was likely just missed.
- **Correction:** Extract this in a follow-up or add to this PR.

### P3 (nice to have)

#### P3-1: Dead code — `fields` option in `CatalogSearchOptions`

- **Evidence:** `CatalogSearchOptions` includes `fields?: 'full' | 'dropdown'` but `searchCatalog` never reads this property. The dropdown path is handled by a separate `getCatalogDropdown` function, and the calling code in `/api/catalog` switches on `fieldsParam` before calling either function.
- **Impact:** Confusing API surface — a caller might think passing `fields: 'dropdown'` to `searchCatalog` would use a lightweight query, but it doesn't.
- **Correction:** Remove `fields` from `CatalogSearchOptions` or wire it up.

#### P3-2: `CatalogDropdownResult` type is exported but never used

- **Evidence:** `catalog.ts` exports `CatalogDropdownResult` but `getCatalogDropdown` returns `CatalogDropdownItem[]` directly, not `CatalogDropdownResult`.
- **Impact:** Dead type in the public API. Minor clutter.
- **Correction:** Either use it as the return type or remove it.

## Assumptions Review

| Assumption                                            | Validity                                       | Why                                                                                            | Action                                        |
| ----------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `showWholesale: false` matches all original endpoints | **Invalid**                                    | Home page and tools endpoint had no wholesale filter on main                                   | Fix P0-1, P0-2                                |
| `count: 'exact'` is cheap enough for all paths        | **Weak**                                       | Adds unnecessary overhead for non-paginated queries (home preview, tools)                      | Fix P1-3                                      |
| All `coffee_catalog` queries are extracted            | **Invalid**                                    | 7+ files still have direct queries                                                             | Acknowledge in PR description or extract more |
| `searchCatalog` is a safe universal replacement       | **Weak**                                       | The default wholesale filtering silently changes behavior for callers that don't know about it | Fix P1-2                                      |
| Response shapes are identical pre/post                | **Valid for catalog-api and internal catalog** | Verified: the JSON structures match for all four touched endpoints                             | N/A                                           |
| Auth is preserved in route handlers                   | **Valid**                                      | All four route handlers retain their auth checks; catalog.ts correctly excludes auth           | N/A                                           |

## Tech Debt Notes

- **Debt introduced:**
  - Dual-name filter properties (`process`/`processing`, `variety`/`cultivarDetail`) create confusion
  - Dead ternary code in `searchCatalog` (identical branches)
  - Unused type (`CatalogDropdownResult`) and unused interface property (`fields`)
  - Incomplete `filtersApplied` tracking
- **Debt worsened:**
  - 7+ files still have direct `coffee_catalog` queries, now alongside the "single source of truth" module — mixed patterns
- **Suggested follow-up tickets:**
  - Extract remaining read queries (catalog/filters, catalog/+page.server.ts, ragService, bean-tasting, coffee-chunks)
  - Clarify beans API write queries — intentionally left out of data layer?
  - Normalize filter property naming to one set of names

## Product Alignment Notes

- **Alignment wins:** Clean separation of data access from route handlers is good architecture. The shared module will support the purveyors-cli package goal.
- **Misalignments:** The wholesale filter changes (P0-1, P0-2) silently alter what's visible on the marketing page and in AI chat. This could reduce coffee discovery for visitors and degrade GenUI recommendations.
- **Suggested product checks:** After fixing P0s, verify the home page preview and GenUI tool results match production behavior.

## Test Coverage Assessment

- **Existing tests that validate changes:** No unit tests exist for the new `catalog.ts` module. The Playwright E2E suite covers the catalog page but not the specific query behavior at this layer.
- **Missing tests:**
  - Unit tests for `searchCatalog` with various filter combinations
  - Unit tests for wholesale filter defaults
  - Integration tests verifying response shapes match pre-refactor
- **Pre-existing test failure:** `crud.spec.ts:331` — cupping notes slider test uses `max=5` but calls `fill('6')`. Not related to this PR.
- **Suggested test additions:** At minimum, a test file `src/lib/data/catalog.test.ts` that validates filter construction logic (could mock Supabase client).

## Minimal Correction Plan

1. **P0-1 + P0-2:** Fix wholesale defaults for home page and tools endpoint. Pass `showWholesale: true` where the original code had no wholesale filter.
2. **P1-3:** Fix the dead ternary — only use `{ count: 'exact' }` for paginated queries.
3. **P1-2:** Consider changing `searchCatalog` default to NOT filter wholesale unless explicitly asked. This fixes P0-1/P0-2 more fundamentally.
4. **P1-1:** Update PR description to scope what "all queries" means — clarify this covers the 4 main search/list endpoints and list remaining files as Phase 0.0 follow-up.

## Optional Patch Guidance

### `src/lib/data/catalog.ts`

**Lines ~148-149 (dead ternary):**

```typescript
// Before:
const usePagination = offset !== undefined || limit !== undefined;
const selectClause = usePagination ? ('*' as const) : ('*' as const);
let query = supabase
	.from('coffee_catalog')
	.select(selectClause, usePagination ? { count: 'exact' } : { count: 'exact' });

// After:
const usePagination = offset !== undefined;
let query = supabase.from('coffee_catalog').select('*', usePagination ? { count: 'exact' } : {});
```

### `src/routes/(home)/+page.server.ts`

**Line ~12:** Change `showWholesale: false` to `showWholesale: true` (or remove the parameter and change the default in `searchCatalog`).

### `src/routes/api/tools/coffee-catalog/+server.ts`

**Line ~74:** Change `showWholesale: false` to `showWholesale: true` (or remove the parameter).

### `src/lib/data/catalog.ts` (default behavior)

**Alternative systemic fix for P0-1, P0-2, and P1-2:** Change the wholesale default logic from "hide unless told otherwise" to "show unless told to hide":

```typescript
// Before (line ~163):
} else if (!showWholesale) {
    query = query.eq('wholesale', false);
}

// After — only hide wholesale when explicitly asked:
} else if (showWholesale === false) {
    query = query.eq('wholesale', false);
}
```

This makes the default "include everything" and only excludes wholesale when a caller explicitly passes `showWholesale: false`. The internal `/api/catalog` endpoint already passes this explicitly for both paginated and legacy paths, so its behavior is preserved.
