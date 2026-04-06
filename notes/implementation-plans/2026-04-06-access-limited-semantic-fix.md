# Implementation Plan: Fix `access.limited` Semantic Mismatch

**Date:** 2026-04-06
**Slug:** access-limited-semantic-fix
**Status:** Ready to build — confirmed live on 2026-04-06
**Repo:** coffee-app
**Focus Area:** API contract correctness
**Source:** Parchment API Planner (replaces prior plan from 2026-04-03, same issue confirmed still open)

---

## Problem

`access.limited` in `/v1/catalog` responses fires on every paginated request, even when no tier row cap is active. This contradicts the documented contract and misleads API consumers.

**Intended meaning:** `limited: true` means your tier's row cap truncated the response. This is the upgrade prompt signal.

**Actual behavior:** `limited: true` means `data.length < totalAvailable`, which is always true when paginating.

### Live Evidence (2026-04-06)

```
GET /v1/catalog?page=1&limit=3
→ data: 3/1137  page 1 of 379  rowLimit: null  limited: true  ← WRONG (no tier cap)

GET /v1/catalog?page=228&limit=5
→ data: 2/1137  page 228 of 228  rowLimit: null  limited: true  ← WRONG (final page, no cap)

GET /v1/catalog?limit=1&page=1 (unauthenticated)
→ data: 1/1137  rowLimit: null  limited: true  ← WRONG (no tier applied)
```

A consumer checking `limited` to decide whether to request a tier upgrade sees constant false positives on every paginated call. The signal conveys no useful information in its current form.

### Root Cause (catalogResource.ts, line ~412)

```typescript
// Paginated code path:
limited: data.length < totalAvailable,
```

This condition is always true when `data.length < total` — i.e., any paginated request that doesn't return every row. It does not check whether a tier cap is actually responsible.

The dropdown path (line ~340) is correct:
```typescript
limited: context.rowLimit !== null && totalAvailable > data.length,
```

The paginated path needs the same fix.

---

## Proposed Fix

Replace the paginated-path `limited` computation with the same tier-cap check used in the dropdown path.

**File:** `src/lib/server/catalogResource.ts`

**Current (line ~412):**
```typescript
limited: data.length < totalAvailable,
```

**Proposed:**
```typescript
limited: context.rowLimit !== null && totalAvailable > context.rowLimit,
```

**Semantics after fix:**
- `rowLimit: null` → `limited: false` always (no tier cap active)
- `rowLimit: 25`, `totalAvailable: 814` → `limited: true` (tier cap is binding, upgrade prompt valid)
- `rowLimit: 25`, `totalAvailable: 10` → `limited: false` (tier cap exists but all data fits within it)

The `pagination.hasNext` / `totalPages` already signals "there is more to page through." `limited` should not duplicate this; it is a tier signal only.

---

## No Docs Changes Needed

`content.ts` already shows the correct semantics in its example (line ~258):

```json
"access": { "publicOnly": true, "rowLimit": 25, "limited": true, "totalAvailable": 814 }
```

The fix brings code into alignment with the existing documented contract.

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/server/catalogResource.ts` | Fix `limited` in the paginated response path (~line 412) |
| `src/routes/v1/catalog/catalog.test.ts` | Add tests: member plan paginated → `limited: false`; no-cap paginated → `limited: false` |
| `src/lib/server/catalogResource.test.ts` | Add unit tests for `limited` under tier-capped vs non-capped contexts |

Total files: 3 (1 source, 2 test). Minimal blast radius.

---

## Acceptance Criteria

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# 1. Member plan, paginated: limited must be false (no tier cap)
curl -s "https://www.purveyors.io/v1/catalog?page=1&limit=3" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']
assert a['rowLimit'] is None, 'rowLimit should be null for member plan'
assert a['limited'] == False, f'limited should be false, got {a[\"limited\"]}'
print('PASS: member plan paginated → limited=false')
"

# 2. Last page: limited must still be false when no tier cap
curl -s "https://www.purveyors.io/v1/catalog?page=228&limit=5" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']
assert a['limited'] == False, f'limited should be false on last page, got {a[\"limited\"]}'
print('PASS: last page → limited=false')
"

# 3. Full-result query: limited stays false (total fits, no cap)
curl -s "https://www.purveyors.io/v1/catalog?country=Papua+New+Guinea&limit=100" \
  -H "Authorization: Bearer $API_KEY" | python3 -c "
import json,sys; d=json.load(sys.stdin)
a=d['meta']['access']
assert a['limited'] == False, 'full-result should still be false'
print('PASS: full-result query → limited=false')
"
```

---

## Test Plan

**Unit (catalogResource.test.ts):**
- `rowLimit: null` + paginated context → `limited: false`
- `rowLimit: 25` + `totalAvailable: 814` → `limited: true`
- `rowLimit: 25` + `totalAvailable: 10` → `limited: false`

**Integration (catalog.test.ts):**
- Mock member-plan context with `rowLimit: null`: paginated response → `limited: false`
- Mock viewer-plan context with `rowLimit: 25`: response → `limited: true`

**Live validation:** The three curl commands above.

**CI:** `pnpm vitest run` + `pnpm lint` + `pnpm check`

---

## Risk Assessment

**Risk: Very Low**

- Single-line change to one field in one file
- No DB changes, no auth surface, no new routes
- The dropdown path already uses this logic correctly — this is a consistency fix
- No behavior change for non-paginated requests
- Rollback: `git revert` the PR, no state to undo

---

## History

This issue was first documented in plan `2026-04-03-access-limited-semantic-fix.md`. Confirmed still open on 2026-04-06 with fresh live API tests. Ready to implement.
