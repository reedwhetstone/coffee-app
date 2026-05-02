# Implementation Plan: `/v1/catalog` CLI-compatible query aliases

**Date:** 2026-04-30
**Status:** Proposed
**Focus areas:** Cross-surface consistency, API contract correctness, platform gaps
**Recommended shape:** One atomic PR

## Problem

`GET /v1/catalog` is the canonical external catalog contract, but it silently ignores two query patterns that the CLI and agent-facing docs already teach as normal catalog-search vocabulary:

- `offset=<n>` for pagination
- `sort=<price|price-desc|name|origin|newest>` for sorting

The canonical API currently supports `page`, `limit`, `sortField`, and `sortDirection`. The CLI currently exposes `--offset` and `--sort`, and the CLI docs describe those terms as the machine-facing catalog workflow. That means an agent or developer moving from CLI examples to direct API calls can send plausible parameters, receive HTTP 200, and get the wrong slice or order with no warning.

This is exactly the kind of cross-surface drift the product vision says to avoid. Silent no-op query params are worse than missing features because they look successful.

## Live API evidence

Commands run on 2026-04-30 against production with `PURVEYORS_API_KEY` from `~/.env`:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -s 'https://www.purveyors.io/v1/catalog?limit=5&page=6' \
  -H "Authorization: Bearer $API_KEY" | jq '{pagination, first:{id:.data[0].id,name:.data[0].name,price_per_lb:.data[0].price_per_lb,country:.data[0].country}}'

curl -s 'https://www.purveyors.io/v1/catalog?limit=5&offset=25' \
  -H "Authorization: Bearer $API_KEY" | jq '{pagination, first:{id:.data[0].id,name:.data[0].name,price_per_lb:.data[0].price_per_lb,country:.data[0].country}}'
```

Observed result:

- `page=6&limit=5` returned `pagination.page=6`, `hasPrev=true`, and first row `id=3106`.
- `offset=25&limit=5` returned HTTP 200 but `pagination.page=1`, `hasPrev=false`, and first row `id=890`.
- So `offset=25` is silently ignored instead of matching the CLI-style expectation of rows 26-30.

Sort evidence:

```bash
curl -s 'https://www.purveyors.io/v1/catalog?limit=5&sortField=price_per_lb&sortDirection=desc' \
  -H "Authorization: Bearer $API_KEY" | jq '{pagination, first:{id:.data[0].id,name:.data[0].name,price_per_lb:.data[0].price_per_lb,country:.data[0].country}}'

curl -s 'https://www.purveyors.io/v1/catalog?limit=5&sort=price-desc' \
  -H "Authorization: Bearer $API_KEY" | jq '{pagination, first:{id:.data[0].id,name:.data[0].name,price_per_lb:.data[0].price_per_lb,country:.data[0].country}}'
```

Observed result:

- Canonical `sortField=price_per_lb&sortDirection=desc` returned HTTP 200 and a different order.
- CLI-style `sort=price-desc` returned HTTP 200 but the default first row `id=890`, so `sort` is silently ignored.
- Invalid canonical params do fail closed: `sortField=nope` returns HTTP 400 and a structured parameter error. The problem is specifically that CLI-style aliases are plausible but unrecognized.

Other contract observations from the same probe:

- `GET /v1/catalog?limit=5` and legacy `GET /api/catalog-api?limit=5` returned the same top-level shape: `data`, `pagination`, `meta`.
- Legacy `/api/catalog-api` still emits `Deprecation: true`, `Link: </v1/catalog>; rel="successor-version"`, and `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`.
- API-key requests emit `X-RateLimit-*` headers. Anonymous `/v1/catalog` does not, as documented.
- The current key resolves to `meta.auth.apiPlan="member"`, so `limit=1000` is allowed under the shared hard request ceiling.
- The local `purvey` CLI is not currently authenticated in this cron environment, but `purvey catalog search --help` confirms the public CLI vocabulary: `--sort <field>` and `--offset <n>`.

## Root cause analysis

`src/lib/server/catalogResource.ts` parses only the canonical web/API params:

- Pagination: `page` + `limit`, with `offset` derived internally as `(page - 1) * limit`.
- Sorting: `sortField` + `sortDirection`, validated against `PUBLIC_CATALOG_SORT_FIELDS`.

Unknown query params are not rejected. They pass through validation and then disappear. This makes `offset`, `sort`, and other plausible integration params behave like success while changing nothing.

The CLI uses a different contract in `repos/purveyors-cli/src/lib/catalog.ts`:

- `offset` is passed directly into Supabase `.range(offset, offset + limit - 1)`.
- `sort=price` maps to `price_per_lb asc`.
- `sort=price-desc` maps to `price_per_lb desc`.
- `sort=name` maps to `name asc`.
- `sort=origin` maps to `country asc`.
- `sort=newest` maps to `last_updated desc`.

The planned CLI API-key catalog mode from `notes/implementation-plans/2026-04-29-cli-api-key-catalog-parity.md` will make this gap more visible. If the CLI starts calling `/v1/catalog` with its existing vocabulary, either the CLI needs an adapter layer or the API should accept the shared vocabulary directly. The API-first answer is to make `/v1/catalog` understand the stable machine vocabulary without breaking the existing canonical params.

## Proposed fix

Add backward-compatible CLI-style aliases to `GET /v1/catalog` while keeping the existing canonical params as source-of-truth docs and web-app URLs.

### In scope

1. **Add `offset` parsing as a pagination alias**
   - Accept `offset` as a non-negative integer.
   - When `offset` is supplied with `limit`, derive the effective offset directly or derive `page = floor(offset / limit) + 1` only when doing so preserves truthful pagination metadata.
   - Recommended v1 behavior: require `offset % limit === 0` and return HTTP 400 for non-page-aligned offsets unless the implementation also adds an explicit `pagination.offset` field. Truthful metadata matters more than accepting every possible offset shape.
   - If both `page` and `offset` are supplied, return HTTP 400 with a conflict message rather than guessing precedence.
   - Preserve `ids` behavior: explicit IDs still ignore pagination.

2. **Add `sort` parsing as a CLI-compatible alias**
   - `sort=price` -> `sortField=price_per_lb&sortDirection=asc`
   - `sort=price-desc` -> `sortField=price_per_lb&sortDirection=desc`
   - `sort=name` -> `sortField=name&sortDirection=asc`
   - `sort=origin` -> `sortField=country&sortDirection=asc`
   - `sort=newest` -> `sortField=last_updated&sortDirection=desc`, if `last_updated` can be safely exposed as a public sort field; otherwise map to the closest current canonical field and document the tradeoff.
   - If both `sort` and `sortField` / `sortDirection` are supplied, return HTTP 400 with a conflict message.
   - Invalid `sort` values should return the same structured `CatalogQueryValidationError` envelope as invalid canonical params.

3. **Share the mapping as a named helper**
   - Avoid duplicating CLI vocabulary by burying a switch statement inside route parsing.
   - Suggested coffee-app helper location: `src/lib/catalog/publicQueryContract.ts` or a sibling `catalogQueryAliases.ts`.
   - The helper should be directly unit-tested and easy for future CLI API-key mode work to mirror or import conceptually.

4. **Update public docs**
   - Keep `page`, `sortField`, and `sortDirection` documented as canonical.
   - Add a small compatibility note that `/v1/catalog` also accepts CLI-style `offset` and `sort` aliases for agent and terminal parity.
   - Document conflict behavior so consumers know not to mix aliases and canonical params.

### Out of scope

- Do not implement the full CLI API-key catalog parity plan. That remains a purveyors-cli-first workstream.
- Do not add `fields=summary`; that already has a separate plan.
- Do not redesign pagination response shape unless needed for non-page-aligned offsets.
- Do not reject all unknown query params in this PR. That may be strategically right later, but it is a larger compatibility decision.
- Do not change process-facet entitlement rules from ADR-005.

## Files likely to change

- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/lib/catalog/publicQueryContract.ts` or a new `src/lib/catalog/catalogQueryAliases.ts`
- `src/lib/docs/content.ts`
- Optional: `notes/DEVLOG.md` only if the implementation process requires tracking. Avoid touching it if concurrent cron work would create conflicts.

## Acceptance criteria

### Live API behavior

After deployment, these should pass:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

PAGE=$(curl -s 'https://www.purveyors.io/v1/catalog?limit=5&page=6' \
  -H "Authorization: Bearer $API_KEY")
OFFSET=$(curl -s 'https://www.purveyors.io/v1/catalog?limit=5&offset=25' \
  -H "Authorization: Bearer $API_KEY")

jq -r '.pagination.page, .data[0].id' <<<"$PAGE"
jq -r '.pagination.page, .data[0].id' <<<"$OFFSET"
```

Expected:

- Both requests return HTTP 200.
- Both return the same first row ID.
- `offset=25&limit=5` reports truthful pagination, ideally `page=6` and `hasPrev=true`.

Sort checks:

```bash
CANONICAL=$(curl -s 'https://www.purveyors.io/v1/catalog?limit=5&sortField=price_per_lb&sortDirection=desc' \
  -H "Authorization: Bearer $API_KEY")
ALIAS=$(curl -s 'https://www.purveyors.io/v1/catalog?limit=5&sort=price-desc' \
  -H "Authorization: Bearer $API_KEY")

jq -r '.data[0].id' <<<"$CANONICAL"
jq -r '.data[0].id' <<<"$ALIAS"
```

Expected:

- Both return HTTP 200.
- Both return the same first row ID.
- `sort=bogus` returns HTTP 400 with `details.parameter="sort"`.

Conflict checks:

```bash
curl -s -i 'https://www.purveyors.io/v1/catalog?limit=5&page=2&offset=25' \
  -H "Authorization: Bearer $API_KEY"

curl -s -i 'https://www.purveyors.io/v1/catalog?limit=5&sort=price&sortField=name' \
  -H "Authorization: Bearer $API_KEY"
```

Expected:

- Both return HTTP 400 with structured conflict details.

### Unit and integration tests

- `pnpm test -- src/lib/server/catalogResource.test.ts`
- Tests for `offset` alias mapping, including `offset=0`, `offset=25&limit=5`, invalid negative/non-integer offsets, and page/offset conflict.
- Tests for each supported `sort` alias.
- Tests that existing canonical `page`, `limit`, `sortField`, and `sortDirection` behavior is unchanged.
- Tests that the legacy `/api/catalog-api` alias delegates the same query aliases to `/v1/catalog` because it calls the canonical handler.

## Test plan

1. Run targeted unit tests for catalog resource parsing and response behavior.
2. Run docs/content tests if present, or at minimum `pnpm check` to catch TypeScript/Svelte errors.
3. Run live post-deploy curl checks above against `/v1/catalog` and `/api/catalog-api`.
4. Smoke-check the docs page locally or in preview to confirm the alias note renders clearly.

## Risk assessment

**Risk level:** Low to medium.

- **Compatibility risk:** Low if aliases are additive and canonical params remain unchanged.
- **Contract ambiguity risk:** Medium if `offset` produces pagination metadata that lies. Avoid this by requiring page-aligned offsets or adding explicit offset metadata.
- **Sort semantics risk:** Medium for `sort=newest` because the CLI uses `last_updated` while `/v1/catalog` does not currently list `last_updated` as an allowed sort field. The implementation should either expose `last_updated` deliberately or document a safer mapping.
- **Scope creep risk:** Medium. This should not become the full CLI API-key parity project or unknown-param strict-mode project.

## Strategy Alignment Audit

- **Canonical direction:** Strong fit with `notes/PRODUCT_VISION.md`, especially the API-first principle that web, CLI, API, and agent surfaces should not fork behavior when shared logic is possible. It also supports the near-term bet of a stable v1 API that external developers and agents can build against.
- **API-first contribution:** This improves the canonical machine contract rather than adding one-off CLI glue. The API remains the source of truth, but it learns the vocabulary already exposed by the agent-facing CLI.
- **Public value legibility:** Developers and agents get fewer silent footguns. A request that looks like normal catalog pagination or sorting produces the intended result or a structured error. That makes the platform feel more trustworthy.
- **Cross-surface consistency:** CLI `--offset` and `--sort` vocabulary becomes compatible with direct `/v1/catalog` calls, which matters for the planned CLI API-key mode, docs examples, and agent workflows that switch between shell commands and HTTP calls.
- **Scope discipline:** This plan intentionally excludes `fields=summary`, full CLI API-key mode, process-facet entitlement changes, and a global unknown-query strict mode. Those are separate decisions.

## Recommended first implementation PR

Open one atomic coffee-app PR: **`feat: add v1 catalog CLI query aliases`**.

The PR is independently mergeable because it is additive, preserves the existing canonical query contract, and improves API trust even if the purveyors-cli API-key catalog mode never ships.
