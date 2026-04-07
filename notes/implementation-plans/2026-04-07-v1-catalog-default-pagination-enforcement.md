# Implementation Plan: Enforce Default Pagination on /v1/catalog

**Date:** 2026-04-07
**Slug:** v1-catalog-default-pagination-enforcement
**Status:** Implemented (PR #225)
**Focus area:** Performance (response sizes, unnecessary data in responses)

## Problem

The `/v1/catalog` endpoint returns the entire catalog (1,000+ rows, 3.7 MB) when no `page` or `limit` parameter is provided. This affects all consumer types:

| Scenario                             | Rows  | Size   | Latency |
| ------------------------------------ | ----- | ------ | ------- |
| Anonymous, no params                 | 1,000 | 3.7 MB | ~2.7s   |
| API key (member), no params          | 1,000 | 3.7 MB | ~4.6s   |
| API key (member), `limit=25`         | 25    | 94 KB  | ~3.5s   |
| Legacy `/api/catalog-api`, no params | 1,000 | 3.7 MB | ~6.0s   |

**Why this matters for API consumers:**

- Explorer tier users get 200 API calls/month. A single naive request burns one call on a 3.7 MB dump when they probably wanted 25 rows.
- Mobile or bandwidth-constrained consumers pay a steep transfer cost.
- 74% of the payload is text-heavy fields (`description_long` alone is 35%). Consumers wanting structured data (origin, price, score) download massive text blobs they don't need.
- First-time developers hitting the endpoint without reading docs get a multi-megabyte wall of JSON with no pagination metadata; the `pagination` field is literally `null`.
- The documented default `limit` is 15 rows, but that only applies when `page` or `limit` is explicitly provided (`isPaginated` check).

**Live evidence:**

```bash
# No params: full dump, no pagination metadata
curl -s 'https://www.purveyors.io/v1/catalog' \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin)
print(f'Rows: {len(d[\"data\"])}, Pagination: {d[\"pagination\"]}')"
# => Rows: 1000, Pagination: None

# With limit=25: proper pagination
curl -s 'https://www.purveyors.io/v1/catalog?limit=25' \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin)
print(f'Rows: {len(d[\"data\"])}, Pagination: {d[\"pagination\"]}')"
# => Rows: 25, Pagination: {'page': 1, 'limit': 25, 'total': 1133, ...}
```

## Root Cause

In `src/lib/server/catalogResource.ts`, the `queryCatalogData` function has two code paths:

1. **Paginated** (`isPaginated = true`): When `page` or `limit` params are present, server-side `LIMIT`/`OFFSET` is applied.
2. **Unpaginated** (`isPaginated = false`): When neither param is present, `limit: undefined` and `offset: undefined` are passed to `searchCatalog`, which fetches the entire table.

The `isPaginated` flag is only `true` when `url.searchParams.has('page') || url.searchParams.has('limit')`. There is no server-enforced default cap for requests missing both params.

For API-key consumers, the `rowLimit` from `getApiRowLimit()` is `-1` (unlimited) for member/enterprise tiers, so `useRowLimitedPagination` is also `false`. Explorer tier has `rowLimit=25` which does trigger `useRowLimitedPagination`, but only after the full query runs and rows are sliced client-side in the handler.

The internal web app (`/api/catalog` via `buildLegacyAppCatalogResponse`) intentionally uses the full dump for the beans page. This is separate from the external API problem.

## Proposed Fix

### Core change: Always paginate `/v1/catalog`

In `queryCatalogData`, when `isPaginated` is `false` and the request is on the canonical `/v1/catalog` path (not the internal `/api/catalog`), enforce a server-side default pagination:

```
DEFAULT_API_PAGE_LIMIT = 100
```

Specifically, modify `parseCatalogQuery` or `queryCatalogData` to:

1. If neither `page` nor `limit` is provided, default to `page=1, limit=100` and set `isPaginated=true`.
2. This only applies to the external-facing canonical handler (`buildCanonicalCatalogResponse`). The internal `buildLegacyAppCatalogResponse` continues to work as-is.

**Implementation approach:**

Add an `options` parameter to `parseCatalogQuery` or `queryCatalogData` with a `forceDefaultPagination` flag:

```typescript
// In parseCatalogQuery or queryCatalogData:
const DEFAULT_PAGE_LIMIT = 100;

// When forceDefaultPagination is true and no explicit page/limit:
if (options.forceDefaultPagination && !isPaginated) {
	isPaginated = true;
	limit = DEFAULT_PAGE_LIMIT;
	offset = 0;
	page = 1;
}
```

Pass `forceDefaultPagination: true` from `buildCanonicalCatalogResponse` and `false` (or omit) from `buildLegacyAppCatalogResponse`.

### Files to change

1. **`src/lib/server/catalogResource.ts`**

   - Add `DEFAULT_API_PAGE_LIMIT` constant (100 rows)
   - Add `forceDefaultPagination` option to the query/context pipeline
   - In `queryCatalogData`, apply default pagination when flag is set and no explicit pagination params exist
   - `buildCanonicalCatalogResponse` passes `forceDefaultPagination: true`
   - `buildLegacyAppCatalogResponse` passes `forceDefaultPagination: false` (preserving internal behavior)

2. **`src/lib/docs/content.ts`**

   - Update the "Query parameters" table: change `limit` default from `'15'` to `'100'` (or clarify: "100 when omitted; 15 is the minimum granularity")
   - Add a note: "Requests without explicit `page` or `limit` parameters are automatically paginated at 100 rows per page."

3. **`src/lib/server/catalogResource.test.ts`**
   - Add test: canonical handler without `page`/`limit` returns paginated response (not full dump)
   - Add test: canonical handler with explicit `limit=500` respects caller's value
   - Add test: legacy app handler without `page`/`limit` still returns full dump (backward compat)

### Why 100 as the default?

- Explorer tier cap is 25 rows, so Explorer users already get paginated via `rowLimit`.
- Member/Enterprise tier users need reasonable bulk access. 100 rows is ~375 KB (vs 3.7 MB for 1000), a 90% reduction.
- 100 is the most common API default (GitHub, Stripe, Shopify all use 100 or lower).
- Consumers who truly need all rows can paginate through with `page=1&limit=100`, `page=2&limit=100`, etc., or explicitly set `limit=1000`.

### What this does NOT change

- `/api/catalog` (internal web app endpoint) continues returning full dumps for the beans page.
- Consumers who explicitly send `limit=1000` still get 1000 rows (respecting tier limits).
- `fields=dropdown` behavior is unchanged (known separate issue: dropdown is ignored for paginated requests).
- No HTTP caching headers are added (separate improvement opportunity).

## Acceptance Criteria

1. `GET /v1/catalog` (no params, with API key) returns paginated response with `pagination` object, max 100 rows.
2. `GET /v1/catalog` (no params, anonymous) returns paginated response with max 100 rows.
3. `GET /v1/catalog?limit=25` still returns 25 rows (explicit limit respected).
4. `GET /v1/catalog?limit=500` returns 500 rows (explicit high limit respected, within tier caps).
5. `GET /api/catalog` (internal) still returns full dump (no pagination object).
6. Response size for default request drops from ~3.7 MB to ~375 KB.
7. Docs reflect the new default behavior.

### Verification commands

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# Should return ~100 rows with pagination metadata
curl -s 'https://www.purveyors.io/v1/catalog' \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin)
print(f'Rows: {len(d[\"data\"])}')
print(f'Pagination: {d[\"pagination\"]}')
assert len(d['data']) <= 100
assert d['pagination'] is not None
assert d['pagination']['limit'] == 100
print('PASS')"

# Explicit limit still respected
curl -s 'https://www.purveyors.io/v1/catalog?limit=50' \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys; d=json.load(sys.stdin)
assert len(d['data']) == 50
assert d['pagination']['limit'] == 50
print('PASS')"

# Anonymous also gets default pagination
curl -s 'https://www.purveyors.io/v1/catalog' | python3 -c "
import json, sys; d=json.load(sys.stdin)
assert len(d['data']) <= 100
assert d['pagination'] is not None
print('PASS')"
```

## Test Plan

- Unit tests in `catalogResource.test.ts` covering the three scenarios above
- Manual curl tests against deployed preview URL
- Verify CLI (`purvey catalog search`) still works correctly (CLI sends explicit params)
- Verify the web app beans page loads normally (uses `/api/catalog`, not `/v1/catalog`)

## Risk Assessment

**Risk: LOW**

- The internal web app is completely unaffected (different code path via `buildLegacyAppCatalogResponse`).
- The CLI already sends explicit `limit` params, so it's unaffected.
- API consumers who currently omit params will get different (better) behavior: paginated results instead of a multi-megabyte dump. This is technically a breaking change for any integration that expects `pagination: null` and all rows in one call, but the improvement is clearly beneficial and the old behavior was undocumented as intentional.
- The legacy `/api/catalog-api` endpoint delegates to `buildCanonicalCatalogResponse`, so it also gets the fix. This is desirable since it's the external-facing endpoint.
- Mitigation: consumers can restore the old behavior by explicitly passing `limit=1000`.

## Strategy Alignment Audit

- **Canonical direction:** Directly serves "A stable v1 API that external developers and agents can build against" (PRODUCT_VISION.md near-term bets). An API that dumps 3.7 MB by default is not stable; it's a footgun. Default pagination is table-stakes for any production API.
- **API-first contribution:** This improves the shared platform for all external consumers (developers, agents, CLI). The fix lives in the canonical resource handler, benefiting `/v1/catalog` and `/api/catalog-api` simultaneously. Per ADR-002, both paths should behave consistently for external consumers.
- **Public value legibility:** A developer's first `curl` to the API currently returns a wall of JSON with no pagination metadata. After this fix, they get a clean paginated response with `hasNext: true` and clear total counts. This immediately communicates "this is a well-designed API."
- **Cross-surface consistency:** The CLI already paginates (default `--limit 25`). The web app paginates internally. Only the raw API was missing server-enforced defaults. This brings the API surface in line with the others.
- **Scope discipline:** Intentionally excludes: HTTP cache headers (separate concern), `fields` parameter fixes (the `fields=dropdown` + pagination bug is a separate plan), response compression, and field-level selection/sparse fieldsets. Each of these is a valid follow-up but orthogonal to the pagination enforcement.
