# PR 2: Capability-Gated Proof Query Filters

**Date:** 2026-05-04  
**Program:** Catalog Proof Coverage and Query Leverage  
**PR goal:** Add a narrow, validated proof-query surface to `GET /v1/catalog` for member sessions and paid API tiers.

## Why this slice is next

Proof visibility is already public through `include=proof`. Search leverage is different. ADR-005 says public users can inspect the data asset, while members and API customers get the workflows that make decisions faster. Proof filters are exactly that kind of leverage: they let a buyer or agent ask for coffees with trustworthy process, provenance, freshness, or pricing signals.

## In scope

- Add validated proof query params to `/v1/catalog`.
- Gate proof filters behind a catalog capability, likely `canUseProofFilters`.
- Preserve `include=proof` as an independent projection option.
- Ensure proof filtering happens before pagination or otherwise returns truthful totals.
- Update docs with examples and access-level behavior.
- Add route and unit tests for allowed, denied, invalid, and legacy alias behavior.

Suggested v1 query vocabulary:

- `proof_overall=strong|partial|limited|not_available`
- `proof_min_families=1|2|3|4`
- `proof_process=disclosed|partial|not_available`
- `proof_provenance=identified|partial|not_available`
- `proof_freshness=recently_stocked|dated|not_available`
- `proof_pricing=tiered|listed|not_available`

The implementer should ship only labels that can be supported with truthful pagination. It is better to ship fewer proof filters than to filter after pagination and lie about `pagination.total`.

## Out of scope

- Numeric proof scores.
- Saved searches, alerts, exports, or recommendation ranking.
- Raw evidence, certification, compliance, or verified-supplier claims.
- CLI implementation.
- Broad unknown-query rejection across all `/v1/catalog` params. This PR should validate new proof params, not re-litigate the whole query contract.
- Proof coverage endpoint work if PR 1 has not landed.

## Specific files to change

Likely files:

- `src/lib/catalog/proofSummary.ts` if shared proof predicate exports are needed
- `src/lib/catalog/proofQuery.ts`
- `src/lib/catalog/proofQuery.test.ts`
- `src/lib/server/catalogAccess.ts`
- `src/lib/server/catalogAccess.test.ts`
- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/v1/catalog/catalog.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts`
- `src/lib/data/catalog.ts` if query-layer predicates must be pushed into Supabase queries
- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`

## Acceptance criteria

- Supported proof params are explicitly validated. Invalid labels return `HTTP 400` with the existing structured invalid-query shape.
- Anonymous callers cannot use proof filters. They receive a structured `401` or `403` with `requiredCapability: "canUseProofFilters"`.
- API Green cannot use paid proof filters. Member/admin sessions and paid API tiers can.
- `include=proof` remains allowed independently of proof filters.
- Filtering occurs before pagination and produces truthful `pagination.total`, `totalPages`, and row counts.
- `GET /api/catalog-api` preserves canonical behavior through delegation until sunset.
- Docs explain that proof filters are disclosure-quality search tools, not certification or supplier verification.

## Verification commands

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/catalog/proofQuery.test.ts \
  src/lib/server/catalogAccess.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/routes/api/catalog-api/catalog-api.test.ts \
  src/lib/docs/content.test.ts
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&include=proof&limit=10' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '(.data | length > 0) and all(.data[]; .proof.families.process.label == "disclosed")'

curl -sS \
  'https://www.purveyors.io/v1/catalog?proof_min_families=4&include=proof&limit=10' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '(.data | length > 0) and all(.data[]; .proof.overall.families_with_signals >= 4)'

status=$(curl -sS -o /tmp/proof-public-denied.json -w '%{http_code}' \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&limit=10')
test "$status" = 401 -o "$status" = 403
jq -e '.requiredCapability == "canUseProofFilters"' /tmp/proof-public-denied.json
```

## Risks

- Proof labels are currently computed from row data after fetch. Filtering must not be bolted on after pagination.
- If label predicates are duplicated in the data layer, semantics can drift from `createCatalogProofSummary()`. Prefer extracting shared signal logic.
- A single `proof_overall=strong` filter may feel like a quality score. Consider shipping family-specific filters first if wording risk feels high.

## Dependency on prior PRs

Depends on PR #327. Does not strictly require PR 1, but PR 1 should land first so product and docs can explain proof coverage before exposing proof as a search lever.
