# PR 1: Catalog Proof Coverage Endpoint

**Date:** 2026-05-04  
**Program:** Catalog Proof Coverage and Query Leverage  
**PR goal:** Add a canonical `GET /v1/catalog/proof-coverage` endpoint that measures proof-summary distribution and gaps across the visible catalog scope.

## Why this slice is first

The row-level proof summary shipped in PR #327. Before adding proof search leverage, Parchment needs a trustworthy aggregate view of proof coverage. This slice is independently useful even if proof filters never ship: it gives docs, agents, product audits, and scraper follow-ups one shared contract for measuring claim-family quality.

## In scope

- New v1 route, proposed path: `src/routes/v1/catalog/proof-coverage/+server.ts`.
- Route tests for API-key auth, anonymous behavior if supported, filter behavior, rate headers, and evidence withholding.
- Reusable proof coverage aggregator, likely near `src/lib/catalog/proofCoverage.ts` or `src/lib/server/catalogProofCoverage.ts`.
- Aggregates for:
  - overall proof labels
  - process, provenance, freshness, and pricing family labels
  - signal counts
  - top gaps
  - total rows and filter scope
- Existing safe catalog filters where they can be reused without changing semantics.
- Docs update in `src/lib/docs/content.ts` plus docs tests.
- `/v1` discovery update if the endpoint should be discoverable from the root namespace.

## Out of scope

- Row-level proof filters.
- Raw `processing_evidence` or supplier quotes.
- Certification, compliance, verified-supplier, or legal assurance language.
- Supplier/source ranking copy unless Reed explicitly accepts the supplier-politics risk.
- CLI implementation.
- Database migrations.

## Specific files to change

Likely files:

- `src/routes/v1/catalog/proof-coverage/+server.ts`
- `src/routes/v1/catalog/proof-coverage/proof-coverage.test.ts`
- `src/lib/catalog/proofCoverage.ts`
- `src/lib/catalog/proofCoverage.test.ts`
- `src/lib/catalog/proofSummary.ts` only if small shared exports are needed
- `src/lib/server/catalogResource.ts` or a shared catalog query helper, only to avoid duplicated query parsing
- `src/routes/v1/+server.ts`
- `src/routes/v1/v1.test.ts`
- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`

## Acceptance criteria

- `GET /v1/catalog/proof-coverage` returns JSON with `resource`, `namespace`, `version`, `generated_at`, `scope`, `overall`, `families`, `signals`, `top_gaps`, and `limitations`.
- Counts match proof summaries generated from the same visible catalog scope.
- The endpoint preserves API-key rate-limit headers and usage logging.
- The endpoint's anonymous behavior is explicitly chosen and tested. If anonymous is supported, it returns aggregate proof only, not search leverage. If not, it returns a structured auth error.
- Supported filters reuse existing catalog visibility and process-facet capability checks.
- Raw evidence fields and raw supplier quotes are absent from responses.
- Docs state that proof coverage is an informational disclosure metric, not certification or compliance assurance.

## Verification commands

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/catalog/proofCoverage.test.ts \
  src/routes/v1/catalog/proof-coverage/proof-coverage.test.ts \
  src/routes/v1/v1.test.ts \
  src/lib/docs/content.test.ts
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/proof-coverage.headers \
  'https://www.purveyors.io/v1/catalog/proof-coverage?stocked=true' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '.resource == "catalog-proof-coverage" and .families.process and .limitations'

grep -Ei '^x-ratelimit-' /tmp/proof-coverage.headers
```

## Risks

- Aggregating the full catalog could become slow. Use existing row caps, caching, or a bounded aggregation strategy if needed.
- Public aggregate source comparisons could annoy suppliers. Keep source grouping out of v1 unless the product decision is explicit.
- Recomputing proof logic in a new module could fork semantics. Reuse `createCatalogProofSummary()` or extracted shared primitives.

## Dependency on prior PRs

Depends on PR #327 already merged to `origin/main`. Does not depend on proof query filters or CLI proof output.
