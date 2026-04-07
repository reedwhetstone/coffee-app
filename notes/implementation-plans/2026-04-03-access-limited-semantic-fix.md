# Implementation Plan: Fix `access.limited` Semantic Mismatch

**Date:** 2026-04-03
**Slug:** access-limited-semantic-fix
**Status:** Planning only — awaiting Reed approval before coding
**Repo:** coffee-app
**Focus Area:** API contract correctness / docs accuracy

---

## Problem

`access.limited` in `/v1/catalog` responses conflates two distinct states:
(1) the consumer has hit a **tier row cap** (the intended meaning), and
(2) the current response has **fewer rows than the total** due to ordinary pagination.

This makes the field semantically useless — a paginated consumer on page 1 of 370 sees `limited: true` even when their tier imposes no cap at all. The field was designed to be an upgrade prompt ("you're hitting a tier wall; upgrade for more"), but instead fires on every paginated request.

### Live Evidence

**Authenticated member plan (no tier cap):**

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# page 1 of 370 — data.length (3) < total (1109):
curl -s "https://www.purveyors.io/v1/catalog?page=1&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']; p=d['pagination']
print(f'data: {len(d[\"data\"])}/{p[\"total\"]} (page {p[\"page\"]} of {p[\"totalPages\"]})')
print(f'rowLimit: {a[\"rowLimit\"]}')   # → None
print(f'limited: {a[\"limited\"]}')     # → True  ← WRONG: no tier cap active
"

# last page — data.length (2) < total (1109):
curl -s "https://www.purveyors.io/v1/catalog?page=370&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']; p=d['pagination']
print(f'data: {len(d[\"data\"])}/{p[\"total\"]} (page {p[\"page\"]} of {p[\"totalPages\"]})')
print(f'rowLimit: {a[\"rowLimit\"]}')   # → None
print(f'limited: {a[\"limited\"]}')     # → True  ← WRONG even on final page, no tier cap
print(f'hasNext: {p[\"hasNext\"]}')     # → False  (pagination knows we're done)
"

# Full-country query where data == total — limited finally goes false:
curl -s "https://www.purveyors.io/v1/catalog?country=Papua+New+Guinea&limit=100" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']; p=d['pagination']
print(f'data: {len(d[\"data\"])}/{p[\"total\"]}')
print(f'limited: {a[\"limited\"]}')     # → False (happens to equal total)
"
```

**Summary table:**

| Scenario | data count | total | rowLimit | limited (actual) | limited (correct) |
|---|---|---|---|---|---|
| Member plan, page 1, limit=3 | 3 | 1109 | null | **true** | **false** |
| Member plan, last page, limit=3 | 2 | 1109 | null | **true** | **false** |
| Member plan, PNG full result | 30 | 30 | null | false | false |
| Viewer plan (docs example) | 25 | 814 | 25 | true | true |

The last row shows the intended use: viewer plan has `rowLimit: 25`, and a consumer trying to request more than 25 rows should see `limited: true`. But rows 1-3 show the bug: pagination alone is enough to trigger `limited: true`, even on a plan with no row cap.

### Root Cause (catalogResource.ts)

The `limited` field is computed in `queryCatalogData` at line ~411:

```typescript
// Paginated path:
limited: data.length < totalAvailable,
```

This condition is **always true** when paginating (any page but the last, and even on the last page if `totalAvailable` doesn't divide evenly into exactly 0 remainder). It does not check whether a tier cap is actually responsible.

The correct semantic is: **`limited` should be true only when a tier row cap actively truncated the result set below what the consumer requested.** That condition is:

```
limited = context.rowLimit !== null && totalAvailable > context.rowLimit
```

Or more precisely, limited should only fire when the consumer's tier (`rowLimit`) is the binding constraint — not when pagination alone explains why fewer rows were returned.

### Docs Contract Being Violated

`content.ts` (line 258) shows this example for a viewer plan:

```json
"access": { "publicOnly": true, "rowLimit": 25, "limited": true, "totalAvailable": 814 }
```

This is correct: `rowLimit: 25` and `limited: true` together signal "you're tier-capped." The docs don't describe `limited` as a generic "response is a subset" flag. The intent is clearly a tier-upgrade prompt.

Additionally, `content.ts` line 268 says:
> `limit` — "Rows per page (capped by tier row limit)."

So the docs model `limited` as a tier concept. The code violates this.

---

## Impact

**API consumer confusion:** Any developer reading the docs learns `limited: true` means "you've hit a tier cap, upgrade to get more." When they see `limited: true` on page 1 of 370 with `rowLimit: null`, they correctly conclude the API is broken or the docs are wrong. This undermines trust in the contract.

**Monitoring/alerting gaps:** Consumers building integrations that check `limited` to decide whether to request a tier upgrade will see false positives on every paginated request. The upgrade signal is drowned in noise.

**Severity:** Medium-high. The field exists specifically as a tier signal; making it always fire on pagination means it conveys no useful information to API consumers and actively contradicts the docs.

---

## Proposed Fix

### Fix the `limited` computation in `queryCatalogData`

Replace the current "data subset" check with a "tier-capped" check in both the dropdown and paginated code paths.

**Current code (both paths):**
```typescript
// Dropdown path (catalogResource.ts ~line 340):
limited: context.rowLimit !== null && totalAvailable > data.length,

// Paginated path (catalogResource.ts ~line 411):
limited: data.length < totalAvailable,
```

**Proposed fix:**
```typescript
// Both paths: limited = true only when a tier row cap is the binding constraint
limited: context.rowLimit !== null && totalAvailable > context.rowLimit,
```

This means:
- `rowLimit: null` (no tier cap) → `limited` is always `false` regardless of pagination
- `rowLimit: 25` and `totalAvailable: 814` → `limited: true` (tier cap is binding)
- `rowLimit: 25` and `totalAvailable: 10` → `limited: false` (tier cap is not the binding constraint; all data fits within the cap)

The pagination object's `hasNext` / `hasPrev` / `totalPages` already communicate "there is more data to page through." `limited` does not need to duplicate this. Its job is tier signaling only.

### No doc changes needed for this fix

The docs example already shows the correct semantics (`rowLimit: 25, limited: true`). The fix brings the code into alignment with the existing docs, so no content.ts update is required.

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/server/catalogResource.ts` | Fix `limited` computation in both the dropdown and paginated response paths (~lines 340 and 411) |
| `src/routes/v1/catalog/catalog.test.ts` | Add test: member plan paginated request → `limited: false`; viewer plan request → `limited: true` |
| `src/lib/server/catalogResource.test.ts` | Add unit tests for the `limited` field under both tier-capped and non-capped contexts |

---

## Acceptance Criteria

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# 1. Member plan paginated: limited should be false (no tier cap)
LIMITED=$(curl -s "https://www.purveyors.io/v1/catalog?page=1&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['meta']['access']['limited'])
")
echo "Member paginated limited: $LIMITED (expect false)"
[ "$LIMITED" = "False" ] && echo "PASS" || echo "FAIL"

# 2. rowLimit null + paginated = limited false
ROWLIMIT=$(curl -s "https://www.purveyors.io/v1/catalog?page=1&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['meta']['access']['rowLimit'])
")
echo "rowLimit: $ROWLIMIT (expect None)"

# 3. Last page still limited=false when no tier cap
LIMITED_LAST=$(curl -s "https://www.purveyors.io/v1/catalog?page=370&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['meta']['access']['limited'])
")
echo "Last page limited: $LIMITED_LAST (expect false)"
[ "$LIMITED_LAST" = "False" ] && echo "PASS" || echo "FAIL"

# 4. Anonymous request (no API key) with pagination: limited should be false (no tier cap)
ANON_LIMITED=$(curl -s "https://www.purveyors.io/v1/catalog?page=1&limit=3" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['meta']['access']['limited'])
")
echo "Anonymous paginated limited: $ANON_LIMITED (expect false)"

# 5. Full-result query (PNG): limited still false
PNG_LIMITED=$(curl -s "https://www.purveyors.io/v1/catalog?country=Papua+New+Guinea&limit=100" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['meta']['access']['limited'])
")
echo "Full PNG result limited: $PNG_LIMITED (expect false)"
```

Note: verifying the true-positive case (viewer tier with rowLimit=25 shows limited=true) requires a viewer-plan API key, which the test account doesn't hold. The unit tests in `catalogResource.test.ts` should cover this path with a mocked rowLimit context.

---

## Test Plan

1. Run existing catalog tests: `pnpm test -- catalogResource catalog.test`
2. Add unit tests:
   - `limited` is `false` when `context.rowLimit = null` regardless of data vs totalAvailable
   - `limited` is `true` when `context.rowLimit = 25` and `totalAvailable = 814`
   - `limited` is `false` when `context.rowLimit = 25` and `totalAvailable = 10` (all data fits)
3. Manual smoke tests via acceptance criteria commands above
4. Confirm the dropdown path (`fields=dropdown`) produces consistent results

---

## Risk Assessment

**Very low risk.** This is a single-expression change in two places — no data access changes, no auth changes, no schema changes. The fix tightens the semantic of a metadata field; it does not change which rows are returned.

**Breaking change potential:** Any consumer who was using `limited: true` as a general "more pages exist" signal will see behavior change. This is technically a breaking change in behavior, but: (a) the docs never documented it that way, and (b) `pagination.hasNext` is the correct and documented way to check for more pages. Using `limited` as a pagination signal is a consumer misuse of the field.

**Backward compat for tier-capped users:** Viewer plan consumers see no change — they still get `limited: true` when their rowLimit is the binding constraint.

---

## Out of Scope

- Fixing the `offset` param (confirmed silently ignored; separate plan warranted)
- Fixing `stocked` and `origin` params (covered in `2026-04-02-v1-catalog-missing-filter-params.md`)
- Cache headers (x-vercel-cache: BYPASS on all requests, no cache hits observed; separate investigation)
- The `access.limited` field on the legacy `/api/catalog-api` endpoint (it returns no `meta` block at all)
