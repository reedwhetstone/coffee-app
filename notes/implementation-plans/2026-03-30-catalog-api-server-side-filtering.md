# Implementation Plan: Server-Side Filtering for /api/catalog-api

**Date:** 2026-03-30
**Slug:** catalog-api-server-side-filtering
**Status:** Planning only — awaiting Reed approval before coding
**Repo:** coffee-app
**Focus Area:** Platform gaps / API consumer UX

---

## Problem

`/api/catalog-api` ignores every query parameter passed by callers. Confirmed live:

```bash
# stocked=true — returns 460 non-stocked items anyway
curl 'https://www.purveyors.io/api/catalog-api?stocked=true' -H "Authorization: Bearer $KEY"
# → total: 1000, non-stocked in result: 460

# origin=Ethiopia — returns all 1000 items across all countries
curl 'https://www.purveyors.io/api/catalog-api?origin=Ethiopia' -H "Authorization: Bearer $KEY"
# → Countries in first 3 items: ['Zambia', None, 'Malawi']

# limit=5 — returns all 1000 items
curl 'https://www.purveyors.io/api/catalog-api?limit=5' -H "Authorization: Bearer $KEY"
# → items returned: 1000

# page=2 — still returns same 1000 items from page 1
curl 'https://www.purveyors.io/api/catalog-api?page=2&limit=5' -H "Authorization: Bearer $KEY"
# → items returned: 1000
```

**Root cause:** `buildLegacyExternalCatalogResponse` in `catalogResource.ts` fetches all public rows into an in-memory cache and applies only the tier row limit. It reads no query params. The entire request URL is ignored after auth checks.

**Contrast with `/v1/catalog`:** The canonical endpoint properly parses `country=`, `continent=`, `region=`, `stocked=`, `processing=`, `page=`, `limit=` and others — it just isn't exposed in the public docs or used by the external API.

---

## Impact

Every external API consumer is currently forced to:

1. Download 1000+ rows on every call
2. Filter client-side in their own code
3. Re-download the full set to check for stocked-only items

This wastes bandwidth, bumps against monthly request quotas faster than needed, and creates a terrible developer experience. The filters exist on the server (via `buildCanonicalCatalogResponse`) — they're just not wired to the external endpoint.

Severity: **High for API consumer adoption.** The docs say "Filter and search on your side after fetching" — which works but is an intentional limitation that makes the API notably less competitive vs. similar data feeds.

---

## Proposed Fix

Wire a minimal set of practical filter params to `/api/catalog-api` using the same `buildCanonicalCatalogResponse` path already used by `/v1/catalog`, replacing the hand-rolled `buildLegacyExternalCatalogResponse`.

### Params to support (Phase 1 — low risk):

| Param | Type | Behavior |
|-------|------|----------|
| `stocked` | `true` / `false` | Filter by stocked status (boolean) |
| `country` | string | Exact match on `country` field (already supported in canonical path) |
| `continent` | string | Exact match on `continent` field (already supported) |
| `page` | integer | Page number for pagination |
| `limit` | integer | Items per page (capped at tier row limit) |

The `origin` partial match (cross-field across country + continent + region) is a Phase 2 item — it requires a new filter in the DB query since the canonical path only supports separate `country`, `continent`, `region` params today.

### Files to change

**`src/routes/api/catalog-api/+server.ts`**
- Replace `buildLegacyExternalCatalogResponse` call with `buildCanonicalCatalogResponse`
- The canonical path already handles auth, rate limiting, tier limits, and proper pagination

**`src/lib/server/catalogResource.ts` — `buildLegacyExternalCatalogResponse`**
- Keep function for backward compat but mark deprecated
- Alternatively: extract shared auth+rate-limit logic so both paths use it cleanly

**`src/lib/docs/content.ts`**
- Update the Catalog API docs section to document the new query params
- Remove the "Filter and search on your side" copy once server-side filtering is live
- Add a query params table with supported filters

### Response envelope change
The canonical path returns `{ data, meta, pagination }` while the legacy endpoint returns `{ data, total, total_available, limited, tier, cached, api_version }`. Two options:
- **Option A:** Keep the legacy envelope but add `pagination` alongside it for filtered requests (non-breaking addition)
- **Option B:** Switch to canonical envelope entirely and treat this as a documented breaking change (bump `api_version` to `1.1`)

Recommendation: Option A for the first PR (non-breaking), document Option B as a future v1.1 migration path.

---

## Acceptance Criteria

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# 1. stocked=true returns only stocked items
curl "https://www.purveyors.io/api/catalog-api?stocked=true" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d['data']
non_stocked = [i for i in items if not i.get('stocked')]
assert len(non_stocked) == 0, f'Found {len(non_stocked)} non-stocked items'
print(f'PASS: {len(items)} stocked items, 0 non-stocked')
"

# 2. country=Ethiopia returns only Ethiopian coffees
curl "https://www.purveyors.io/api/catalog-api?country=Ethiopia" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d['data']
wrong = [i for i in items if i.get('country') != 'Ethiopia']
assert len(wrong) == 0, f'Found {len(wrong)} non-Ethiopia items'
print(f'PASS: {len(items)} Ethiopian coffees')
"

# 3. page + limit pagination works
curl "https://www.purveyors.io/api/catalog-api?page=1&limit=10" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert len(d['data']) == 10, f'Expected 10 items, got {len(d[\"data\"])}'
print('PASS: pagination returns correct item count')
"

curl "https://www.purveyors.io/api/catalog-api?page=2&limit=10" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert len(d['data']) == 10, f'Expected 10 items on page 2'
print('PASS: page 2 returns different items')
"

# 4. Combined filter: stocked + country
curl "https://www.purveyors.io/api/catalog-api?stocked=true&country=Colombia" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d['data']
wrong = [i for i in items if not i.get('stocked') or i.get('country') != 'Colombia']
assert len(wrong) == 0
print(f'PASS: {len(items)} stocked Colombian coffees')
"

# 5. Backward compat: existing envelope fields still present
curl "https://www.purveyors.io/api/catalog-api" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for f in ['data', 'total', 'tier', 'api_version']:
    assert f in d, f'Missing field: {f}'
print('PASS: legacy envelope fields preserved')
"
```

---

## Test Plan

1. Run existing catalog API tests: `pnpm test -- catalogResource`
2. Smoke test each filter param manually with the live API key (commands above)
3. Verify that no-param requests still return the same result set as before (backward compat)
4. Verify tier row limits still apply when filtering (Green tier still capped at 25 even with `stocked=true`)
5. Check that `total` and `total_available` reflect filtered counts accurately

---

## Risk Assessment

**Low risk.** The canonical path (`buildCanonicalCatalogResponse`) is already battle-tested by `/v1/catalog`. This is primarily a routing change, not new logic. The main risk is envelope format divergence — mitigated by the Option A approach (extend rather than replace legacy fields).

**Backward compatibility:** Existing callers using no query params get identical behavior (full feed, same fields, same tier limits).

**Side effect:** This also corrects the `total` field in filtered responses — currently `/api/catalog-api` always reports `total: 1000` regardless of filters. After the fix, `total` reflects the filtered set size.

---

## Out of Scope (follow-on)

- `origin` cross-field partial match (requires new DB query logic)
- Exposing `price_tiers`, `price_per_lb`, and `wholesale` in the external feed (these are absent from `CATALOG_API_COLUMNS`)
- Documenting `/v1/catalog` in content.ts (deserves its own PR once the docs restructuring is settled)
- Rate-limit response headers (docs claim `X-RateLimit-*` headers but they're absent from live responses — separate audit item)
