# ADR-005 / PR #302 access-tier alignment plan

**Date:** 2026-04-29
**Status:** Proposed
**Related:** PR #302, PR #304, ADR-005, `notes/PRODUCT_VISION.md`, `notes/decisions/005-catalog-access-level-positioning.md`

## Goal

Bring PR #302 and the catalog codepath back into alignment with the accepted access-tier contract from PR #304 / ADR-005.

PR #302 should keep process transparency as catalog data visibility on cards, but it should not ship advanced process search leverage to anonymous users or unauthenticated direct API callers.

## Source-of-truth contract

- `notes/PRODUCT_VISION.md` says anonymous surfaces should prove value before the paywall, but are not the place to keep adding new filters, charts, exports, saved searches, or premium query tools.
- ADR-005 separates data visibility from search leverage:
  - anonymous: proof, crawlability, CTA, minimal broad discovery
  - viewer: read/evaluation UX, limited search
  - member: advanced filters, process facets, semantic search, saved searches, alerts, comparisons, exports, and premium charts
  - API tiers: conceptually map to the same capability families through query, field, row, rate, and endpoint limits
- ADR-005 explicitly says PR #302 should not ship advanced process transparency filters to anonymous users.
- ADR-004 remains valid: structured process fields are additive catalog/API fields, and raw `processing_evidence` is not exposed by default.

## Verified drift

### PR #302 renders working advanced process controls for everyone

PR #302 adds an unconditional `Advanced process transparency` block in `src/routes/catalog/+page.svelte`.

The controls write these query/filter keys into shared catalog state:

- `processing_base_method`
- `fermentation_type`
- `process_additive`
- `processing_disclosure_level`
- `processing_confidence_min`

That makes advanced process filtering a public UI feature, not a member-level leverage feature.

### Direct `/catalog` URLs can carry advanced process filters

PR #302 extends `src/lib/catalog/urlState.ts` so public catalog URLs parse and serialize the process facet keys above. `src/routes/catalog/+page.server.ts` maps the parsed URL state through `catalogUrlStateToSearchState` and then into `searchCatalog` without a capability check.

This means hiding Svelte controls later would not be enough. Direct URLs such as `/catalog?processing_base_method=natural` would still need server-side denial or stripping behavior.

### `/api/catalog/filters` returns premium metadata to callers who cannot use it

PR #302 extends `src/routes/api/catalog/filters/+server.ts` to return process facet metadata:

- `processing_base_method`
- `fermentation_type`
- `process_additives`
- `processing_disclosure_level`

The endpoint currently gates public-row and wholesale-row visibility through `resolveCatalogVisibility`, but it does not partition filter metadata by feature capability.

### `/v1/catalog` remains the largest bypass surface

`src/lib/server/catalogResource.ts` and `src/routes/v1/catalog/+server.ts` parse and apply advanced process params for the canonical API path. There is no capability matrix that rejects advanced query params for anonymous sessions, viewer sessions, or API Green keys.

This matters because UI gating does not protect machine/API access. `/v1/catalog?processing_base_method=natural` should not become a free substitute for member/API paid search leverage.

### Existing helper shape is too narrow

`src/lib/server/catalogVisibility.ts` currently answers row visibility questions like public rows, wholesale rows, and wholesale-only behavior. It cannot express capabilities such as:

- `canUseAdvancedFilters`
- `canUseProcessFacets`
- `canUsePriceScoreRanges`
- `canUseAdvancedSorts`
- `canViewPremiumFilterMetadata`
- `canUseSemanticSearch`
- `canExport`

ADR-005 calls for a central capability-oriented contract, not scattered role checks.

## Field-readiness findings

Do not solve entitlement and data normalization in the same PR.

A live anonymous `/v1/catalog?stocked=all&page=N&limit=100` sample on 2026-04-29 returned 2,814 public rows with this process-field coverage:

- `processing_base_method`: 51 populated rows, 5 unique values: `Decaf`, `Natural`, `Semi-Washed`, `Washed`, `Wet-Hulled`
- `fermentation_type`: 0 populated rows
- `process_additives`: 0 populated rows
- `process_additive_detail`: 0 populated rows
- `fermentation_duration_hours`: 1 populated row
- `processing_notes`: 20 populated rows
- `processing_disclosure_level`: 54 populated rows, 3 unique values: `high_detail`, `none`, `structured`
- `processing_confidence`: 51 populated rows
- `drying_method`: 1,305 populated rows, 171 raw unique values

Implication:

- Keep process data display on `CoffeeCard.svelte`; this proves data richness and supports trust.
- Move advanced process query controls behind member-level capability until coverage and product placement are mature.
- Do not expose `fermentation_type` or `process_additives` dropdowns until backgeneration creates meaningful coverage.
- Add `drying_method` to the member facet roadmap, but normalize its high-cardinality raw values before exposing it as a dropdown.

## Target behavior

### Anonymous

Allowed:

- public catalog preview/read path
- basic text search
- origin/country discovery
- legacy `processing` discovery if already public
- limited pagination/sorting already needed for public UX
- CoffeeCard factual process display where fields are present

Denied:

- advanced process facets
- premium filter metadata
- price/score range search if classified as leverage
- supplier/source power filtering if classified as leverage
- advanced sorting beyond the minimal public contract

### Viewer

Allowed:

- richer read/evaluation access to public catalog rows
- CoffeeCard process display
- basic search/discovery

Denied by default:

- working advanced process facets
- semantic search
- saved searches
- alerts
- exports
- deep comparison/chart tooling

If product wants a teaser, show disabled controls or CTA copy, not a working direct query builder.

### Member

Allowed:

- structured process facets
- normalized drying method facet once ready
- price/score/freshness/supplier filters as classified member leverage
- advanced sorting
- wholesale-aware views where current membership policy allows it
- future semantic search, saved searches, alerts, comparisons, exports, and GenUI workflows

### API Green

Allowed:

- evaluation-scale canonical API usage
- basic query contract
- clear upgrade prompts and explicit denials for premium query tools

Denied by default:

- advanced process facets
- premium multi-facet search leverage
- broad production-scale field/row/query access

### API Origin / Enterprise

Allowed according to commercial contract:

- larger row and rate limits
- broader query scope
- field selection where safe
- production integration features
- agent-scale access patterns

## Implementation slice 1: PR #302 correction

**Objective:** make PR #302 mergeable under ADR-005 without turning it into a broad entitlement refactor.

### Changes

1. Keep the CoffeeCard process summary and `src/lib/catalog/catalogResourceItem.ts` mapping.
2. In `src/routes/catalog/+page.svelte`, hide working process facet controls unless `data.catalogAccess.canUseProcessFacets` or equivalent is true.
3. For anonymous/viewer states, optionally render a non-interactive CTA/preview that explains members get structured process filters.
4. In `src/routes/catalog/+page.server.ts`, reject or strip advanced process URL params according to the final UX choice:
   - preferred security/API contract: unauthenticated direct advanced params produce an explicit auth-required result, and authenticated non-members get an entitlement-required result
   - acceptable SSR UX compromise: strip params for page render, but still surface a non-success state to avoid silently pretending the filter worked
5. Update tests that currently codify anonymous/viewer process param pass-through.

### Required tests

- Anonymous `/catalog?processing_base_method=natural` does not call `searchCatalog` with `processingBaseMethod`.
- Viewer `/catalog?processing_base_method=natural` does not get working member-only search leverage.
- Member/admin `/catalog?processing_base_method=natural` reaches `searchCatalog` with `processingBaseMethod`.
- Process controls are hidden or disabled for anonymous/viewer and enabled for member/admin.
- CoffeeCard process display still renders for public catalog rows where process fields are present.

### Validation

```bash
pnpm test -- --run src/routes/catalog/page.server.test.ts src/lib/stores/filterStore.test.ts src/lib/catalog/urlState.test.ts src/lib/components/CoffeeCard.svelte.test.ts
pnpm check
```

## Implementation slice 2: central catalog capability helper

**Objective:** create a reusable policy object so `/catalog`, `/api/catalog/filters`, and `/v1/catalog` cannot drift.

### New helper

Create `src/lib/server/catalogAccess.ts` or evolve `src/lib/server/catalogVisibility.ts` into a capability resolver.

Proposed shape:

```ts
export interface CatalogAccessCapabilities {
  canViewPublicCatalog: boolean;
  canViewFullCatalog: boolean;
  canViewWholesale: boolean;
  canUseBasicFilters: boolean;
  canUseAdvancedFilters: boolean;
  canUseProcessFacets: boolean;
  canUsePriceScoreRanges: boolean;
  canUseAdvancedSorts: boolean;
  canViewPremiumFilterMetadata: boolean;
  canUseSemanticSearch: boolean;
  canUseSavedSearches: boolean;
  canExport: boolean;
}
```

Inputs should include the existing principal signals rather than loose local role strings:

- `locals.session`
- `locals.role`
- principal/API key information from `src/lib/server/principal.ts`
- API plan data from `src/lib/server/apiAuth.ts`
- existing wholesale flags from `resolveCatalogVisibility`

### Required tests

Add pure matrix tests for:

- anonymous
- viewer session
- member session
- admin session
- API Green
- API Origin
- API Enterprise

Capabilities to assert at minimum:

- `canViewFullCatalog`
- `canUseBasicFilters`
- `canUseAdvancedFilters`
- `canUseProcessFacets`
- `canUsePriceScoreRanges`
- `canUseAdvancedSorts`
- `canViewPremiumFilterMetadata`
- `canViewWholesale`

### Validation

```bash
pnpm test -- --run src/lib/server/catalogAccess.test.ts
pnpm check
```

## Implementation slice 3: `/v1/catalog` API query-tier enforcement

**Objective:** make canonical API behavior match the access ladder.

### Changes

1. Classify every public query param in `src/lib/catalog/publicQueryContract.ts` and `src/lib/server/catalogResource.ts` as one of:
   - public basic
   - viewer basic
   - member/API paid leverage
   - admin/operational
2. Reject denied query params before `queryCatalogData` applies them.
3. Return explicit `401` for unauthenticated callers when auth is required.
4. Return explicit `403` for authenticated/API callers whose plan lacks the capability.
5. Preserve row/rate limits independently of capability checks.
6. Keep `fields=dropdown` from becoming a shortcut for premium filtered searches.

### Params that need classification

- process facets: `processing_base_method`, `fermentation_type`, `process_additive`, `has_additives`, `processing_disclosure_level`, `processing_confidence_min`
- price and score ranges: `price_per_lb_min`, `price_per_lb_max`, `score_value_min`, `score_value_max`
- supplier/source filters: `source`
- raw structured facets: `cultivar_detail`, `type`, `grade`, `appearance`
- freshness filters: `arrival_date`, `stocked_date`, `stocked_days`
- sorting fields in `PUBLIC_CATALOG_SORT_FIELDS`
- `fields=dropdown` and any field projection modes

### Required tests

- Anonymous basic params still work.
- Anonymous process facet params return explicit denial.
- Viewer session process facet params return explicit denial if member-only.
- Member session process facet params work.
- API Green receives only the API Green basic contract.
- API Origin / Enterprise receive the explicitly allowed paid query contract.
- Denied params cannot be smuggled through aliases or `fields=dropdown`.

### Validation

```bash
pnpm test -- --run src/routes/v1/catalog/catalog.test.ts src/lib/server/catalogResource.test.ts
pnpm check
```

## Implementation slice 4: filter metadata partitioning

**Objective:** `/api/catalog/filters` should only return metadata the caller can act on.

### Changes

1. Fetch broad metadata as today, but partition output by `CatalogAccessCapabilities` before returning JSON.
2. Anonymous/viewer responses should include only public/basic keys.
3. Member/admin responses can include process facet keys once the capability allows them.
4. API callers should receive metadata according to API plan, not web role.
5. The client should tolerate missing metadata keys without rendering empty controls.

### Required tests

- Anonymous response omits `processing_base_method`, `fermentation_type`, `process_additives`, and `processing_disclosure_level` when process facets are member-only.
- Viewer response omits the same keys unless a teaser policy is deliberately chosen.
- Member/admin response includes process metadata when rows contain values.
- Wholesale flags remain ignored for non-members and honored for members according to existing visibility rules.

### Validation

```bash
pnpm test -- --run src/routes/api/catalog/filters/filters.test.ts src/lib/stores/filterStore.test.ts
pnpm check
```

## Implementation slice 5: product copy and CTA

**Objective:** make the access ladder legible instead of making hidden controls feel arbitrary.

### Copy direction

- Anonymous: "Explore the catalog breadth. Create an account to inspect more of the dataset."
- Viewer: "You can inspect real catalog facts. Members get sourcing leverage: process facets, saved searches, alerts, and comparisons."
- Member: "Use structured process, supplier, price, score, and freshness filters to shortlist coffees faster."

### Files likely touched

- `src/routes/catalog/+page.svelte`
- any shared CTA or subscription components if already present
- tests if copy affects assertions

## Merge strategy

The safest sequencing is:

1. Patch PR #302 to remove the anonymous bypass and keep CoffeeCard display.
2. Merge PR #302 after verify passes.
3. Land the capability helper and metadata/API partitioning as follow-up PRs if PR #302 would otherwise grow too broad.
4. Only after entitlement is stable, expose new member-level facets backed by coverage/normalization data.

## Non-goals

- Do not normalize `drying_method` in PR #302.
- Do not create `fermentation_type` or `process_additives` dropdowns before backgeneration has coverage.
- Do not expose raw `processing_evidence` quotes in public API responses.
- Do not solve semantic search, saved searches, alerts, or exports in the PR #302 correction.
