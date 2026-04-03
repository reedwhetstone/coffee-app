# PR Verification Report

## Metadata

- **Repo:** coffee-app
- **Base:** origin/main (`1ed4bb2`)
- **Head:** `bfc5cf0` (feat/v1-catalog-missing-filter-params)
- **PR:** #215
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High
- **Scope note:** 4 files changed, 178 insertions, 6 deletions. Focused change; full context reviewed.

## Executive Verdict

- **Merge readiness:** Ready with fixes
- **Intent coverage:** Full
- **Priority summary:** P0: 0, P1: 1, P2: 3, P3: 2

## Intent Verification

- **Stated intent:** Fix two silently-broken query parameters on /v1/catalog: (1) `stocked=false` had no effect, (2) `origin=Ethiopia` was silently ignored. Add query parameters reference table to docs. Preserve backward compat (no `?stocked=` defaults to `stocked=true`).
- **What was implemented:** All three goals fully achieved. `parseCatalogQuery` now reads `stocked` (3-way: true/false/all) and `origin` params. `queryCatalogData` wires them through via `stockedFilter` and `origin`. Docs updated with comprehensive parameter table. Default behavior preserved.
- **Coverage gaps:** None against stated intent.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

- **Title:** Dropdown path (`fields=dropdown`) silently drops `stocked=false` (unstocked-only) filter
- **Evidence:** `catalogResource.ts:314` maps `stockedFilter` to the `getCatalogDropdown` call via `stockedOnly: stockedFilter === true`. When `stocked=false` is requested, `stockedFilter === true` evaluates to `false`, so `stockedOnly` is `false`. But `getCatalogDropdown` (`catalog.ts:316`) only has `if (stockedOnly) query = query.eq('stocked', true)` -- when `stockedOnly` is `false`, it applies **no** stocked filter at all, returning **all** items rather than only unstocked items.
- **Impact:** `GET /v1/catalog?fields=dropdown&stocked=false` returns the full catalog (stocked + unstocked) instead of only unstocked items. The `stocked=false` semantics are broken specifically in the dropdown path. This contradicts both the new docs and the behavior of the full-field path.
- **Correction:** Either: (a) upgrade `getCatalogDropdown` to accept a 3-way `stockedFilter` parameter like `searchCatalog` does, OR (b) if dropdown mode is always internal and the filtering distinction doesn't matter, document that limitation. Option (a) is cleaner and consistent.

### P2 (important improvements)

- **Title:** `filtersApplied` does not reflect `stockedFilter` in `searchCatalog` response
- **Evidence:** `catalog.ts:267` still only records `if (stockedOnly) filtersApplied.stockedOnly = stockedOnly`. Since `catalogResource.ts` now passes `stockedFilter` instead of `stockedOnly`, the `filtersApplied` object in the response will never contain a stocked indicator. Callers inspecting `filtersApplied` to understand what filtering was applied get no signal about stocked state.
- **Impact:** API response metadata is incomplete. Not user-facing breakage, but makes debugging and observability harder.
- **Correction:** Add `if (stockedFilter !== undefined) filtersApplied.stockedFilter = stockedFilter;` alongside or replacing the `stockedOnly` line in `searchCatalog`.

- **Title:** `origin` param in Supabase `.or()` filter string is not sanitized against PostgREST filter-syntax metacharacters
- **Evidence:** `catalog.ts:185-186` builds the filter string via template literal interpolation: `` `continent.ilike.%${origin}%,country.ilike.%${origin}%,region.ilike.%${origin}%` ``. The value comes directly from `url.searchParams.get('origin')` with no sanitization. A malicious `origin` value containing commas, dots, or PostgREST operators (e.g., `origin=foo%,id.eq.1`) could alter the filter logic.
- **Impact:** This is a pre-existing pattern used by all ilike filters in this function (dryingMethod, flavorKeywords all do the same). The risk is low because PostgREST parameterizes `.ilike.` values, and Supabase's JS client likely escapes these. But the pattern is worth auditing once, not per-PR.
- **Correction:** This is pre-existing tech debt, not introduced by this PR. No blocker, but a follow-up to validate that Supabase JS client's `.or()` properly parameterizes values (it does for `.ilike()` method calls, less clear for the string-based `.or()` syntax).

- **Title:** Docs table lists params not actually wired through in `parseCatalogQuery`
- **Evidence:** The new docs table at `content.ts:273-306` lists `processing`, `name`, `region` as available params. Cross-checking `parseCatalogQuery` (`catalogResource.ts:181-192`): `processing` is parsed, `name` is parsed, `region` is parsed. These are all wired. However, `continent` and `country` are listed as "Exact match" in docs but the code at `catalog.ts:189-190` uses `.eq()` for both, which is correct. No actual discrepancy found after verification.
- **Correction:** N/A - verified correct on closer inspection.

### P3 (nice to have)

- **Title:** Dual `stockedOnly` / `stockedFilter` interface on `CatalogSearchOptions` adds cognitive overhead
- **Evidence:** `catalog.ts:42-43` now has both `stockedOnly?: boolean` and `stockedFilter?: boolean | null` with a comment that `stockedFilter` takes precedence. Six other callers still use `stockedOnly` (home page, dashboard, internal catalog, tools endpoint, inventory). The dual interface is backward-compatible but creates a maintenance footprint where future developers must understand the precedence rule.
- **Impact:** No functional issue. Minor maintainability concern.
- **Correction:** Consider a follow-up PR to migrate all callers to `stockedFilter` and deprecate `stockedOnly`. The precedence logic in `searchCatalog` is correct and safe for now.

- **Title:** No test for the dropdown path with `stocked=false` or `stocked=all`
- **Evidence:** All new tests use the `searchCatalog` path (no `fields=dropdown` in any test URL). The dropdown mapping at `catalogResource.ts:314` (`stockedOnly: stockedFilter === true`) is untested.
- **Impact:** The P1 bug above would have been caught with a dropdown-path stocked filter test.
- **Correction:** Add tests for `GET /v1/catalog?fields=dropdown&stocked=false` and `stocked=all` to validate the dropdown path behavior.

## Assumptions Review

- **Assumption:** `parseCatalogQuery` always sets `filters.stocked` (never `undefined`)
- **Validity:** Valid
- **Why:** The ternary chain `stockedParam === 'false' ? false : stockedParam === 'all' ? null : true` always resolves to one of `true`, `false`, or `null`. `undefined` is impossible.
- **Recommended action:** None; the redundant `?? true` guard in `queryCatalogData` at line 310 is defensive and harmless.

- **Assumption:** Passing `origin` through to `searchCatalog` is safe because the ilike cross-field OR logic already existed
- **Validity:** Valid
- **Why:** `searchCatalog` already had `if (origin) { query = query.or(...) }` before this PR. The `origin` field on `CatalogSearchOptions` was already defined. This PR just wires the URL param to the existing code path.
- **Recommended action:** None.

- **Assumption:** `stocked=all` is the right UX for "no filter" (vs. omitting the param)
- **Validity:** Valid
- **Why:** Omitting the param defaults to `true` (backward compat). Users who explicitly want all items need a distinct value. `all` is a clean, conventional choice.
- **Recommended action:** None.

- **Assumption:** The legacy `/api/catalog` endpoint should also receive the new filter behavior
- **Validity:** Valid
- **Why:** Both `/v1/catalog` and `/api/catalog` delegate to `resolveCatalogRouteResult` which calls `parseCatalogQuery`. The fix applies uniformly to both endpoints. The `/api/catalog-api` endpoint also delegates to `buildCanonicalCatalogResponse`.
- **Recommended action:** None; this is a positive side-effect.

## Tech Debt Notes

- **Debt introduced:** Dual `stockedOnly` / `stockedFilter` interface on `CatalogSearchOptions`. Minor; the precedence comment is clear, and the legacy callers all work unchanged.
- **Debt worsened:** None.
- **Suggested follow-up tickets:**
  1. Migrate remaining `stockedOnly` callers to `stockedFilter` and deprecate `stockedOnly` (6 call sites: home, dashboard, catalog page, tools endpoint, filters endpoint, inventory).
  2. Upgrade `getCatalogDropdown` to support 3-way stocked filtering to match `searchCatalog` parity.
  3. Audit `.or()` string interpolation in `searchCatalog` for PostgREST filter injection safety.

## Product Alignment Notes

- **Alignment wins:** Docs now accurately describe what the API actually does, which is a significant UX improvement for API consumers. The `stocked=all` option enables use cases like "show me everything including historical/unstocked beans" which is valuable for analytics and research.
- **Misalignments:** None with stated product intent.
- **Suggested product checks:** Verify that the public docs page at `/docs/api/catalog` renders the new table correctly (already checked that the data structure matches the existing table pattern in `content.ts`).

## Test Coverage Assessment

- **Existing tests that validate changes:**
  - 4 new tests for `stocked` parameter (true, false, all, absent/default): all pass
  - 4 new tests for `origin` parameter (single country, continent, absent, combined with country): all pass
  - 3 existing tests updated from `stockedOnly: true` to `stockedFilter: true` to match new call signature
  - All 16 tests pass
- **Missing tests:**
  - Dropdown path with `stocked=false` and `stocked=all` (would catch the P1 bug)
  - `stocked` param with invalid values (e.g., `stocked=yes`, `stocked=0`) -- currently falls through to `true` which is reasonable but worth explicit coverage
  - `origin` param with special characters (commas, percent signs) to validate safety
- **Suggested test additions:**
  1. `fields=dropdown&stocked=false` -- verifies unstocked-only dropdown behavior
  2. `fields=dropdown&stocked=all` -- verifies unfiltered dropdown behavior
  3. `stocked=garbage` -- verifies graceful default to `true`

## Minimal Correction Plan

1. **Fix P1 (dropdown stocked=false):** Either upgrade `getCatalogDropdown` to accept `stockedFilter` (preferred), or add a separate `.eq('stocked', false)` path in the dropdown flow of `queryCatalogData`.
2. **Fix P2 (filtersApplied):** Add `stockedFilter` to the `filtersApplied` record in `searchCatalog`.
3. **Add missing tests:** Dropdown path tests for `stocked=false` and `stocked=all`.

## Optional Patch Guidance

### `src/lib/data/catalog.ts`

**getCatalogDropdown** -- add `stockedFilter` support:
```typescript
// Change the options interface to accept stockedFilter
options: {
    stockedOnly?: boolean;
    stockedFilter?: boolean | null; // same 3-way semantics
    publicOnly?: boolean;
    showWholesale?: boolean;
    wholesaleOnly?: boolean;
}

// Replace the single stockedOnly check with:
if (stockedFilter !== undefined) {
    if (stockedFilter === true) query = query.eq('stocked', true);
    else if (stockedFilter === false) query = query.eq('stocked', false);
    // null = no filter
} else if (stockedOnly) {
    query = query.eq('stocked', true);
}
```

**filtersApplied** -- add stockedFilter tracking:
```typescript
// After line 267, add:
if (stockedFilter !== undefined) filtersApplied.stockedFilter = stockedFilter;
```

### `src/lib/server/catalogResource.ts`

**queryCatalogData dropdown path** -- pass stockedFilter directly:
```typescript
const rows = await getCatalogDropdown(context.supabase, {
    stockedFilter,  // pass through directly instead of mapping
    publicOnly: context.publicOnly,
    showWholesale: context.showWholesale,
    wholesaleOnly: context.wholesaleOnly
});
```

### `src/lib/server/catalogResource.test.ts`

Add dropdown path tests in a new `describe('fields=dropdown stocked filtering')` block covering `stocked=false` and `stocked=all` with `mockGetCatalogDropdown` assertions.

---

## Follow-up Fix (commit 516b14f, 2026-04-02)

**P1 addressed:** `getCatalogDropdown` upgraded to accept `stockedFilter?: boolean | null` (same 3-way semantics as `searchCatalog`). `queryCatalogData` dropdown path now passes `stockedFilter` directly — no more lossy `stockedFilter === true` boolean mapping.

**P2 addressed:** Added `stockedFilter` to `filtersApplied` tracking in `searchCatalog`.

**Tests added:** 4 new dropdown path stocked filtering tests covering `stocked=true`, no-param, `stocked=false`, `stocked=all`. All 230 tests pass.

**Remaining deferred:**
- P3: Dual `stockedOnly`/`stockedFilter` interface — 6 legacy callers; follow-up PR.
- P2: `.or()` interpolation safety — pre-existing, needs Supabase audit.

**Status:** All CI green. Ready for merge.
