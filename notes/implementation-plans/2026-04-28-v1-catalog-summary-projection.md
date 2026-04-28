# V1 Catalog Summary Projection

**Date:** 2026-04-28
**Selected improvement:** Add an explicit lean `fields=summary` projection to `GET /v1/catalog`
**Recommended shape:** One atomic coffee-app PR
**Planning mode:** Planning only, no code changes in this PR

## Problem description with live API evidence

The canonical Parchment API catalog contract is stable and behaving correctly, but the current projection choices are too polarized for real integrations:

- `fields=full` is the default public/API listing shape and includes rich long text fields, AI descriptions, farm notes, process notes, price tiers, and compatibility fields.
- `fields=dropdown` is intentionally tiny and only useful for pickers or select menus.
- There is no middle projection for normal catalog browse, agent search, or server-to-server list consumption where callers need enough context to decide but do not need long descriptions or every narrative field.

Live checks against `https://www.purveyors.io` on 2026-04-28:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/v1.headers -o /tmp/v1.json \
  'https://www.purveyors.io/v1/catalog?limit=5' \
  -H "Authorization: Bearer $API_KEY"

curl -sS -D /tmp/dropdown.headers -o /tmp/dropdown.json \
  'https://www.purveyors.io/v1/catalog?fields=dropdown&limit=10&processing_base_method=Natural' \
  -H "Authorization: Bearer $API_KEY"
```

Observed evidence:

- `GET /v1/catalog?limit=5` returned `HTTP 200` with `X-RateLimit-Limit: 10000`, `X-RateLimit-Remaining`, and the canonical `{ data, pagination, meta }` envelope.
- The 5-row canonical response was **33,522 bytes**, about **6.7 KB per row** in that sample.
- `GET /v1/catalog?limit=100` returned **420,669 bytes**, about **4.2 KB per row**, for the default-listing scale.
- The first full row included more than 40 top-level fields: IDs, score, arrival, region, processing, structured process fields, drying method, roast recommendations, lot/bag/packaging fields, cultivar/grade/appearance, short and long descriptions, farm notes, link, price fields, source, stocked state, cupping notes, AI descriptions, public flags, geography, wholesale, and nested `process`.
- `fields=dropdown` returned a tiny reduced shape, but it is too sparse for a consumer deciding whether a coffee is relevant: it omits origin/geography, legacy processing, score, arrival/stocked dates, structured process summary, grade/type/appearance, and link.
- Anonymous `GET /v1/catalog?limit=5` returned `HTTP 200` with the same public payload shape but no rate-limit headers, matching the docs.
- Invalid bearer auth returned `HTTP 401` with `{ "error": "Authentication required" }`, which is correct fail-closed behavior.
- `/api/catalog-api?limit=5` still delegates successfully and returns `Deprecation: true`, `Link: </v1/catalog>; rel="successor-version"`, and `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`.
- Structured process filters are accepted and useful: `GET /v1/catalog?processing_confidence_min=0.8&limit=20` returned `HTTP 200` with `total: 48`; `GET /v1/catalog?processing_disclosure_level=high_detail&limit=10` returned one high-detail row with `process.evidence_available: true`.
- `purvey auth status` in the cron environment reported unauthenticated, so live CLI data comparison was blocked. This is an environment/auth issue, not an API contract failure.

## Root cause analysis

The API has accumulated richer fields for legitimate reasons: price tiers, availability, structured processing, provenance-safe process summaries, AI summaries, and public catalog metadata all matter somewhere. The problem is not that these fields exist. The problem is that the contract only exposes two projection modes:

1. **Full/resource projection:** good for detail pages, deep integrations, and compatibility, but heavy for list/search workloads.
2. **Dropdown projection:** good for selectors, but under-informative for external consumers, agents, and likely future CLI search defaults.

This creates an API-first product gap. Integrators and agents either over-fetch a large response or under-fetch a picker shape that cannot support meaningful decisions. Because default `/v1/catalog` also defaults to 100 rows when page/limit are omitted, the common path can easily return several hundred KB before the caller knows which rows matter.

## Proposed fix

Add an additive `fields=summary` projection for `GET /v1/catalog` and the deprecated `/api/catalog-api` delegating alias.

`fields=summary` should preserve the canonical envelope and pagination behavior while returning a curated decision-ready row shape between full and dropdown.

Suggested summary fields:

- `id`
- `name`
- `source`
- `link`
- `stocked`
- `public_coffee`
- `score_value`
- `arrival_date`
- `stocked_date`
- `country`
- `continent`
- `region`
- `processing`
- `drying_method`
- nested `process` summary, without raw evidence
- `price_per_lb`
- `cost_lb`, retained only as a deprecated compatibility alias while it remains in the public contract
- `price_tiers`
- `type`
- `grade`
- `appearance`
- `cultivar_detail`
- `wholesale`

Intentionally exclude from `summary` unless product evidence says otherwise:

- `description_long`
- `description_short`
- `farm_notes`
- `ai_description`
- `ai_tasting_notes`
- `cupping_notes`
- `roast_recs`
- `lot_size`
- `bag_size`
- `packaging`
- `last_updated`
- `unstocked_date`

Implementation approach:

1. Extend `PUBLIC_CATALOG_FIELD_VALUES` from `['full', 'dropdown']` to include `summary`.
2. Extend `ParsedCatalogQuery.fields` and parse logic to distinguish `summary` from `full` and `dropdown`.
3. Add a `CatalogSummaryItem` type and a `CATALOG_SUMMARY_COLUMNS` data-layer projection.
4. Reuse `toCatalogResourceItem()` or a sibling mapper so `summary` still emits the nested `process` object and withholds raw `processing_evidence`.
5. Keep default `fields=full` unchanged to avoid breaking existing callers.
6. Update docs examples and the fields query-param table.
7. Add tests that prove `summary` is accepted, returns the expected keys, preserves filters/pagination/auth metadata, and rejects unknown `fields` values with the existing structured 400 response.

## Strategy Alignment Audit

- **Canonical direction:** Aligns with `notes/PRODUCT_VISION.md` by improving the stable API contract, reducing waste for machine consumers, and making the shared data layer easier to trust across web, CLI, API, and agent surfaces.
- **API-first contribution:** This improves the platform contract itself rather than adding one-off UI logic. The same projection can serve public API consumers, future CLI defaults, agents, and potentially internal catalog list fetches.
- **Public value legibility:** A lean summary projection makes the catalog easier to inspect, explain, and demo. It shows the data moat clearly without forcing developers to wade through long narrative fields on every list call.
- **Cross-surface consistency:** Web, CLI, and agent surfaces can converge on `fields=summary` for list/search use while reserving `fields=full` for detail contexts and `fields=dropdown` for selectors.
- **Scope discipline:** This plan does not change auth, rate limits, pricing tiers, default full shape, scraper extraction, process taxonomy, cache headers, or CLI commands. It only adds an additive projection and documentation/tests for that projection.

## Candidate scoring summary

Selected candidate: **V1 Catalog Summary Projection**

- User/data impact: high. Reduces over-fetching for the main public API listing path without breaking callers.
- Platform coherence: high. Gives API, CLI, agents, and web list surfaces a shared middle contract.
- Complexity: medium-low. The data layer already has projection plumbing and `fields=dropdown`; this is an additive third field mode.
- Risk: low-medium. Response-shape additions are safe if default `full` remains unchanged, but tests must prevent leaking raw evidence or accidentally changing dropdown/full.
- Strategic leverage: high. This directly supports API-first and agent-first product direction.

Rejected alternatives for this run:

- **Re-plan processing transparency UI/CLI surfacing:** already planned in `2026-04-27-processing-transparency-discovery-funnel.md` and related PR plan docs.
- **Change cache headers:** potentially useful, but cache policy depends on freshness and rate-limit semantics; projection control is the safer first performance win.
- **Fix cron CLI authentication:** operationally useful, but not a Parchment API product improvement and not appropriate as a coffee-app implementation plan.
- **Remove `cost_lb` from public responses:** too breaking. Keep it as a deprecated alias until compatibility policy says otherwise.

## Mergeable-slice gate

This can ship as one independently mergeable PR. If no later CLI or web follow-up ships, the API still becomes more useful and more efficient for external consumers. The default response remains unchanged, so existing integrations are not forced to migrate.

## In scope

- Add `fields=summary` to the public `/v1/catalog` query contract.
- Ensure `/api/catalog-api` inherits the behavior through its existing delegation path.
- Add a typed summary item/projection in the data layer.
- Preserve structured process summary and evidence withholding.
- Preserve existing full and dropdown behavior.
- Update public docs and examples.
- Add focused tests for validation, response shape, pagination, filters, auth metadata, and legacy alias delegation.

## Out of scope

- Changing default `fields=full` behavior.
- Removing or renaming `cost_lb`.
- New cache headers or CDN policy.
- CLI command changes.
- Public catalog UI changes.
- Database migrations.
- Scraper extraction changes.
- Raw process evidence exposure.
- Paid tier or auth behavior changes.

## Specific files likely to change

- `src/lib/catalog/publicQueryContract.ts`
- `src/lib/data/catalog.ts`
- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/v1/catalog/catalog.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts`
- `src/lib/docs/content.ts`
- Potentially README route-contract notes if they mention valid `fields` values

## Acceptance criteria

- `GET /v1/catalog?fields=summary&limit=5` returns `HTTP 200` with the canonical `{ data, pagination, meta }` envelope.
- Summary rows include the curated decision-ready fields and nested `process` summary.
- Summary rows do not include raw `processing_evidence`, `description_long`, `ai_description`, `ai_tasting_notes`, or other intentionally excluded heavy narrative fields.
- `GET /v1/catalog?fields=summary&processing_confidence_min=0.8&limit=5` preserves structured process filters and pagination metadata.
- `GET /api/catalog-api?fields=summary&limit=5` works through the legacy alias and still emits `Deprecation`, `Link`, and `Sunset` headers.
- `GET /v1/catalog?fields=wat` returns the existing structured 400 validation shape with allowed values updated to include `summary`.
- Existing `fields=full`, `fields=dropdown`, default pagination, row-limit, anonymous, invalid-auth, and API-key rate-header behaviors remain unchanged.
- Public docs list `full | summary | dropdown`, explain when each projection should be used, and include one `fields=summary` example.

## Verification commands

Local/code validation:

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/routes/api/catalog-api/catalog-api.test.ts
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -i 'https://www.purveyors.io/v1/catalog?fields=summary&limit=5' \
  -H "Authorization: Bearer $API_KEY"

curl -i 'https://www.purveyors.io/v1/catalog?fields=summary&processing_confidence_min=0.8&limit=5' \
  -H "Authorization: Bearer $API_KEY"

curl -i 'https://www.purveyors.io/api/catalog-api?fields=summary&limit=5' \
  -H "Authorization: Bearer $API_KEY"

curl -i 'https://www.purveyors.io/v1/catalog?fields=wat&limit=5' \
  -H "Authorization: Bearer $API_KEY"
```

Optional response-size check:

```bash
curl -sS 'https://www.purveyors.io/v1/catalog?limit=100' \
  -H "Authorization: Bearer $API_KEY" -o /tmp/full.json
curl -sS 'https://www.purveyors.io/v1/catalog?fields=summary&limit=100' \
  -H "Authorization: Bearer $API_KEY" -o /tmp/summary.json
wc -c /tmp/full.json /tmp/summary.json
```

## Risk assessment

- **Risk: callers misread `summary` as the new default.** Mitigation: docs should explicitly say the default remains `full`; `summary` is opt-in for list/search workloads.
- **Risk: summary accidentally drops a field that agents need.** Mitigation: choose fields based on decision utility, keep `full` available, and treat later additions to `summary` as additive.
- **Risk: raw evidence or heavy narrative fields leak through mapper reuse.** Mitigation: assert excluded keys in tests.
- **Risk: `cost_lb` compatibility confusion continues.** Mitigation: include both `price_per_lb` and deprecated `cost_lb` in summary for now, with docs telling new callers to prefer `price_per_lb`.
- **Risk: too much API surface area.** Mitigation: this is not a new endpoint; it is a narrowly named projection on an existing query param.

## Recommended first PR

Open one coffee-app implementation PR titled roughly:

`feat: add v1 catalog summary projection`

The PR should be code + docs + tests only. It should not change default response behavior or attempt CLI adoption in the same slice.
