# Parchment Intelligence API and CLI Bridge

**Date:** 2026-04-29  
**Planning mode:** Planning only, no code changes in this PR  
**Selected program:** Externalize the existing Parchment Intelligence price-index data through a stable v1 API contract, then add CLI access and public examples.  
**Recommended shape:** Multi-stage implementation program with independently mergeable atomic PRs.  
**Repo ownership:** coffee-app first, then purveyors-cli, then coffee-app docs and conversion surfaces.

## Feature or program

Turn the already-shipped `price_index_snapshots` data foundation into an agent-friendly product surface:

1. `coffee-app`: add a canonical read-only `/v1/price-index` endpoint backed by `price_index_snapshots` and current entitlement infrastructure.
2. `purveyors-cli`: add a first-class Intelligence command and exported function that consumes the endpoint.
3. `coffee-app`: update docs, public examples, and conversion copy so the web, API, CLI, and agent story all point at the same contract.

This is the current, lower-risk successor to the older March 16 PPI plan. The original plan called for table creation, snapshot jobs, auth, billing, and a public teaser. Much of that foundation has now shipped under Parchment Intelligence: `price_index_snapshots`, analytics UI, entitlement fields, Stripe product entries, and public analytics gating. The missing product gap is stable external access.

## Why now

- `notes/DEVLOG.md` still lists Purveyors Price Index as a Priority 0 revenue data product.
- Git history shows the data foundation and analytics surface have moved beyond the March plan: `price_index_snapshots`, supplier health panels, public analytics, Parchment Intelligence entitlement, and billing copy are present.
- `src/lib/docs/content.ts` explicitly says analytics is not currently a stable public REST namespace and recommends a new public namespace if analytics becomes a first-class API family.
- `notes/PRODUCT_VISION.md` says API-first is product strategy and the CLI is a core product surface, not a sidecar.
- The latest published blog strategy emphasizes agent onboarding, codebase-resident product philosophy, and trustworthy structured data. A stable price-index endpoint is exactly the kind of machine-readable contract those posts argue for.

## Active strategy themes

1. **Coffee data moat over feature sprawl:** normalized supplier pricing, snapshot history, and origin/process dimensions compound better than isolated UI polish.
2. **API-first product surfaces:** the same data should serve web, CLI, external developers, and agents.
3. **CLI as agent surface:** agent-readable commands, stable output modes, and exported functions matter as product, not just ergonomics.
4. **Public value before paywall:** public analytics already proves value; API and CLI examples should make the premium layer legible without exposing private detail.
5. **Trust through provenance and clear contracts:** current processing-transparency ADRs prefer honest nulls, explicit entitlements, and scoped public data.

## Strategy Alignment Audit

- **Canonical direction:** This directly supports `notes/PRODUCT_VISION.md` by strengthening the coffee data moat, increasing consistency across web / CLI / API / agent surfaces, and making Parchment Intelligence useful as a machine-readable platform product.
- **Product principle supported:** It reinforces the beliefs that truthful coffee data beats marketing copy, API-first is strategy, and the CLI is a core agent-facing product surface.
- **Cross-surface effect:** High. The staged plan starts in coffee-app because the source data and auth live there, then exposes the same contract through purveyors-cli so agents and terminal users can consume the product without scraping the web UI.
- **Public value legibility:** High. The public analytics page already shows the shape of the value. A documented `/v1/price-index` contract plus CLI examples make the premium layer concrete and easier to buy.
- **Scope check:** This plan intentionally excludes price alerts, webhooks, new Stripe products, new database migrations, normalization redesign, and broad analytics UI changes. It externalizes the existing foundation before adding more product surface.

## Completion reconciliation

### Already shipped or partially shipped

- `price_index_snapshots` table and compute function exist in Supabase migrations.
- `/analytics` already reads `price_index_snapshots`, exposes public 90-day chart data, and gates deeper modules behind Parchment Intelligence access.
- `user_roles.ppi_access`, entitlement derivation, Stripe catalog entries, and subscription copy for Parchment Intelligence exist.
- Public catalog access appears shipped via PR #152 and follow-up fixes.
- The bean deletion critical bug appears shipped via PR #133 and related cascade/delete commits.

### Not shipped

- No `/v1/price-index` or `/api/v1/price-index` route exists in `src/routes`.
- Docs currently describe analytics as a web product surface, not a stable public REST API.
- `@purveyors/cli` has catalog, inventory, roast, sales, tasting, context, and manifest surfaces, but no Intelligence or price-index command/export.

## Candidate scoring

Candidate set was limited to Priority 0 through Priority 4 and skipped unclear or already-shipped items.

| Candidate                                                               | DEVLOG priority | Shipped-state reconciliation                                  | priority_score | complexity_score | risk_penalty | dependency_penalty | strategic_leverage_bonus | Total | Decision                     |
| ----------------------------------------------------------------------- | --------------: | ------------------------------------------------------------- | -------------: | ---------------: | -----------: | -----------------: | -----------------------: | ----: | ---------------------------- |
| Parchment Intelligence API and CLI bridge                               |              P0 | Foundation shipped, external contract not shipped             |             10 |                6 |           -2 |                  0 |                        4 |    18 | Selected                     |
| Clean up beans catalog profiles to remove exposed user reference fields |              P2 | No direct shipped evidence found                              |              6 |               10 |            0 |                  0 |                        1 |    17 | Valid, but narrower          |
| Catalog route server-load performance cleanup                           |              P3 | Some performance fixes shipped, catalog route work may remain |              5 |                6 |           -2 |                  0 |                        3 |    12 | Defer behind P0 data product |
| Roast chart resize on route navigation                                  |              P2 | No direct shipped evidence found                              |              6 |                6 |           -2 |                  0 |                        1 |    11 | Defer                        |
| Mobile roast/profile chart controls polish                              |              P4 | Mobile shell shipped, chart-specific polish remains           |              4 |                6 |           -2 |                  0 |                        2 |    10 | Defer                        |

Skipped as already shipped or too ambiguous for this run:

- Public Catalog Access + Conversion Funnel: public catalog access shipped in PR #152 and follow-ups. Residual conversion-copy work is real but should be scoped from current funnel evidence, not the stale unchecked backlog item.
- Cannot delete a bean if it references a sales row or roast profile: shipped via PR #133 and cascade/delete commits.
- Poor page refresh management across the app: too broad for a clean daily PR without a fresh affected-flow audit.
- Core Web Vitals and skeleton loading states: valid but need live measurement before implementation.

## Scope in / out

### In scope

- Define a stable `/v1/price-index` response envelope for origin/process/grade/wholesale segmented price-index snapshots.
- Use existing Parchment Intelligence entitlement state and API-key principal resolution.
- Preserve rate-limit and usage-logging behavior comparable to `/v1/catalog` where practical.
- Provide clear query parameters: `origin`, `process`, `grade`, `from`, `to`, `wholesale`, `limit`, `page`, and eventually `format=json` only in the first slice.
- Add tests for auth, entitlement failure, validation, pagination, and response shape.
- Add a CLI command and exported library function in `@purveyors/cli` after the API contract exists.
- Update product docs and examples after the API and CLI are in place.

### Out of scope

- New database tables or migrations.
- Rewriting analytics page data loading.
- New price alerts, watchlists, or webhooks.
- CSV export in the first endpoint PR.
- Repricing Parchment Intelligence.
- Retrofitting all API scopes or API-key creation UX unless implementation discovers it is necessary for safe entitlement enforcement.
- New scraper normalization work.

## Proposed UX or behavior

### API behavior

`GET /v1/price-index` returns a canonical v1 envelope similar in spirit to `/v1/catalog`:

```json
{
	"data": [
		{
			"date": "2026-04-29",
			"origin": "Ethiopia",
			"process": "Washed",
			"grade": "G1",
			"wholesale": false,
			"price": {
				"min": 6.25,
				"max": 9.8,
				"avg": 7.45,
				"median": 7.2,
				"p25": 6.9,
				"p75": 8.1,
				"stdev": 0.7
			},
			"sample": {
				"suppliers": 8,
				"listings": 31,
				"aggregation_tier": 1
			}
		}
	],
	"pagination": {
		"page": 1,
		"limit": 100,
		"total": 240,
		"totalPages": 3,
		"hasNext": true,
		"hasPrev": false
	},
	"meta": {
		"resource": "price-index",
		"namespace": "/v1/price-index",
		"version": "v1",
		"auth": {
			"kind": "api-key",
			"apiPlan": "member",
			"ppiAccess": true
		},
		"filters": {
			"from": "2026-03-30",
			"to": "2026-04-29",
			"origin": "Ethiopia",
			"process": null,
			"grade": null,
			"wholesale": false
		}
	}
}
```

Initial entitlement rule:

- Require API-key authentication.
- Require `principal.ppiAccess === true`.
- Return `403` with a clear upgrade message when the key is valid but the account lacks Parchment Intelligence.
- Keep `format=json` only for PR 1. CSV can be a later paid export if there is demand.

### CLI behavior

Add a command such as:

```bash
purvey intelligence price-index --origin Ethiopia --from 2026-04-01 --to 2026-04-29 --json
```

The CLI should also export a callable function from a new subpath, likely `@purveyors/cli/intelligence`, so agents can import the same behavior without shelling out.

### Docs and conversion behavior

- Update `/docs/api/analytics` or add a dedicated `/docs/api/price-index` page once the endpoint exists.
- Cross-link `/analytics`, `/api`, `/docs`, and `/subscription` so Parchment Intelligence has one coherent path from public proof to API usage.
- Add examples that show both curl and CLI usage.

## Files or systems likely to change

### PR 1, coffee-app

- `src/routes/v1/price-index/+server.ts`
- `src/routes/v1/price-index/price-index.test.ts` or adjacent route tests
- `src/lib/server/priceIndexResource.ts`
- `src/lib/server/auth.ts` or a small helper only if PPI entitlement enforcement deserves a named function
- `src/lib/server/apiAuth.ts` only if usage logging or scope handling requires a small additive change
- `src/lib/types/database.types.ts` only if generated types are stale relative to `price_index_snapshots`
- `src/lib/docs/content.ts` for route matrix and endpoint docs

### PR 2, purveyors-cli

- `src/commands/intelligence.ts`
- `src/lib/intelligence.ts`
- `src/program.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts`
- `package.json` exports, likely `./intelligence`
- CLI tests and docs

### PR 3, coffee-app

- `src/lib/docs/content.ts`
- `/api` and `/subscription` copy if needed
- Analytics CTA copy only where it points to machine/API access
- Optional blog or launch note outline under `notes/blog/outlines/`

## API or data impact

- Uses existing `price_index_snapshots` and current aggregation fields.
- Does not change the database schema.
- Creates a new stable public v1 endpoint contract.
- Should not expose raw supplier-level rows from gated modules.
- Should keep aggregation-tier semantics explicit so consumers know whether they are reading normalized aggregate rows.
- Requires careful null handling for process and grade, consistent with ADR-004's stance that missing metadata should remain honest.

## Program rationale

A single coffee-app PR could expose the API, but it would stop before the core product vision is achieved. The strategic value is cross-surface: web proves the data, API exposes it, CLI and exported functions make it agent-consumable, and docs convert that into a product story. Splitting the work keeps each PR reviewable while preserving the larger program.

## PR sequence, dependencies, and stop points

1. **PR 1: `/v1/price-index` read endpoint in coffee-app.**  
   Dependency: existing `price_index_snapshots`, API-key principal, and PPI entitlement fields.  
   Stop point: mergeable even if no CLI ever ships because external API users can call it directly.

2. **PR 2: `purvey intelligence price-index` in purveyors-cli.**  
   Dependency: PR 1 endpoint available on production or behind stable route contract.  
   Stop point: mergeable as a CLI feature because it consumes the public API and exports a reusable function.

3. **PR 3: Docs, examples, and conversion coherence in coffee-app.**  
   Dependency: PR 1 and preferably PR 2.  
   Stop point: mergeable as public documentation and funnel polish after the actual contracts exist.

Recommended first PR: PR 1. It creates the contract everything else depends on.

## Acceptance criteria

### Program-level

- Parchment Intelligence has a stable public API contract for price-index snapshots.
- CLI users and agents can request price-index data without scraping `/analytics`.
- Docs clearly separate public analytics UI, Parchment Intelligence web features, and the paid API contract.
- No new database schema is required for the first shipped slice.
- Existing public analytics behavior remains unchanged.

### PR 1

- `GET /v1/price-index` returns a tested canonical response envelope.
- Valid API key without Parchment Intelligence receives a clear `403`.
- Invalid or missing API key receives a clear `401`.
- Query params are validated with predictable `400` errors.
- Pagination is deterministic.
- The endpoint reads only aggregate `price_index_snapshots`, not raw supplier rows.
- API usage is logged and rate-limited where consistent with current v1 catalog behavior.

### PR 2

- `purvey intelligence price-index` supports JSON, CSV-like table output if consistent with existing output helpers, and clear errors.
- A library function is exported for agents.
- Manifest/docs show the new command.
- Contract tests cover auth errors and success output shape.

### PR 3

- Docs include curl and CLI examples.
- Public API docs no longer imply analytics lacks any stable API if `/v1/price-index` exists.
- Subscription and analytics CTAs use consistent Parchment Intelligence language.

## Test plan

### PR 1

- Unit or route tests for success, missing auth, invalid auth, no PPI access, invalid date params, invalid wholesale param, pagination, and empty data.
- Contract test that response keys stay stable.
- Local validation: `pnpm check`, focused route tests, and any existing API test suite slice.
- Optional live smoke after deployment using a Parchment Intelligence test key, if one exists.

### PR 2

- CLI unit tests for command parsing and request URL construction.
- Output-mode tests for JSON and table output.
- Manifest parity tests.
- `pnpm check`, `pnpm test`, and `pnpm verify:contract` in purveyors-cli.

### PR 3

- Docs content tests if present.
- `pnpm check` and focused docs/page rendering tests.
- Manual link audit across `/analytics`, `/docs/api/analytics`, `/api`, and `/subscription`.

## Risks and rollback

- **Entitlement ambiguity:** API plan and PPI access are separate. PR 1 should require PPI access explicitly and avoid silently granting access to all API members.
- **Scope creep into alerts/webhooks:** Keep alerts, watchlists, webhooks, and CSV export out of PR 1.
- **Data interpretation risk:** Aggregates can be misread as universal market truth. Include sample sizes, supplier counts, and aggregation tier in the response.
- **Route namespace confusion:** Use `/v1/price-index`, not an internal `/api/*` helper route, to match current v1 strategy.
- **CLI coupling risk:** The CLI should consume the public endpoint rather than duplicating database logic.

Rollback is straightforward for PR 1: remove the new route and docs references. No schema rollback should be needed. PR 2 can be reverted independently if CLI ergonomics are wrong. PR 3 is docs/copy only.

## Open questions for Reed

1. Should `/v1/price-index` require Parchment Intelligence only, or should Enterprise API plans also receive access even without explicit `ppi_access`?
2. Should the first endpoint expose 90 days to all Parchment Intelligence users, 365 days, or match the current web gate exactly?
3. Should `format=csv` ship in PR 1, or wait until the JSON contract and CLI path have real usage?
4. Is `purvey intelligence price-index` the preferred CLI namespace, or should this live under `purvey catalog price-index` to stay closer to the source data?
