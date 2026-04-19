# Implementation Plan: /v1/catalog Missing Filter Params (`stocked` and `origin`)

**Date:** 2026-04-02
**Slug:** v1-catalog-missing-filter-params
**Status:** Planning only — awaiting Reed approval before coding
**Repo:** coffee-app
**Focus Area:** API contract correctness / platform gaps

---

## Problem

`/v1/catalog` silently ignores two query parameters that API consumers expect to work:

### Bug 1: `stocked=false` does not filter (hardcoded `stockedOnly: true`)

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# stocked=true: returns 1139 (all stocked items — correct)
curl "https://www.purveyors.io/v1/catalog?stocked=true&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin); print('stocked=true total:', d['pagination']['total'])"
# → stocked=true total: 1139

# stocked=false: ALSO returns 1139 (bug — should return 0 or only unstocked items)
curl "https://www.purveyors.io/v1/catalog?stocked=false&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin); print('stocked=false total:', d['pagination']['total'])"
# → stocked=false total: 1139
```

Both `stocked=true` and `stocked=false` return identical results: the same 1139 items in the same order. The parameter does nothing.

**Root cause (catalogResource.ts):** `queryCatalogData` hardcodes `stockedOnly: true` in both call sites and never passes a `stocked` filter from the parsed query:

```typescript
// Line 299 — dropdown path
const rows = await getCatalogDropdown(context.supabase, {
    stockedOnly: true,  // ← hardcoded, ignores ?stocked=
    ...
});

// Line 337 — main search path
const result = await searchCatalog(context.supabase, {
    stockedOnly: true,  // ← hardcoded, ignores ?stocked=
    ...
});
```

`parseCatalogQuery` never reads `stocked` from `url.searchParams` at all. The `ParsedCatalogQuery` type has no `stocked` field.

### Bug 2: `origin=` param is silently ignored (undocumented, CLI supports it)

```bash
# origin=Ethiopia: returns 1139 (all items — broken)
curl "https://www.purveyors.io/v1/catalog?origin=Ethiopia&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin); print('origin=Ethiopia total:', d['pagination']['total'])"
# → origin=Ethiopia total: 1139

# country=Ethiopia: returns 120 (correct — this filter IS wired up)
curl "https://www.purveyors.io/v1/catalog?country=Ethiopia&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin); print('country=Ethiopia total:', d['pagination']['total'])"
# → country=Ethiopia total: 120
```

**Root cause:** `searchCatalog` in `catalog.ts` already supports an `origin` param that cross-matches `continent`, `country`, and `region` via `ilike`. But `parseCatalogQuery` in `catalogResource.ts` never reads `origin=` from the URL; only the separate `country=` and `continent=` params are wired. So `origin=` is available in the data layer but never surfaced in the API.

**CLI comparison:** The CLI's `purvey catalog search --origin "Ethiopia"` is documented to do cross-field partial matching (content.ts line 688: `"--origin accepts partial matches across country, continent, and region fields."`). API consumers reading the docs expect the same capability on the API endpoint.

---

## Impact

**Bug 1 (stocked):** Any consumer building a "show me what's currently stocked" integration gets the wrong answer. Passing `stocked=false` to browse the full historical catalog also returns only stocked items. The filter contract is completely non-functional.

**Bug 2 (origin):** The CLI's most commonly documented filter (`--origin "Ethiopia"`) has no API equivalent. Developers migrating from the CLI to the API face a documentation cliff.

Severity: **High for API contract trust.** Query params that silently fail are worse than missing params — they give consumers the illusion of filtering without any actual effect.

---

## Proposed Fix

### Fix 1: Wire `stocked` param (two-option design choice)

**Option A: Expose `stocked=true|false|all` with backward-compatible default**

Add `stocked` to `ParsedCatalogQuery.filters` and parse it in `parseCatalogQuery`. The default behavior (no `stocked` param) should remain `stocked=true` (backward compatible — today's callers get the same feed). Pass the parsed value to `searchCatalog` and `getCatalogDropdown`.

```typescript
// In parseCatalogQuery():
const stockedParam = url.searchParams.get('stocked');
const stockedFilter: boolean | null =
	stockedParam === 'false' ? false : stockedParam === 'all' ? null : true; // default: stocked only
```

Then in `queryCatalogData`, replace `stockedOnly: true` with `stockedOnly: stockedFilter !== false`, or pass the raw boolean through as an optional:

```typescript
// searchCatalog supports stockedOnly?: boolean (false = no filter)
stockedOnly: query.filters.stocked === null ? undefined
           : query.filters.stocked === false ? false
           : true,
```

This lets consumers request:

- `stocked=true` or no param → stocked only (current default)
- `stocked=false` → unstocked/historical items only
- `stocked=all` → full catalog regardless of stocked status

**Option B: Only support `stocked=false` toggle (simpler, narrower)**

Only support the existing behavior plus an opt-out. `stocked=false` disables the stocked filter (returns all items including unstocked). No `stocked=all` concept.

Recommendation: **Option A** — explicit values are self-documenting for API consumers.

### Fix 2: Wire `origin` param in `parseCatalogQuery`

Add `origin?: string` to `ParsedCatalogQuery.filters` and read it from `url.searchParams`. Pass it through to `searchCatalog` (which already has the cross-field `ilike` logic). This is a one-line parser addition and a one-line passthrough in `queryCatalogData`.

```typescript
// In parseCatalogQuery():
filters: {
    ...
    origin: url.searchParams.get('origin') ?? undefined,
    country: url.searchParams.get('country') ?? undefined,
    // ...
}

// In queryCatalogData() → searchCatalog() call:
origin: query.filters.origin,
country: query.filters.country,
```

Note: `origin` and `country` are not mutually exclusive in `searchCatalog` — if both are provided, the DB applies both. This is fine and expected behavior (narrow down to a specific country within a continent-level origin).

---

## Files to Change

| File                                     | Change                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/catalogResource.ts`      | Add `stocked` and `origin` to `ParsedCatalogQuery.filters`; parse them in `parseCatalogQuery()`; pass them to `searchCatalog()` in `queryCatalogData()` |
| `src/lib/docs/content.ts`                | Document `stocked`, `origin`, `country`, `continent` as supported query params in the Catalog API reference section                                     |
| `src/routes/v1/catalog/catalog.test.ts`  | Add test cases for `stocked=false` and `origin=Ethiopia`                                                                                                |
| `src/lib/server/catalogResource.test.ts` | Add test cases for new filter parsing                                                                                                                   |

---

## Acceptance Criteria

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# 1. stocked=false returns 0 items (all public catalog items are stocked)
STOCKED_FALSE=$(curl -s "https://www.purveyors.io/v1/catalog?stocked=false&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pagination']['total'])")
echo "stocked=false total: $STOCKED_FALSE (expect 0)"
[ "$STOCKED_FALSE" = "0" ] && echo "PASS" || echo "FAIL"

# 2. stocked=true (or no param) still returns all stocked items
STOCKED_TRUE=$(curl -s "https://www.purveyors.io/v1/catalog?stocked=true&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pagination']['total'])")
echo "stocked=true total: $STOCKED_TRUE (expect >1000)"

# 3. stocked=all returns more than stocked=true (includes unstocked historical items)
STOCKED_ALL=$(curl -s "https://www.purveyors.io/v1/catalog?stocked=all&limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pagination']['total'])")
echo "stocked=all total: $STOCKED_ALL (expect > $STOCKED_TRUE)"

# 4. origin=Ethiopia returns only Ethiopian coffees (cross-field match)
ORIGIN_ETH=$(curl -s "https://www.purveyors.io/v1/catalog?origin=Ethiopia&limit=5" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
total = d['pagination']['total']
countries = set(i.get('country') for i in d['data'])
wrong = [c for c in countries if c != 'Ethiopia']
print(f'total: {total}, countries: {countries}, wrong: {wrong}')
assert not wrong, f'Non-Ethiopia countries in result: {wrong}'
print('PASS')
")
echo "$ORIGIN_ETH"

# 5. origin=Africa returns multiple African country coffees (continent match)
curl -s "https://www.purveyors.io/v1/catalog?origin=Africa&limit=5" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
continents = set(i.get('continent') for i in d['data'])
print('continents in result:', continents)
assert 'Africa' in continents, 'Africa not found in results'
print('PASS: origin=Africa returns African coffees')
"

# 6. No param backward compat: same count as stocked=true
NO_PARAM=$(curl -s "https://www.purveyors.io/v1/catalog?limit=1" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pagination']['total'])")
[ "$NO_PARAM" = "$STOCKED_TRUE" ] && echo "PASS: backward compat" || echo "FAIL: backward compat broken, $NO_PARAM != $STOCKED_TRUE"
```

---

## Test Plan

1. Run existing catalog tests: `pnpm test -- catalogResource catalog.test`
2. Add unit tests for `parseCatalogQuery` covering `stocked=true`, `stocked=false`, `stocked=all`, `origin=Ethiopia`
3. Smoke test each filter manually with live API key (commands above)
4. Verify no-param requests still return the same feed as today (backward compat)
5. Verify Green tier row limit still applies after filtering (stocked=false + limit check)

---

## Risk Assessment

**Low risk overall.** Both bugs are in the query-parsing layer, not in data access or auth. No schema or DB changes required.

- **Backward compatibility:** The default (no `stocked` param) stays `stockedOnly: true`. Existing callers are unaffected.
- **The `origin` fix** is additive — it enables a param that was previously silently ignored.
- **The `stocked` fix** changes behavior only when `stocked=false` or `stocked=all` is explicitly passed.
- **`searchCatalog` already has the logic** — this is purely a wiring gap in the parser and passthrough.

**One edge case to verify:** When `stocked=all` is requested by an API key principal, the access metadata should accurately reflect `publicOnly: true` remains (doesn't expose private user data). The `publicOnly` constraint is separate from `stockedOnly` and is already enforced in `resolveCatalogAccessContext`.

---

## Out of Scope

- Adding `stocked` or `origin` to the `/api/catalog-api` legacy endpoint (separate plan: `2026-03-30-catalog-api-server-side-filtering.md`)
- Rate-limit header audit (no `X-RateLimit-*` headers are returned on live calls despite docs claiming they exist)
- Adding `stocked` and `origin` to the public docs site query params reference table (should happen alongside this PR but tracked here as a must-have, not a follow-on)
- `score_value` filter exposure (71% null rate makes this low value today; design first)
