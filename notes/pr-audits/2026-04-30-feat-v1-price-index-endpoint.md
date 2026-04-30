# PR #312 verification audit: feat/v1-price-index-endpoint

**Date:** 2026-04-30  
**Repository:** `/tmp/openclaw-feature-builder-coffee-app--1777572103`  
**Base:** `origin/main`  
**Head:** `HEAD` / `feat/v1-price-index-endpoint`  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/312

## Operator summary

VERDICT: ready_with_fixes  
P0: 0  
P1: 1  
P2: 0  
P3: 0  
NEXT_ACTION: patch_same_pr

TOP_FIXES:

- Recompute the database range offset after applying `getApiRowLimit()` so row-capped API keys can page deterministically; add a regression test for `page=2` with a 25-row cap and a larger/default requested limit.

## Scope reviewed

Read required artifacts from `.verify-pr/20260430T182041Z-feat-v1-price-index-endpoint/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`

Read product and decision context:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/004-processing-transparency-schema-api.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/implementation-plans/2026-04-29-parchment-intelligence-api-cli-bridge-pr-01-price-index-v1-endpoint.md`

Changed files inspected in repo context:

- `src/lib/server/priceIndexResource.ts`
- `src/lib/server/priceIndexResource.test.ts`
- `src/routes/v1/price-index/+server.ts`
- `src/routes/v1/price-index/price-index.test.ts`
- `src/routes/v1/+server.ts`
- `src/routes/v1/v1.test.ts`
- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`

## Verdict

The slice is conceptually right and mostly satisfies the endpoint intent: it adds `GET /v1/price-index`, requires API-key auth, gates on `principal.ppiAccess`, reads only `price_index_snapshots`, returns the required `meta.resource` and `meta.namespace`, preserves nulls and synthetic provenance, and docs avoid unsupported CSV, alerts, webhooks, and raw supplier rows.

It is not quite merge-ready because pagination is wrong for valid row-capped API-key principals. Parchment Intelligence is modeled as an add-on that grants `ppiAccess` without necessarily upgrading `apiPlan`, so `viewer` API keys with PPI access are a real reachable case. For those callers, `buildCanonicalPriceIndexResponse()` caps the page size after parsing but leaves the parsed offset based on the uncapped requested/default limit, which skips large windows of rows and violates the deterministic pagination requirement.

## Findings

### P1: Row-capped API keys skip rows because offset is computed before limit capping

**Evidence:** `src/lib/server/priceIndexResource.ts`

- `parsePriceIndexQuery()` computes `offset: (page - 1) * limit` using the requested/default limit.
- `buildCanonicalPriceIndexResponse()` later computes `effectiveLimit = rowLimit === null ? query.limit : Math.min(query.limit, rowLimit)`.
- `queryPriceIndexData()` then uses `dbQuery.range(query.offset, query.offset + effectiveLimit - 1)`.

For a valid PPI principal whose `apiPlan` remains `viewer`, `getApiRowLimit('viewer')` returns 25. Because the endpoint defaults `limit` to 100, a simple `GET /v1/price-index?page=2` produces:

- parsed offset: `(2 - 1) * 100 = 100`
- effective limit: `25`
- database range: `100..124`
- response pagination: `{ page: 2, limit: 25, ... }`

Page 2 should be rows `25..49` when the response advertises `limit: 25`. Rows 26-100 become unreachable unless the caller knows to request `limit=25` explicitly. The same bug occurs for any `limit` above the row cap, for example `page=2&limit=100` or `page=2&limit=50`.

This is not only theoretical: `src/lib/server/billing/catalog.ts` shows Parchment Intelligence add-on products grant `ppiAccess: true` without granting a higher `apiPlan`, so `viewer + ppiAccess` is a plausible paid state.

**Required fix:** compute the effective offset from the effective limit, or defer offset calculation until after row-limit capping. For example, keep `page` and requested `limit` in the parsed query, compute `effectiveLimit`, then use `(query.page - 1) * effectiveLimit` for the database range and pagination. Add a regression test where `mockGetApiRowLimit.mockReturnValue(25)` and `page=2` with omitted/default or `limit=100` expects `.range(25, 49)` and `pagination.limit === 25`.

## Confirmed coverage against intent

### Auth and entitlement

- `src/routes/v1/price-index/+server.ts` delegates to `buildCanonicalPriceIndexResponse()` with canonical `requestPath: '/v1/price-index'`.
- `buildCanonicalPriceIndexResponse()` uses `requireApiKeyAccess(event, { requiredPlan: 'viewer', requiredScope: 'catalog:read' })`, so anonymous/session-only requests become `401` via `AuthError`.
- `principal.ppiAccess` is checked before any data query; false returns `403` with `requiredEntitlement: 'ppiAccess'`.
- Tests cover `401` and `403` cases.

### Query validation

- Validated params: `format`, `page`, `limit`, `from`, `to`, `origin`, `process`, `grade`, `wholesale`.
- Dates use real calendar validation, not regex only.
- `from > to`, empty strings, overlong strings, invalid booleans, unsupported `format`, and over-limit page size are handled as `400`.
- Existing tests cover representative invalid values, including `format=csv`.

### Aggregate-only guarantee

- The only data query is `createAdminClient().from('price_index_snapshots')` with an explicit aggregate-column select.
- The response exposes snapshot-level aggregate fields only: date, origin, process, grade, wholesale flag, price summary, supplier count, listing count, aggregation tier, and synthetic provenance.
- No supplier IDs, raw supplier rows, raw evidence, or catalog row records are returned.

### Response shape and provenance

- `meta.resource` is `price-index`; `meta.namespace` is `/v1/price-index`; `version` is `v1`.
- `process`, `grade`, and price statistics preserve `null` where absent instead of inventing placeholders, aligned with ADR-004's honest-null style.
- Historical synthetic rows are exposed as `provenance.synthetic`.

### Rate limits and usage logging

- Success responses include `X-RateLimit-*` headers.
- `429` includes rate-limit body fields and `Retry-After`.
- Usage logging is present for `200`, `400`, `403` PPI denial, `429`, and `500` when an API key id is known.

### Docs and product alignment

- `/v1` discovery advertises `priceIndex` as API-key-only, PPI-required, and backed by aggregate snapshots.
- API overview and analytics docs mention `/v1/price-index` without claiming CSV, alerts, watchlists, webhooks, or supplier-level raw rows.
- This aligns with PRODUCT_VISION's API-first and data-moat direction and ADR-005's separation between public proof surfaces and paid intelligence leverage.

## Validation

`VALIDATION_BLOCKED_ENV`: attempted focused test command:

```bash
pnpm test -- --run src/lib/server/priceIndexResource.test.ts src/routes/v1/price-index/price-index.test.ts src/routes/v1/v1.test.ts src/lib/docs/content.test.ts
```

It could not run because this worktree lacks installed dependencies:

```text
sh: 1: vitest: not found
WARN Local package.json exists, but node_modules missing, did you mean to install?
```

No install was performed because dependency installation requires explicit approval.

## Mergeability

`ready_with_fixes`. Patch the pagination offset bug in the same PR, add the row-cap pagination regression test, then rerun the focused Vitest suite and `pnpm check` in an environment with dependencies installed.
