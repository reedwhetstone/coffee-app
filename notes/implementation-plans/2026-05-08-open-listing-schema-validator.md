# Open Coffee Listing Schema Validator

**Date:** 2026-05-08  
**Planning mode:** Planning only, no code changes in this PR  
**Selected improvement:** Add a public machine-readable Open Coffee Listing Schema plus an API-key-gated dry-run listing validator.  
**Recommended shape:** One atomic coffee-app PR.  
**Recommended branch:** `feat/open-listing-schema-validator`

## Problem description

Purveyors has a growing canonical consumer surface for normalized coffee intelligence: `/v1/catalog`, `/v1/catalog/:id/similar`, `/v1/price-index`, proof summaries, and the in-flight sourcing-brief API. The missing platform contract is the upstream side of the market: a supplier, agent, or developer cannot ask, "Would this green coffee listing be valid, useful, and mappable into the Purveyors catalog model?"

That gap matters because the product vision is not just a scraped catalog. `notes/PRODUCT_VISION.md` says Purveyors should become a coffee intelligence platform where structured data, API contracts, CLI workflows, and agents converge. The `brain/moonshots/2026-04-09-open-coffee-listing-standard.md` idea is the clearest upstream expression of that strategy: suppliers should eventually publish structured inventory once, and every roaster, app, CLI workflow, and AI agent should be able to discover, compare, and act on it.

Do not jump straight to supplier accounts, feed ingestion, claimed profiles, or direct writes. The safest proving slice is a read-only standard and validator:

1. `GET /v1/listing-schema` exposes the current Open Coffee Listing Schema as JSON Schema plus version metadata.
2. `POST /v1/listings/validate` accepts a single listing or small batch, validates shape and values, and returns errors, warnings, mapping hints, and a normalized preview without storing anything.
3. Docs explain the schema as a compatibility and trust contract, not as a live publishing program.

If this ships and no supplier ever adopts direct feeds, the platform still gains an explicit machine contract for agents, scraper tests, docs examples, and future direct-feed experiments.

## Live API evidence

Commands used the live `PURVEYORS_API_KEY` from `~/.env`; the key value was not written into this plan.

- `GET https://www.purveyors.io/v1` returned `HTTP 200` and advertises only `catalog` and `priceIndex` resources. There is no schema, supplier feed, listing validation, or direct-publish resource in the public namespace.
- `GET https://www.purveyors.io/v1/catalog?limit=3&stocked=true&origin=Ethiopia` with the API key returned `HTTP 200`, `pagination.total = 109`, rate-limit headers including `x-ratelimit-limit: 10000`, and normalized catalog rows with fields such as `country`, `region`, `price_per_lb`, `stocked`, `processing`, `processing_base_method`, and `drying_method`.
- `GET https://www.purveyors.io/v1/catalog?limit=2&include=proof` returned `HTTP 200`, `pagination.total = 1083`, and row-level `proof.version = "proof-summary-v1"` with `process`, `provenance`, `freshness`, and `pricing` families.
- Candidate upstream/schema endpoints all returned `HTTP 404`: `/v1/listings/validate`, `/v1/supplier-listings/validate`, `/v1/catalog/schema`, and `/v1/catalog/open-listing-schema`.
- `GET /v1/procurement/briefs`, `/v1/sourcing-briefs`, `/v1/intents`, and `/v1/catalog/matches` all returned `HTTP 404` on production because PR #354 is open but not yet deployed. This means buyer-intent capture is already actively covered, but the upstream listing-standard path is not.
- Repo search found no active docs for "listing standard", "supplier schema", "supplier feed", "direct feed", or "Open Coffee" under `src/lib/docs/content.ts`; the only clear schema language is in strategy and moonshot notes.
- The local `purvey` CLI is version `0.14.0` and `purvey auth status` reports unauthenticated in this cron environment. That does not block this plan, but it reinforces that public HTTP/API-key contracts are the right first proving slice for developer and agent trust.

## Root cause analysis

The current API is downstream-first:

1. The stable `/v1` namespace exposes normalized catalog and aggregate intelligence for consumers.
2. Scraper and catalog internals know how to normalize supplier data, but there is no public compatibility contract for supplier-authored listings.
3. Existing proof, process, price, and similarity work improves trust after data enters the catalog. It does not help a supplier or external tool know whether a listing is structurally publishable.
4. The Open Coffee Listing Standard moonshot needs a small, falsifiable interface before supplier claim flows or feed ingestion make sense.
5. Without a validator, any future direct-feed pilot would either embed schema expectations in docs prose or jump straight to writes. Both are bad platform moves.

The architectural smell is not that `/v1/catalog` lacks one more query param. The smell is that Purveyors has no upstream contract boundary.

## Proposed fix

Add a small Open Coffee Listing Standard surface under `/v1`:

### 1. Public schema endpoint

`GET /v1/listing-schema`

Response shape:

```json
{
	"data": {
		"schema_version": "open-coffee-listing-v0.1",
		"json_schema": {},
		"required_fields": ["name", "country"],
		"recommended_fields": [
			"producer",
			"region",
			"processing",
			"price_tiers",
			"stocked",
			"arrival_date"
		],
		"field_groups": ["identity", "origin", "process", "pricing", "availability", "proof"]
	},
	"meta": {
		"resource": "listing-schema",
		"namespace": "/v1/listing-schema",
		"version": "v1",
		"status": "beta"
	}
}
```

The initial schema should be deliberately narrow and truthful. Prefer a small v0.1 contract over a sprawling schema that pretends all catalog fields are supplier-ready.

### 2. API-key-gated dry-run validator

`POST /v1/listings/validate`

- Requires a valid Parchment API key with `catalog:read` or a new low-risk `listings:validate` scope if scope migration is cheap.
- Green tier should be allowed to validate small batches because the validator is a developer-acquisition surface. Apply normal rate limits and cap request size.
- Accepts one listing object or `{ listings: [...] }` with a small max, for example 25 rows.
- Does not persist, publish, contact suppliers, create catalog rows, mutate user data, or trigger scraper work.
- Returns structured validation results with:
  - `valid: boolean`
  - `errors[]` for hard schema failures
  - `warnings[]` for missing recommended fields, ambiguous price tiers, weak proof, or non-normalized process labels
  - `mapping_preview` showing how accepted fields map toward `coffee_catalog` / `/v1/catalog` concepts
  - `limitations[]` explaining that validation is not supplier verification, certification, quality scoring, or acceptance into the live catalog

### 3. Docs and discovery

- Add the schema and validator to `GET /v1` discovery.
- Add docs under the API docs tree explaining the standard, minimum example, rich example, batch validation, error envelope, and non-persistence guarantee.
- Add copy that frames the validator as the first Open Coffee Listing Standard proving slice, not a supplier onboarding promise.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                      | Vision | Data moat / decision quality | Cross-surface | Public / access ladder | Foundation unlock | Total | Feasibility gate                                                                                                            | Decision     |
| ---------------------------------------------- | -----: | ---------------------------: | ------------: | ---------------------: | ----------------: | ----: | --------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Open Coffee Listing Schema validator           |      5 |                            5 |             4 |                      3 |                 3 |    20 | Medium. Requires schema discipline, request caps, docs, and no-write guarantees, but no supplier account or ingestion flow. | Selected     |
| Coffee Intent Exchange demand graph endpoint   |      5 |                            5 |             4 |                      3 |                 3 |    20 | Too dependent on PR #354 and real saved-brief usage. Aggregate demand before capture would be platform theater.             | Defer        |
| Sourcing brief member UI                       |      5 |                            4 |             3 |                      3 |                 2 |    17 | Already covered by the 2026-05-05 saved-brief program once PR #354 lands.                                                   | Defer        |
| Parchment Intelligence CLI activation          |      5 |                            4 |             4 |                      3 |                 3 |    19 | Already has open PR #361 with a plan.                                                                                       | Defer        |
| Proof query filters                            |      5 |                            5 |             4 |                      3 |                 3 |    20 | Already planned on 2026-05-07 and depends on proof coverage PR #335.                                                        | Defer        |
| Pure docs correction for listing-standard copy |      3 |                            2 |             2 |                      2 |                 1 |    10 | Useful only if paired with an actual machine-readable contract.                                                             | Reject today |

The selected candidate ties the newest platform work back to the supply side. Buyer-intent work is now in flight through PR #354; the bigger unclaimed strategic gap is upstream supplier/developer compatibility.

## Strategy Alignment Audit

- **Canonical direction:** This aligns with `notes/PRODUCT_VISION.md` by strengthening the data moat, making structured coffee data more trustworthy, treating API-first as product strategy, and serving developers and AI agents through explicit contracts instead of prose-only docs.
- **API-first contribution:** The listing schema and validator create a shared upstream contract that can later serve web supplier tooling, CLI validation commands, scraper fixtures, direct-feed pilots, and external agent workflows. It avoids a one-off supplier UI or private importer.
- **Public value legibility:** A public schema plus examples makes Purveyors' normalization model visible before the paywall. The validator should require an API key but allow Green-tier evaluation so developers and suppliers can try the standard without a sales process.
- **Cross-surface consistency:** Future `purvey listings validate`, scraper fixture validation, docs examples, supplier feed pilots, and API consumers can share one schema version and one error vocabulary.
- **Moonshot check:** Yes. This plan is directly informed by `brain/moonshots/2026-04-09-open-coffee-listing-standard.md`. The independently shippable proving slice is not supplier claims or direct publishing; it is `GET /v1/listing-schema` plus `POST /v1/listings/validate`, a no-write compatibility contract that tests whether the market can converge around Purveyors' structured listing shape. The 2026-05-07 Coffee Intent Exchange moonshot was also reviewed, but its first capture/match primitive is already represented by open PR #354 and should not be replanned today.
- **Scope discipline:** This plan intentionally excludes supplier account claiming, feed ingestion, catalog writes, direct publishing, RFQs, alerts, demand aggregation, supplier scoring, certification claims, raw evidence uploads, and scraper rewrites.

## Scope in

- Define `open-coffee-listing-v0.1` as a versioned JSON Schema in a shared module.
- Add `GET /v1/listing-schema` with public schema metadata.
- Add `POST /v1/listings/validate` as an API-key-gated, no-write dry-run validator.
- Cap batch size and payload size.
- Reuse existing structured `jsonResponse` and API auth/rate-limit patterns.
- Return errors, warnings, mapping previews, schema version, and limitations.
- Update `/v1` discovery and docs content.
- Add tests for schema response, valid listing, invalid listing, warnings, batch cap, auth, rate-limit header behavior, and no persistence.

## Scope out

- Persisting supplier-submitted listings.
- Supplier claim/profile flows.
- CSV upload, feed scheduling, webhooks, or direct feed polling.
- New Stripe products or paid supplier plans.
- Raw supplier evidence rooms or document uploads.
- Certification, legal compliance, or verified-supplier claims.
- CLI commands in the first PR. CLI should follow once the HTTP contract is stable.
- Changing `/v1/catalog` response shape.
- Scraper code changes.

## Specific files likely to change

- `src/lib/listing-standard/openCoffeeListingSchema.ts`
- `src/lib/listing-standard/openCoffeeListingSchema.test.ts`
- `src/lib/server/listingValidation.ts`
- `src/lib/server/listingValidation.test.ts`
- `src/routes/v1/listing-schema/+server.ts`
- `src/routes/v1/listings/validate/+server.ts`
- `src/routes/v1/listings/validate/validate.test.ts`
- `src/routes/v1/+server.ts`
- `src/routes/v1/v1.test.ts`
- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`

If the repo already has a better schema/module convention when implementation starts, use that convention. Do not invent a parallel validation stack if a project-local Zod or schema pattern already exists.

## Acceptance criteria

- `GET /v1/listing-schema` returns `HTTP 200`, `schema_version: "open-coffee-listing-v0.1"`, a JSON Schema object, required/recommended field metadata, and beta status copy.
- `POST /v1/listings/validate` without a valid API key returns structured auth failure and does not validate payload content.
- A valid minimal listing returns `valid: true` plus warnings for missing recommended fields.
- A richer listing with price tiers, processing, origin, producer, stocked state, arrival date, and proof hints returns a mapping preview toward `/v1/catalog` concepts.
- Invalid price tiers, invalid dates, impossible batch shapes, unknown top-level fields that should not be accepted, and oversized batches return structured `400` errors.
- The validator never writes to Supabase and has tests proving no insert/update path is called.
- `/v1` discovery advertises both endpoints with beta status and clear auth semantics.
- Docs include minimal and rich examples, batch validation examples, error response examples, and non-persistence/non-verification limitations.
- Copy never claims that validation means supplier verification, certification, listing acceptance, or legal/compliance readiness.

## Test plan

- Unit-test the schema module so required fields, recommended field metadata, enum-like process hints, price tier shape, and date expectations are stable.
- Unit-test the validator service independently from SvelteKit routing so mapping previews, warnings, and hard errors are deterministic.
- Route-test `GET /v1/listing-schema` for public access, beta metadata, response envelope, cache expectations, and schema version.
- Route-test `POST /v1/listings/validate` for unauthenticated denial, API-key success, malformed JSON, single-listing validation, batch validation, oversized batch rejection, and no-write behavior.
- Discovery-test `GET /v1` so docs and machine discovery cannot drift from the new endpoints.
- Docs-test content examples if the docs test suite already snapshots API examples.
- Run live post-deploy smoke checks against production using the stored API key, without exposing the key.

## Verification commands

Local validation:

```bash
pnpm exec vitest run \
  src/lib/listing-standard/openCoffeeListingSchema.test.ts \
  src/lib/server/listingValidation.test.ts \
  src/routes/v1/listing-schema/listing-schema.test.ts \
  src/routes/v1/listings/validate/validate.test.ts \
  src/routes/v1/v1.test.ts \
  src/lib/docs/content.test.ts
pnpm lint
pnpm check --fail-on-warnings
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS 'https://www.purveyors.io/v1/listing-schema' \
  | jq -e '.data.schema_version == "open-coffee-listing-v0.1" and .meta.status == "beta"'

curl -sS -o /tmp/listing-validate-auth.json -w '%{http_code}' \
  -X POST 'https://www.purveyors.io/v1/listings/validate' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example Coffee","country":"Colombia"}' \
  | grep -qx '401'

curl -sS -D /tmp/listing-validate.headers \
  -X POST 'https://www.purveyors.io/v1/listings/validate' \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example Coffee","country":"Colombia","region":"Huila","processing":"Washed","price_tiers":[{"min_lbs":1,"price":7.25}],"stocked":true}' \
  | jq -e '.data.valid == true and (.data.warnings | type == "array") and .meta.schema_version == "open-coffee-listing-v0.1"'

curl -sS -o /tmp/listing-validate-bad.json -w '%{http_code}' \
  -X POST 'https://www.purveyors.io/v1/listings/validate' \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Broken Coffee","country":"Colombia","price_tiers":[{"min_lbs":1,"price":null}]}' \
  | grep -qx '400'
```

## Risk assessment

- **Schema overreach risk:** A giant v0.1 schema could freeze immature field semantics. Mitigation: require few fields, recommend many fields, and mark the endpoint beta.
- **Supplier-politics risk:** Suppliers may read validation warnings as public criticism. Mitigation: validator is private to the caller, no persistence, no score, no public supplier ranking.
- **False-certainty risk:** Validation can sound like verification. Mitigation: every response and docs page carries limitations: not accepted into catalog, not verified, not certified, not legal/compliance assurance.
- **Abuse/payload risk:** Public validation could become a spam or compute sink. Mitigation: require API key for POST, cap batch size and payload size, and use normal rate limits.
- **Schema drift risk:** `/v1/catalog`, scraper extraction, and listing schema could diverge. Mitigation: keep the schema module close to catalog contract tests and include a docs/discovery test for schema version.
- **Premature supplier-platform risk:** A validator can invite expectations of direct publishing. Mitigation: explicitly exclude writes and supplier claims in the PR and public copy.

## Stop points

- If implementation requires a new dependency for JSON Schema validation, stop and ask Reed before installing. Prefer repo-existing validation patterns first.
- If the initial schema cannot be expressed without copying large chunks of catalog internals, stop and narrow to a hand-authored v0.1 contract.
- If API-key auth or rate-limit patterns would require broad auth refactors, ship only `GET /v1/listing-schema` first and write a follow-up plan for validation.
- If docs start promising direct feeds, supplier verification, or publishing, cut that copy before merge.
