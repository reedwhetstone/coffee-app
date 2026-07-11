# PR 1: Catalog proof summary contract

**Date:** 2026-05-01  
**Repo:** coffee-app  
**Branch suggestion:** `feat/catalog-proof-summary`  
**Purpose:** Add a deterministic proof summary contract for catalog rows and compact public CoffeeCard trust badges.

## PR goal

Create the shared proof primitive for the Purveyors Proof Layer. The PR should compute proof summaries from existing catalog fields, expose them through an opt-in catalog API include, document the limitations, and render cautious public trust badges.

## Why this slice comes now

The product has structured process fields, public catalog visibility, access-tier guidance, and a new Proof Layer moonshot. This slice is the smallest independently useful proof-layer implementation because it creates a real web/API data capability without waiting for scraper backfills, supplier claim flows, or legal/compliance positioning.

## In scope

- Add `src/lib/catalog/proofSummary.ts` and unit tests.
- Compute proof families for process, provenance, freshness, and pricing.
- Add an opt-in `include=proof` query path to `GET /v1/catalog`.
- Add explicit validation for `include` so unsupported include values return structured `400` errors instead of silent no-ops.
- Preserve default `/v1/catalog` response shape.
- Withhold raw `processing_evidence` and supplier quote text.
- Add compact CoffeeCard trust badges when reliable signals exist.
- Update docs for the API include and buyer-facing badge language.
- Add tests for null semantics, evidence withholding, response shape, and CoffeeCard rendering.

## Out of scope

- Database migrations or new columns.
- Claim-quality filtering, sorting, saved searches, alerts, exports, or paid proof search.
- Supplier verification, claim flows, or direct-feed publishing.
- Compliance or certification language.
- Scraper backgeneration.
- CLI changes.

## Files to change

- `src/lib/catalog/proofSummary.ts`
- `src/lib/catalog/proofSummary.test.ts`
- `src/lib/catalog/catalogResourceItem.ts`
- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/v1/catalog/catalog.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts` if alias coverage is needed
- `src/lib/components/CoffeeCard.svelte`
- `src/lib/components/CoffeeCard.svelte.test.ts`
- `src/lib/docs/content.ts`

## Acceptance criteria

- `GET /v1/catalog?include=proof&limit=5` returns proof summaries in the canonical envelope.
- `GET /v1/catalog?limit=5` remains unchanged unless the caller opts in.
- `GET /v1/catalog?include=wat&limit=5` returns a structured `400`, protecting agent/developer trust from silent unsupported-parameter success.
- Proof summaries include process, provenance, freshness, and pricing families.
- Proof summaries include explicit limitations such as `not_certification` and `raw_evidence_not_included`.
- Raw `processing_evidence` is not exposed.
- CoffeeCards render proof badges only when the helper identifies reliable signals.
- Tests prove missing data does not become false negative proof.
- Docs avoid words like verified, certified, or compliant unless they are explicitly negated.

## Test plan

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/lib/components/CoffeeCard.svelte.test.ts

API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)
curl -sS 'https://www.purveyors.io/v1/catalog?include=proof&limit=5' \
  -H "Authorization: Bearer $API_KEY" | jq -e '(.data | length > 0) and all(.data[]; has("proof"))'
status=$(curl -sS -o /tmp/proof-include-error.json -w '%{http_code}' \
  'https://www.purveyors.io/v1/catalog?include=wat&limit=5' \
  -H "Authorization: Bearer $API_KEY")
test "$status" = 400
```

## Risks

- A numeric score may look more authoritative than the data supports. Prefer labels unless the formula is transparent.
- Public proof badges may read like supplier verification. Keep copy cautious and evidence-family based.
- Existing catalog contract tests may need careful fixture updates if `include=proof` touches shared mappers.

## Exact follow-on dependency

PR 2 depends on this proof contract. The CLI should consume the API proof summary rather than reimplementing scoring locally.
