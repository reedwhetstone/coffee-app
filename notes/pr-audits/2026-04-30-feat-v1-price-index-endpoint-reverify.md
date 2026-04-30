# PR #312 re-verification audit: feat/v1-price-index-endpoint

**Date:** 2026-04-30  
**Repository:** `/tmp/openclaw-feature-builder-coffee-app--1777572103`  
**Base:** `origin/main`  
**Head:** `HEAD` / `feat/v1-price-index-endpoint`  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/312

## Operator summary

VERDICT: ready  
P0: 0  
P1: 0  
P2: 0  
P3: 0  
NEXT_ACTION: merge

TOP_FIXES:

- None

## Scope reviewed

Required artifacts read from `.verify-pr/20260430T183608Z-feat-v1-price-index-endpoint/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`

Prior verification report read:

- `notes/pr-audits/2026-04-30-feat-v1-price-index-endpoint.md`

Product and decision context read:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/004-processing-transparency-schema-api.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/implementation-plans/2026-04-29-parchment-intelligence-api-cli-bridge-pr-01-price-index-v1-endpoint.md`

Changed implementation files inspected in repo context:

- `src/lib/server/priceIndexResource.ts`
- `src/lib/server/priceIndexResource.test.ts`
- `src/routes/v1/price-index/+server.ts`
- `src/routes/v1/price-index/price-index.test.ts`
- `src/routes/v1/+server.ts`
- `src/routes/v1/v1.test.ts`
- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`

## Verdict

Ready. The prior P1 row-limit pagination defect is fixed and covered by a focused regression test. The implementation remains aligned with the PR intent: it adds a stable read-only `GET /v1/price-index` contract, requires API-key auth and `ppiAccess`, validates query parameters, reads only aggregate `price_index_snapshots` data, returns deterministic pagination, emits the required `meta.resource` and `meta.namespace`, and documents the route without claiming CSV, alerts, webhooks, or raw supplier rows.

Local test execution is still blocked by this worktree's missing `node_modules`, so this reverify is based on source, diff, test inspection, and whitespace checks rather than a successful local Vitest run.

## Re-check of original P1 finding

### Fixed: row-capped API keys now use effective page size for offsets

The previous defect was that the offset was computed from the requested/default limit before applying the API row cap. That made a viewer/Green tier API key with `ppiAccess` skip rows when requesting `page=2&limit=100` under a 25-row cap.

Current behavior in `src/lib/server/priceIndexResource.ts`:

- `buildCanonicalPriceIndexResponse()` parses the request, reads the plan row cap, and computes `effectiveLimit = rowLimit === null ? query.limit : Math.min(query.limit, rowLimit)` at lines 442-445.
- `queryPriceIndexData()` now receives `effectiveLimit` and computes `offset = (query.page - 1) * effectiveLimit` and `end = offset + effectiveLimit - 1` before calling `.range(offset, end)` at lines 344-372.
- Response pagination reports the same `effectiveLimit` at lines 384-390, so the database range and response metadata are consistent.

Regression coverage is present in `src/lib/server/priceIndexResource.test.ts`:

- The existing cap test asserts `limit=100` under `mockGetApiRowLimit.mockReturnValue(25)` calls `.range(0, 24)` and returns `pagination.limit = 25` at lines 288-301.
- The new targeted regression test asserts `page=2&limit=100` under the same cap calls `.range(25, 49)` and returns `page: 2`, `limit: 25`, `totalPages: 10`, `hasNext: true`, and `hasPrev: true` at lines 304-323.

This directly satisfies the expected fix from the first verify report.

## Re-audit against PR intent

### Auth and entitlement

Confirmed. `src/routes/v1/price-index/+server.ts` delegates all GET handling to `buildCanonicalPriceIndexResponse(event, { requestPath: '/v1/price-index' })`. The builder calls `requireApiKeyAccess(event, { requiredPlan: 'viewer', requiredScope: 'catalog:read' })`, so session-only and anonymous callers cannot use this route. It then requires `principal.ppiAccess` before querying data and returns a 403 with `requiredEntitlement: 'ppiAccess'` if the API key lacks Parchment Intelligence access.

Tests cover 401 missing/invalid API-key auth and 403 valid API key without PPI access in `src/lib/server/priceIndexResource.test.ts`.

### Query validation and deterministic pagination

Confirmed. The parser validates `format`, `page`, `limit`, `from`, `to`, `origin`, `process`, `grade`, and `wholesale`, including real calendar-date validation and `from <= to`. Invalid values return a 400 envelope. Pagination is deterministic because the query orders by `snapshot_date`, `origin`, `process`, `grade`, `wholesale_only`, `synthetic`, and `id` before applying the range.

The row-limit bug found in the first verify pass is corrected as described above.

### Aggregate-only data contract

Confirmed. The only data source used by the endpoint is `createAdminClient().from('price_index_snapshots')`. The explicit select list is limited to aggregate snapshot fields: date/origin/process/grade/wholesale bucket, price summary statistics, supplier count, sample size, aggregation tier, synthetic flag, and id for deterministic ordering. The response item shape exposes aggregate price and sample metadata only. It does not expose supplier ids, supplier rows, catalog row ids, evidence text, or raw source records.

### Response envelope

Confirmed. The response includes:

- `meta.resource: "price-index"`
- `meta.namespace: "/v1/price-index"`
- `meta.version: "v1"`
- `meta.auth.kind: "api-key"`
- `meta.auth.ppiAccess: true`
- `meta.source.table: "price_index_snapshots"`
- `meta.source.aggregateOnly: true`

Null handling remains honest for optional `process`, `grade`, and price fields, consistent with ADR-004.

### Docs and product alignment

Confirmed. `/v1` discovery advertises `priceIndex` as live, API-key-only, PPI-required, and backed by aggregate snapshots in `src/routes/v1/+server.ts`. Docs in `src/lib/docs/content.ts` mention `GET /v1/price-index` as an aggregate `price_index_snapshots` contract and explicitly avoid CSV export, alerts, webhooks, watchlists, and supplier-level rows. `src/lib/docs/content.test.ts` includes assertions for those copy boundaries.

This aligns with `notes/PRODUCT_VISION.md` by strengthening the machine-readable API surface and data moat, with ADR-002 by placing new external machine contracts under `/v1`, with ADR-004 by preserving null/provenance boundaries, and with ADR-005 by treating API access and intelligence leverage as paid/server-enforced surfaces.

## Findings

No P0, P1, P2, or P3 findings.

## Validation

- `VALIDATION_PASS`: `git diff --check origin/main...HEAD`
- `VALIDATION_BLOCKED_ENV`: `pnpm test -- --run src/lib/server/priceIndexResource.test.ts src/routes/v1/price-index/price-index.test.ts src/routes/v1/v1.test.ts src/lib/docs/content.test.ts`
  - Blocker: this worktree lacks installed dependencies. The command fails with `sh: 1: vitest: not found` and `WARN Local package.json exists, but node_modules missing, did you mean to install?`.
  - No dependency install was performed.

## Mergeability

The PR is independently mergeable based on source-level re-audit. Normal CI or a dependency-equipped local environment should run the focused Vitest suite before merge, but no code-level blocker remains in this reverify pass.
