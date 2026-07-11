# PR 1: Price Index V1 Endpoint

**Date:** 2026-04-29  
**Repo:** coffee-app  
**Branch suggestion:** `feat/v1-price-index-endpoint`  
**Purpose:** Add a stable read-only `/v1/price-index` endpoint backed by existing Parchment Intelligence aggregate data.

## PR goal

Create the first external machine-readable Parchment Intelligence contract. The endpoint should expose aggregate price-index snapshots from `price_index_snapshots` with clear auth, entitlement, validation, pagination, and response-shape tests.

## Why this slice comes now

The data foundation, entitlement field, billing product, and analytics UI already exist. The missing piece is a stable API contract. This PR is independently mergeable because curl/API consumers can use the endpoint directly even if no CLI command or conversion-copy follow-up ever lands.

## In scope

- Add `GET /v1/price-index`.
- Require API-key authentication.
- Require Parchment Intelligence access via `principal.ppiAccess`.
- Query `price_index_snapshots` only.
- Validate `origin`, `process`, `grade`, `from`, `to`, `wholesale`, `page`, and `limit`.
- Return deterministic pagination and a canonical envelope.
- Include supplier count, sample size, aggregation tier, and price summary fields.
- Add route/resource tests.
- Add minimal docs route-matrix coverage.

## Out of scope

- CLI changes.
- CSV export.
- Webhooks, alerts, watchlists, or saved searches.
- New migrations.
- Analytics page refactors.
- New billing products or price changes.
- Supplier-level raw rows.

## Files to change

- `src/routes/v1/price-index/+server.ts`
- `src/routes/v1/price-index/price-index.test.ts`
- `src/lib/server/priceIndexResource.ts`
- `src/lib/docs/content.ts`
- Potentially `src/lib/server/auth.ts` for a small named `requireParchmentIntelligenceApiAccess` helper
- Potentially `src/lib/server/apiAuth.ts` if usage logging needs a resource label beyond catalog

## Acceptance criteria

- `GET /v1/price-index` succeeds for a valid API-key principal with `ppiAccess: true`.
- Missing or invalid auth returns `401`.
- Valid API key without Parchment Intelligence returns `403`.
- Invalid query params return `400` with useful messages.
- Pagination is deterministic and tested.
- Response includes `meta.resource = "price-index"` and `meta.namespace = "/v1/price-index"`.
- The endpoint does not expose supplier-level rows or raw evidence.
- Docs mention the route without overclaiming CSV, alerts, or webhook support.

## Test plan

- Focused route tests for success and auth failure cases.
- Query validation tests for dates, limit/page, and wholesale.
- Snapshot/contract-style assertion for the response envelope.
- `pnpm check`.
- Focused vitest command for new tests and existing v1 route tests.

## Risks

- Existing API keys may not have a dedicated `price-index:read` scope. Avoid requiring a new scope in this slice unless the API-key creation path is updated at the same time.
- Entitlement and API-plan language can drift. Keep `apiPlan` and `ppiAccess` separate in response metadata.
- Historical synthetic backfill rows can confuse consumers. Preserve `aggregation_tier` and sample metadata in the response.

## Exact follow-on dependency

PR 2 depends on this route contract. The CLI should not ship until this endpoint is merged or otherwise stable enough to test against.
