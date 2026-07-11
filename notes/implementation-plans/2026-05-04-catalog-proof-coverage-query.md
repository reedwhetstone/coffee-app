# Catalog Proof Coverage and Query Leverage

**Date:** 2026-05-04  
**Planning mode:** Planning only, no code changes in this PR  
**Selected program:** Turn the shipped catalog proof summaries into a measurable API intelligence surface, then add paid proof-query leverage without overexposing anonymous search power.  
**Recommended shape:** Two independently mergeable PRs in order.  
**Recommended first PR:** PR 1, proof coverage endpoint.

## Feature or program

Build the next Parchment API proving slice for the Purveyors Proof Layer:

1. **Proof coverage endpoint:** add a canonical coverage endpoint, proposed as `GET /v1/catalog/proof-coverage`, that returns aggregate proof-summary distributions and gap counts across the catalog without raw supplier evidence.
2. **Proof query leverage:** add capability-gated proof query params to `/v1/catalog` so member sessions and paid API tiers can search for decision-ready trust signals while anonymous and API Green callers can still inspect proof but cannot use it as advanced search leverage.

This extends the proof summary work that merged in PR #327. The first proof slice made claim-family signals visible per coffee. The selected work makes those signals measurable and usable as platform intelligence.

## Why now

- `origin/main` now includes PR #327, `feat/catalog-proof-summary`, so `/v1/catalog?include=proof` is live and additive.
- `notes/PRODUCT_VISION.md` says Purveyors is a coffee intelligence platform and explicitly prioritizes truthful coffee data, API-first contracts, public value legibility, and access-ladder discipline.
- ADR-004 says process transparency must preserve nulls and avoid overstating supplier metadata.
- ADR-005 says catalog data visibility and search leverage are different products: public surfaces can prove value, while member/API tiers should own advanced filtering and operational leverage.
- The 2026-04-30 Proof Layer moonshot now has a real seed contract. The next useful proving slice is not more badges; it is a measurable proof-quality surface and a gated query contract that buyers and agents can act on.

## Live API evidence, 2026-05-04

Commands used the live `PURVEYORS_API_KEY` from `~/.env`; the key value was not written into this plan.

- `GET /v1/catalog?limit=5` with API-key auth returned `HTTP 200`, `pagination.total = 1059`, `meta.auth.kind = "api-key"`, `meta.auth.apiPlan = "member"`, and `X-RateLimit-Limit: 10000`. Default rows include `process` but not `proof`.
- `GET /v1/catalog?include=proof&limit=5` returned `HTTP 200` and added `proof.version = "proof-summary-v1"`. The first row had `overall.label = "strong"`, four proof families, and limitations including `not_certification`, `raw_evidence_not_included`, and `supplier_verification_not_performed`.
- The same `include=proof` request did not expose raw evidence fields in the sampled response body.
- `GET /v1/catalog?include=proof,wat&limit=2` returned `HTTP 400` with a structured invalid-query response, proving the include contract now fails closed.
- `GET /api/catalog-api?include=proof&limit=2` returned `HTTP 200`, included proof summaries, and preserved `Deprecation: true`, `Link: </v1/catalog>; rel="successor-version"`, and `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`.
- Anonymous `GET /v1/catalog?include=proof&limit=2` returned `HTTP 200` with proof summaries. `Authorization: Bearer not-a-real-key` returned `HTTP 401`.
- The first 100 live proof rows showed meaningful coverage variation: overall `strong = 60`, `partial = 40`; process `disclosed = 32`, `partial = 28`, `not_available = 40`; provenance `identified = 81`, `partial = 19`; freshness `recently_stocked = 100`; pricing `tiered = 57`, `listed = 43`.
- Proposed coverage routes are absent today: `GET /v1/catalog/proof-coverage`, `/v1/catalog/proof`, and `/v1/proof-coverage` all returned `HTTP 404` HTML pages.
- Candidate proof query params are absent today and silently ignored: `proof_family=process`, `proof_label=disclosed`, and `min_proof_score=0.7` each returned unfiltered `total = 1059` and no proof object unless `include=proof` was also requested.
- `GET /v1/catalog?include=proof&fields=summary&limit=3` returned `HTTP 400` because `fields=summary` is not live; this reinforces that proof coverage should not depend on the older summary-projection plan.
- The installed global CLI is `purvey 0.14.0`; `purvey auth status` reports unauthenticated and `purvey catalog stats` exits with `AUTH_ERROR`. That is not a blocker for the API work, but it reinforces the value of HTTP-first proof contracts for agent workflows.

## Problem description

Purveyors now has per-row proof summaries, but the Parchment API cannot answer catalog-level proof questions yet:

- What share of the catalog has strong versus partial proof?
- Which proof families are weakest by source, origin, or stocked state?
- How many rows lack process disclosure but have strong pricing and freshness signals?
- Can an API consumer ask for coffees with process proof present, provenance identified, and freshness dated?

Today, an agent has to fetch rows with `include=proof`, compute its own aggregate distribution, and guess at unsupported proof filters. That is workable for a small internal script, but it is not a trustworthy platform contract.

## Root cause analysis

The current proof helper is row-local. `createCatalogProofSummary()` converts one catalog item into proof families and badges after the catalog query returns. That was the right first slice because it was additive and safe. The limitation is that the API has no first-class proof aggregate or proof query model:

- Aggregation is caller-owned, so docs, CLI, agents, and internal audits can drift.
- Query semantics are undefined, so plausible params like `proof_label=disclosed` silently no-op.
- Proof search leverage is not tied to ADR-005 capabilities yet.
- Future scraper and product decisions lack a stable API metric for whether proof quality is improving.

## Proposed program

### PR 1: Proof coverage endpoint

Add a canonical aggregate endpoint, proposed as `GET /v1/catalog/proof-coverage`, backed by the existing catalog proof helper. It should return proof-label distributions, family distributions, signal counts, and top missing families for the current visible catalog scope.

Suggested response shape:

```json
{
	"resource": "catalog-proof-coverage",
	"namespace": "/v1/catalog/proof-coverage",
	"version": "v1",
	"generated_at": "2026-05-04T16:00:00.000Z",
	"scope": {
		"auth": { "kind": "api-key", "apiPlan": "member" },
		"filters": { "stocked": true, "country": "Ethiopia" },
		"total_rows": 137
	},
	"overall": [
		{ "label": "strong", "count": 83, "share": 0.606 },
		{ "label": "partial", "count": 54, "share": 0.394 }
	],
	"families": {
		"process": [
			{ "label": "disclosed", "count": 44, "share": 0.321 },
			{ "label": "partial", "count": 39, "share": 0.285 },
			{ "label": "not_available", "count": 54, "share": 0.394 }
		],
		"provenance": [],
		"freshness": [],
		"pricing": []
	},
	"signals": {
		"process.base_method": 44,
		"freshness.stocked_date": 137,
		"pricing.price_tiers": 79
	},
	"top_gaps": [{ "family": "process", "label": "not_available", "count": 54 }],
	"limitations": ["not_certification", "raw_evidence_not_included"]
}
```

The endpoint should accept only the existing safe catalog filters that already preserve visibility and capability rules. It should not expose raw supplier quotes, row-level evidence, compliance language, supplier rankings, or premium proof filters in PR 1.

### PR 2: Capability-gated proof query params

Add proof query params to `/v1/catalog` after the coverage contract exists:

- `proof_overall=strong|partial|limited|not_available`
- `proof_min_families=1..4`
- `proof_process=disclosed|partial|not_available`
- `proof_provenance=identified|partial|not_available`
- `proof_freshness=recently_stocked|dated|not_available`
- `proof_pricing=tiered|listed|not_available`

These params should be advanced search leverage. Per ADR-005, anonymous callers and API Green should not get the full proof-query surface. They can still inspect proof summaries with `include=proof`; they just cannot use proof as a decision-speed search primitive unless their session or API plan has the capability.

Implementation should avoid post-pagination filtering. If a proof label cannot be represented with truthful pagination over existing columns, exclude that filter from v1 rather than shipping misleading totals. Prefer a shared proof predicate module that both the proof helper and query layer can use, so label semantics do not fork.

## Scope in and out

### In scope

- `GET /v1/catalog/proof-coverage` or a similarly canonical v1 proof coverage route.
- Coverage aggregates over existing catalog rows and existing proof-summary logic.
- Optional reuse of existing catalog filters such as `country`, `source`, `stocked`, `processing_base_method`, and `processing_confidence_min` where capability rules already exist.
- Docs for the new endpoint, limitations, and example agent use.
- Tests for auth context, rate headers where applicable, null semantics, no raw evidence, and truthful counts.
- A follow-up proof-query contract gated by catalog access capabilities.

### Out of scope

- Raw `processing_evidence` or supplier quote exposure.
- Certification, legal compliance, verified-supplier, EUDR, or audit assurance claims.
- Supplier claim flows or direct-feed publishing.
- Database migrations unless PR 2 proves a minimal generated column is required for truthful pagination.
- CLI implementation in PR 1.
- Saved searches, alerts, exports, watchlists, or recommendation ranking.
- `fields=summary`, because that has its own existing plan and is not required for proof coverage.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                    | Vision | Data moat | Cross-surface | Public/access | Foundation | Total | Feasibility gate                                                                             | Decision |
| -------------------------------------------- | -----: | --------: | ------------: | ------------: | ---------: | ----: | -------------------------------------------------------------------------------------------- | -------- |
| Catalog proof coverage and gated proof query |      5 |         5 |             4 |             3 |          3 |    20 | Medium. PR 1 is straightforward; PR 2 must avoid post-pagination filtering and overexposure. | Selected |
| Parchment Intelligence CLI bridge            |      5 |         4 |             4 |             2 |          2 |    17 | Strong, but already covered by open PR #328 planning docs.                                   | Defer    |
| Proof summary CLI output                     |      5 |         4 |             4 |             2 |          2 |    17 | Already covered by the 2026-05-01 proof summary program; wait for CLI lane.                  | Defer    |
| Process transparency backgeneration          |      5 |         5 |             2 |             1 |          3 |    16 | Mostly coffee-scraper owned; existing plan already tracks it.                                | Defer    |
| V1 catalog summary projection                |      4 |         3 |             4 |             2 |          2 |    15 | Existing 2026-04-28 plan; useful but less tied to today's proof moonshot slice.              | Defer    |
| Unknown query-param validation hardening     |      3 |         2 |             3 |             1 |          2 |    11 | Worth doing, but too broad and mostly contract hygiene.                                      | Defer    |

## Strategy Alignment Audit

- **Canonical direction:** This aligns directly with `notes/PRODUCT_VISION.md`: Purveyors should be a trustworthy coffee intelligence platform with API-first surfaces, not just a browsable catalog. Proof coverage turns existing data quality into explicit decision intelligence.
- **API-first contribution:** The selected work creates a shared HTTP contract for proof coverage and later proof search. Web, CLI, docs, internal agents, and external API consumers can all consume the same proof semantics instead of recomputing them locally.
- **Public value legibility:** PR 1 makes the data moat visible as aggregate proof coverage without exposing raw evidence or giving anonymous users premium search leverage. PR 2 keeps leverage behind member/API capabilities.
- **Cross-surface consistency:** The same proof-family labels can drive API output, docs examples, CoffeeCard badge explanations, CLI summaries, and future agent recommendation constraints.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-30-purveyors-proof-layer.md`. The independently shippable proving slice is a proof coverage endpoint that quantifies process, provenance, freshness, and pricing evidence quality across the catalog, followed by a gated proof-query contract. This is smaller than full disclosure passports but directly tests whether proof quality is useful as platform infrastructure.
- **Scope discipline:** This excludes supplier verification, direct feeds, compliance claims, raw evidence exposure, saved searches, alerts, and CLI implementation. It also excludes the older `fields=summary` projection plan so the proof work stays independently mergeable.

## Acceptance criteria

### Program-level

- Parchment can answer catalog-level proof coverage questions through a stable v1 contract.
- Proof coverage uses the same family labels and null semantics as `include=proof`.
- Raw supplier evidence remains withheld.
- Public proof visibility and paid search leverage stay separate per ADR-005.
- Unsupported proof query params fail closed once introduced; no new silent no-ops.

### PR 1

- `GET /v1/catalog/proof-coverage` returns a JSON contract with resource, namespace, version, scope, totals, family distributions, signal counts, top gaps, and limitations.
- The endpoint supports API-key auth and preserves rate-limit usage headers for API-key callers.
- The endpoint either supports anonymous requests deliberately as a public aggregate proof surface or documents why API-key auth is required; the decision must be explicit in code and docs.
- Supported filters reuse the existing catalog query parser and capability rules. Process facet filters remain gated exactly as they are for `/v1/catalog`.
- Counts match a local recomputation from `GET /v1/catalog?include=proof` for the same filter scope on a bounded sample or full test fixture.
- Response bodies do not contain raw evidence fields, raw supplier quotes, or certification language.
- `/v1` discovery and docs link to the endpoint.

### PR 2

- `/v1/catalog` accepts a narrow proof-query vocabulary with explicit validation.
- Proof query params require a new or existing capability such as `canUseProofFilters`; anonymous callers receive `401` where authentication is required, and authenticated but insufficient callers receive `403`.
- API Green cannot use paid proof filters. Member/admin sessions and paid API tiers can.
- Pagination totals remain truthful. No proof filter may be applied after pagination unless the implementation also produces correct totals.
- `include=proof` remains separate from proof filters: callers may filter without including proof, or include proof without filtering.
- Legacy `/api/catalog-api` either supports the same canonical behavior through delegation or explicitly documents unsupported behavior before sunset.

## Verification commands

### Current live evidence commands

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/v1-proof.headers \
  'https://www.purveyors.io/v1/catalog?include=proof&limit=5' \
  -H "Authorization: Bearer $API_KEY" | jq '.data[0].proof'

curl -sS -o /tmp/proof-coverage.html -w '%{http_code}\n' \
  'https://www.purveyors.io/v1/catalog/proof-coverage' \
  -H "Authorization: Bearer $API_KEY"

curl -sS \
  'https://www.purveyors.io/v1/catalog?include=proof&limit=100' \
  -H "Authorization: Bearer $API_KEY" \
  | jq '.data | group_by(.proof.overall.label) | map({label: .[0].proof.overall.label, count: length})'
```

### PR 1 local validation

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/routes/v1/catalog/proof-coverage/proof-coverage.test.ts \
  src/routes/v1/v1.test.ts \
  src/lib/docs/content.test.ts
```

### PR 1 live smoke after deploy

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/proof-coverage.headers \
  'https://www.purveyors.io/v1/catalog/proof-coverage?stocked=true' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '.resource == "catalog-proof-coverage" and .families.process and .limitations'

grep -Ei '^x-ratelimit-' /tmp/proof-coverage.headers
```

### PR 2 local validation

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/catalog/proofQuery.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/routes/api/catalog-api/catalog-api.test.ts \
  src/lib/server/catalogAccess.test.ts \
  src/lib/docs/content.test.ts
```

### PR 2 live smoke after deploy

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&include=proof&limit=10' \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '(.data | length > 0) and all(.data[]; .proof.families.process.label == "disclosed")'

status=$(curl -sS -o /tmp/proof-public-denied.json -w '%{http_code}' \
  'https://www.purveyors.io/v1/catalog?proof_process=disclosed&limit=10')
test "$status" = 401 -o "$status" = 403
jq -e '.requiredCapability' /tmp/proof-public-denied.json
```

## Risk assessment

- **Risk: Proof coverage becomes a fake certification metric.** Mitigation: keep limitation strings in every response and use cautious wording: coverage, signals, disclosure, not verification.
- **Risk: PR 2 breaks pagination by filtering after the catalog query.** Mitigation: require query-level predicates or defer any label that cannot produce truthful totals.
- **Risk: Query semantics fork from badge semantics.** Mitigation: extract proof signal evaluation into one shared module rather than duplicating label logic in server filters.
- **Risk: Public endpoint gives too much search leverage.** Mitigation: PR 1 returns aggregate coverage only; PR 2 gates row-level proof filters per ADR-005.
- **Risk: Full-catalog aggregation gets slow as supplier coverage grows.** Mitigation: add bounded filters, server-side caching, and clear cache metadata before publicizing the endpoint as high-volume.

## Open questions for Reed

1. Should proof coverage be public as a proof-of-value aggregate, or API-key-only at launch to control cost and keep docs cleaner?
2. Should PR 2 expose `proof_overall` labels, or stay family-specific to avoid a single pseudo-score becoming too authoritative?
3. Should proof coverage group by supplier/source in v1, or avoid source-level comparisons until supplier-politics risk is better understood?
