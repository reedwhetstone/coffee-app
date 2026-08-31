# Coffee Catalog Map and Elevation Explorer

**Status:** Proposed implementation plan
**Date:** 2026-08-31
**Owner:** Purveyors catalog experience
**Governing direction:** `notes/PRODUCT_VISION.md`, `notes/decisions/005-catalog-access-level-positioning.md`, Parchment `PADR-0012`, `PADR-0013`, `PADR-0015`, and coffee-scraper `ADR-005`

## Outcome

Ship a map-first view of the stocked green coffee catalog that lets a buyer move from a world view into countries, regions, subregions, localities, and supported cultivation sites while keeping the catalog list, coffee details, and filters in one coherent experience. Elevation is a first-class map lens with a visible MASL key, range filtering, and an aggregate profile for the current result set or viewport.

The map must represent every caller-visible catalog row honestly. Rows with unresolved geography remain visible in the results rail and contribute to an explicit unplaced count. A country or region centroid must never be presented as an exact farm location.

## Product boundary

### Intended behavior

- Desktop uses a map-first split view with a collapsible results rail. Mobile uses a full-screen map with a draggable results sheet.
- World and continental views show clusters. Zooming resolves clusters into the best supported geographic tier and, only where evidence exists, cultivation-site points.
- Cluster labels emphasize coffee count; selecting a cluster zooms to its bounds or opens its contained results. Single-lot or narrow-place markers may show display price per pound, and selecting a single feature opens the existing coffee detail experience after entitled hydration.
- A map/list toggle preserves one catalog result set, URL state, and entitlement state rather than creating a second search product.
- Basic catalog proof remains available through the existing public-demo website path. Advanced geographic, elevation, price, process, supplier, freshness, and wholesale search leverage follows the API-resolved catalog entitlement.
- The elevation lens uses explicit bands, a neutral unknown state, and a MASL/feet display toggle. Elevation is production context, never a quality score.
- The elevation range filter uses interval-overlap semantics: a coffee matches when its reported `[elevation_min_masl, elevation_max_masl]` overlaps the requested range. Unknown elevation never becomes zero.
- The viewport profile reports coverage, distribution, median, and range only over caller-visible rows with elevation evidence, while naming the unknown count.

### Capability and access matrix

The web labels below describe the user-facing principal. “Anonymous” is served through the coffee-app BFF with its server-held public-demo credential; it is not an unauthenticated direct call to Parchment. API tiers are machine consumers and receive only the fields and capabilities their resolved contract grants.

| Capability                                                                            | Anonymous / public-demo | Viewer session          | Member session           | API Green               | API Origin / Enterprise | Admin               |
| ------------------------------------------------------------------------------------- | ----------------------- | ----------------------- | ------------------------ | ----------------------- | ----------------------- | ------------------- |
| Base map, public-projection features, country/region clusters, and unplaced indicator | Yes, proof surface      | Yes                     | Yes                      | Yes, evaluation limits  | Yes, contract limits    | Yes                 |
| Canonical place labels, precision, and bounded provenance                             | Public-safe fields only | Public-safe fields only | Full entitled projection | Public-safe fields only | Contract-scoped         | Operationally full  |
| Fine-grained `place_id` navigation and alias-aware filtering                          | No                      | No                      | Yes                      | No                      | Yes, if contracted      | Yes                 |
| Elevation lens, numeric elevation bounds, profile, and advanced elevation filters     | No                      | No                      | Yes                      | No                      | Yes, if contracted      | Yes                 |
| Bounding-box “search this area,” including antimeridian handling                      | No                      | No                      | Yes                      | No                      | Yes, if contracted      | Yes                 |
| Raw assignment evidence and supplier/resolver text                                    | Never                   | Never                   | Never                    | Never                   | Never                   | Internal audit only |

The API and web layers must enforce this matrix server-side. The app may hide a control for experience reasons, but it may not expose a more permissive capability than Parchment resolves. Viewer keeps the current public catalog capability bundle; member is the web leverage tier; API Green is an evaluation contract rather than a web-role alias.

### Non-goals

- Do not infer exact farm coordinates from a country, broad region, supplier warehouse, producer name, processing site, or narrative description.
- Do not add synchronous third-party geocoding to catalog reads.
- Do not treat `processing_site`, farmer, producer, cooperative, or appellation as a physical child in the cultivation-site hierarchy.
- Do not use elevation as a ranking or quality proxy.
- Do not replace the current catalog list, CoffeeCard detail, watchlist, sourcing-brief, or deep-link behavior.
- Do not make coffee-app a shared-data or authorization authority.
- Do not solve historical multi-origin modeling by choosing one arbitrary point. Multi-origin assignments require the canonical many-to-many place model.

## Current evidence

The production catalog has 2,152 stocked rows. Of those, 2,119 have a country, 1,886 a region, 105 a subregion, 19 a locality, 397 a named cultivation site, and 1,171 an elevation bound. The existing shared table has the ADR-005 additive text and elevation columns, but no latitude, longitude, geometry, geographic precision, or canonical place identity.

The current Parchment catalog contract already exposes the legacy `grade` field and `grade` query parameter to member/admin sessions and paid API tiers. That parameter is a case-insensitive text match on `coffee_catalog.grade`; the current docs describe it as an elevation/grade filter, but it is not a numeric MASL-bound filter. PR 1 must preserve that parameter and its entitlement behavior, then add genuinely new numeric elevation projection/filter names without renaming or overloading `grade`. The additive names in this plan are `elevation_min_masl` and `elevation_max_masl` for row fields and the corresponding range parameters.

This means an honest first release can cover nearly the whole catalog at country or region precision, but site-level plotting requires a new canonical place layer and evidence-bearing assignments.

## Authority and lifetime

### Canonical owners

- **Parchment API repository:** shared schema migrations, canonical catalog/map HTTP contracts, row and column projection, entitlement enforcement, viewport aggregation, cache policy, and generated SDK types.
- **coffee-scraper repository:** source-truth geography/elevation extraction and forward evidence needed to resolve a catalog row to canonical places. It must not invent coordinates.
- **coffee-app repository:** map interaction, URL state, results rail, elevation presentation, fallback behavior, and upsell/progressive disclosure.
- **Basemap/tile provider:** visual cartography only. It is not the catalog-place or authorization authority.

### Durable state

Parchment owns a normalized place registry and catalog-place assignments:

- `origin_places`: stable identity, tier, canonical name, parent, centroid/geometry, precision, provenance, and confidence.
- `coffee_catalog_origin_places`: catalog row to place assignment, role, evidence/provenance, confidence, and whether the assignment is primary for display.

The many-to-many assignment survives page reloads, scraper updates, supplier changes, and multi-origin lots. Coordinates are precomputed and evidence-bearing. Browser viewport, selected marker, map lens, and open result sheet remain transient URL/UI state.

## Transition and failure model

1. Existing catalog rows keep their current text geography and elevation fields while additive API projection and filters land.
2. The canonical place schema and forward resolver land before the map endpoint depends on them. No catalog read performs geocoding.
3. Historical assignments run as a separately auditable backfill. Ambiguous or unresolved rows remain unplaced; retries are idempotent by canonical place identity plus catalog/place assignment identity.
4. New scraper observations update text fields and place evidence through the governed ingestion path. A failed or incomplete observation must not erase a trusted assignment.
5. The map endpoint applies the same principal, row visibility, wholesale scope, entitled filters, and effective-state notices as catalog listing/facets before clustering.
6. Map tiles or client rendering may fail independently. The results rail and list view remain usable, and reload reconstructs filters/lens/viewport from URL state.
7. Missing map schema returns the existing structured schema-unavailable failure rather than silently returning an empty world.

## Sibling and caller inventory

- Parchment catalog search, listing, facets, entitlement/access helpers, cache policy, route schemas, OpenAPI generation, and SDK client/types.
- Coffee-app `/catalog` server load, `/api/catalog` and `/api/catalog/filters` BFF adapters, catalog URL state, filter store, CoffeeCard/detail panel, watchlist, sourcing-brief summaries, and page chat context.
- Purveyors CLI catalog search/facets and machine-readable manifest, which must not falsely advertise unsupported filters.
- Cherry catalog tools and procurement criteria that share the catalog filter vocabulary.
- coffee-scraper ADR-005 geography/elevation writers, capability registry, clear-null governance, and rescrape paths.
- Catalog similarity/proof consumers that read origin fields but do not need map geometry in their public projection.

## Invariant ledger

- **MAP-AUTHORITY** | Parchment remains the shared schema, search, entitlement, and map-data authority; coffee-app performs presentation only. | Prove through API integration tests and absence of new coffee-app Supabase reads. | Active | Product vision and coffee-app architecture.
- **MAP-ENTITLEMENT** | Map/list/facets use identical effective row scope and entitled filters; lenient first-party callers reconcile stripped params and strict machine callers receive structured denial. | Listing, facets, map, SDK, and coffee-app direct-URL tests. | Active | coffee-app ADR-005 and Parchment PADR-0013.
- **MAP-GEO-SEMANTICS** | Physical hierarchy is `continent → country → region → subregion → locality → site`; facilities, actors, and appellations remain separate. | Schema constraints, resolver tests, and representative ADR-005 fixtures. | Active | coffee-scraper ADR-005.
- **MAP-PLACE-IDENTITY** | Canonical place IDs, not raw spelling or a single text alias, drive map navigation and fine-grained filtering after place resolution. | Alias, parent-context, click-through, and filter/count reconciliation tests. | Active | MAP-GEO-SEMANTICS and canonical Parchment ownership.
- **MAP-NO-FALSE-PRECISION** | A marker exposes the assignment precision and provenance; broad centroids never present as exact sites. Ambiguous rows remain unplaced. | Place-resolution and response-contract negative tests. | Active | Catalog truthfulness principle.
- **MAP-MULTI-ORIGIN** | Multi-origin coffees may link to multiple places and are never collapsed to one invented primary location; unique-coffee, placement, and spatial cluster counts are separate and labeled. | Many-to-many schema, multi-origin response, cluster-count, and result-rail fixtures. | Active, with counting detail carried into the place/map slices | coffee-scraper ADR-005 multi-origin finding.
- **MAP-ASSIGNMENT-LIFECYCLE** | Valid corrections supersede obsolete active assignments atomically; failed or incomplete observations preserve the last trusted active assignment. | Successful-correction, retry, crash-boundary, and active/superseded lifecycle tests. | Deferred to assignment-writer slice | Parchment assignment owner and coffee-scraper ADR-005 failure behavior.
- **MAP-ELEVATION-RANGE** | Preserve numeric bounds; `grade` remains the legacy text filter; partial bounds use an unbounded missing side for overlap, while scalar statistics use complete-interval midpoints only and expose partial/unknown counts. | Boundary, single-value, partial-bound, null, statistic, and legacy-parameter tests across API and UI. | Active | Existing ADR-005 elevation bounds and current Parchment contract.
- **MAP-UNKNOWN-COVERAGE** | Every caller-visible row remains represented in the experience; unresolved geography and elevation are counted and accessible in the rail/list. | Mixed known/unknown integration and UI tests. | Active | Selected product outcome.
- **MAP-CACHE-ISOLATION** | Only the public/demo projection is shared-cacheable; authenticated session and API-key map results are private/no-store or partitioned by account, never shared with public callers. | Credential-variation, header, BFF, and cache-key tests. | Active | Parchment PADR-0013 and PADR-0015.
- **MAP-BFF-TOKEN-CUSTODY** | The browser calls a same-origin thin BFF; the BFF attaches the server-held demo credential or server-side session bearer and contains no map aggregation or authorization policy. | Anonymous/session BFF, credential non-exposure, forwarding, error, and fallback tests. | Active | Parchment PADR-0015.
- **MAP-DOWNSTREAM-CONTRACTS** | CLI, Cherry, authored coffee-app docs, and generated API artifacts either adopt the canonical vocabulary in a dependent slice or omit it from their advertised contract. | Manifest, tool-schema, authored-doc, generated-SDK, and compatibility tests. | Active | Product vision API-first principle and coffee-app documentation rules.
- **MAP-RESILIENCE** | Basemap or map-render failure cannot make the catalog unusable. | Client error/fallback and SSR tests. | Active | Existing catalog availability.
- **MAP-PERFORMANCE** | The browser receives lightweight map features or aggregates, not thousands of full CoffeeCard payloads; clustering is deterministic for viewport, zoom, filters, and entitlement. | Contract payload, pagination/cluster-total, cache, and performance-budget tests. | Active | Parchment API authority and catalog performance direction.

## Cross-surface semantic contract

These rules are part of the plan's implementation contract. They keep the API, SDK, BFF, UI, CLI, and Cherry consumers from independently interpreting the same catalog facts.

### Elevation bounds and profile statistics

- A row with both bounds represents a closed interval `[elevation_min_masl, elevation_max_masl]`. A row with only a minimum represents `[minimum, +∞)`; a row with only a maximum represents `(-∞, maximum]`. A row with neither bound has unknown elevation. A row whose finite minimum exceeds its finite maximum is invalid and is rejected by the owning API contract rather than silently reordered.
- A requested range uses the same closed-interval convention. Omitted request sides are unbounded, and a row matches when the two intervals overlap, including at an equal boundary. The legacy `grade` text filter remains separate and unchanged.
- Profile coverage counts rows with at least one bound. It also reports `complete_bound_count`, `partial_bound_count`, and `unknown_count`; `unknown_count` means both bounds are absent and is never converted to zero.
- Numeric distribution and median use one unweighted observation per row with both finite bounds, represented by that interval's arithmetic midpoint. Partial-bound rows are evidence for coverage and finite extrema but are excluded from scalar distribution/median because no finite representative can be inferred without false precision. The response labels `statistic_sample_count` and `partial_bound_count`; median is null when there are no complete intervals. The profile's range is the minimum known lower bound and maximum known upper bound, not a fabricated midpoint range.
- The same unique catalog row contributes at most once to an elevation profile, even when it has multiple active place assignments. Elevation is context, never ranking or quality weight.

### Place navigation, counts, and spatial scope

- Map navigation and fine-grained filters use canonical `place_id` values after PR 2/3 resolve aliases. Existing country/region text filters remain compatibility filters for the current catalog contract; they are not the identity of a canonical site or locality. A map click must send the canonical ID, not whichever raw spelling happened to label the feature.
- `unique_coffee_count` is the count of catalog rows in the effective non-spatial query. `placed_unique_coffee_count` counts rows with at least one active assignment, `unplaced_unique_coffee_count` counts rows with none, and those two totals reconcile to the unique total for a non-spatial query. `placement_count` counts active catalog-to-place assignments. Cluster and feature counts use placement count, so spatial cluster counts can be non-additive when one coffee has multiple origins; they must never be presented as a sum that equals unique coffee count.
- A bounding-box request scopes placed features and assignments only. Unplaced rows cannot be tested against geometry, so the results rail keeps them in a separately labeled global remainder with an explicit notice; they are not counted as in-box placements. The response exposes viewport placed/unique counts separately from global unique/unplaced counts, and the UI never implies that the viewport total equals the full rail total. A user can still open the unplaced remainder through the list view.
- Longitude uses the closed domain `[-180, 180]`. A box with `west < east` is ordinary; `west > east` is accepted as an antimeridian-crossing box and normalized server-side into `[west, 180]` plus `[-180, east]` for deterministic filtering and cache keys. `west == east` is a zero-width box; a full-world view uses the explicit absence of a bounding box. Latitude is clamped/validated to `[-90, 90]`, and malformed or out-of-domain boxes return structured `400` errors.

### Assignment lifecycle and safe provenance

- Assignment identity includes `catalog_id`, canonical `place_id`, assignment role, and the source observation identity. Repeating the same observation is idempotent. Assignments have an explicit `active` or `superseded` state. A successful correction transaction writes the replacement evidence and marks obsolete conflicting active assignments superseded atomically; a multi-origin row may retain several active assignments when the new observation supports them. Failed, partial, or clear-null observations do not erase a trusted active assignment without an explicit valid correction decision.
- Map responses expose only a bounded provenance enum/source label and assignment precision. They never expose supplier text, raw resolver evidence, internal URLs, or evidence quotes. Evidence remains server-only for audit and backfill decisions.

### Cache, BFF, and selection behavior

- Shared caching is allowed only for the public/demo projection and must key every public query dimension, including normalized geometry, zoom, filters, and lens. Authenticated session and API-key map responses use `private, no-store` by default, or an equivalently partitioned account/principal cache that can never collide with public/demo data. Credential variation tests must prove that member-only clusters, totals, and profiles cannot be served to another principal.
- The browser never calls `api.purveyors.io` directly. The coffee-app `GET /api/catalog/map` BFF attaches the server-held public-demo key for anonymous website proof or exchanges the httpOnly session for a server-side bearer credential for signed-in users, forwards the canonical request, relays the response/error shape and relevant headers, and performs no map aggregation or entitlement decision.
- Selecting a cluster zooms to its bounds or opens a contained-results list; it never chooses an arbitrary coffee for detail. Selecting a single feature requests an entitled single-ID hydration through the existing catalog ID query/BFF before opening the CoffeeCard panel. The hydration path preserves URL/deep-link state and handles an unauthorized or missing row without exposing data.

## Delivery sequence

### PR 0, coffee-app: governing implementation plan

**Overall outcome:** the map and elevation explorer described above.
**Current slice:** record the cross-repository authority, entitlement, truthfulness, failure, and proof obligations before implementation.
**After merge:** successor PRs have one stable sequence and invariant ledger. No customer behavior changes.
**Next gate:** Parchment geography/elevation contract.

### PR 1, Parchment API and SDK: catalog geography and elevation contract

Reconcile the canonical catalog resource with the existing contract before adding fields. Preserve the member/paid-only legacy `grade` text projection, `grade` filter, and its current entitlement semantics. Add the genuinely new `subregion`, `locality`, `site`, `elevation_min_masl`, and `elevation_max_masl` projections where authorized, plus numeric elevation-bound parameters using the interval rules above. Keep raw `subregion`/`locality`/`site` text out of the fine-grained identity/filter contract until canonical place IDs and alias-aware assignment filtering exist in PRs 2 and 3. Update shared search/listing/facets vocabulary, route schemas, OpenAPI, SDK, access declarations, and tests without renaming or overloading existing parameters. Display projection and filter leverage remain distinct: advanced filters are entitlement-gated even when permitted rows expose the underlying facts.

**After merge:** every API consumer can read the existing geography/elevation facts through one typed contract, and entitled callers can query them consistently. No coordinates or map endpoint exist yet.
**Next gate:** canonical place and assignment schema.

### PR 1A, purveyors-cli: catalog contract adoption

After PR 1 is deployed, update the CLI's typed catalog consumer, flags, help, manifest, and compatibility docs for any new numeric elevation fields/filters that the CLI is intentionally adopting. Preserve the existing `grade` flag semantics. If a new map-only or fine-grained place capability is not supported by the CLI, omit it from command help and `purvey manifest` rather than advertising a parameter the command cannot honor. Add request, entitlement, manifest, and unsupported-capability tests so the CLI remains an explicit consumer of the Parchment contract, not a second filter implementation.

### PR 1B, Cherry: catalog tool contract adoption

After PR 1 is deployed, update Cherry catalog tool input schemas and procurement criteria only for capabilities it can actually call through the canonical SDK/API. Preserve the shared parameter names and entitlement behavior. If Cherry does not adopt a new filter or map projection in this sequence, leave it out of its advertised tool schema and add a compatibility test that prevents silent local filtering or false capability claims.

### PR 2, Parchment: canonical place registry and assignment lifecycle contract

Add the normalized place and catalog-place assignment schema, constraints, provenance/precision enums, read model, and idempotent assignment path. Establish country/region centroid sourcing and explicit rules for exact sites, broad centroids, ambiguity, failed observation, multi-origin rows, canonical place IDs, and the `active`/`superseded` assignment lifecycle. A valid correction must be able to replace obsolete active assignments atomically while failed or incomplete observations preserve trusted assignments. Do not run the historical backfill or activate the scraper writer in this PR.

**After merge:** new or explicitly reconciled data can hold truthful, durable map positions without changing existing catalog reads.
**Next gate:** historical assignment backfill.

### PR 3A, coffee-scraper: forward place-assignment writer

After PR 2, add the governed writer that turns future source observations into Parchment place assignments. Integrate it with the ADR-005 capability registry, source fixtures, clear-null governance, retry behavior, and the active/superseded correction rule. Missing assignment schema remains a safe no-op for legacy scraping; failed or partial observations cannot erase a trusted assignment. This slice must land before the historical backfill is treated as durable coverage.

### PR 3B, scraper/Parchment data operation: audited historical place assignment

Resolve current catalog geography tuples into canonical places using deterministic aliases and reviewed geographic datasets. Produce coverage and ambiguity reports, then apply the idempotent backfill separately from forward behavior. Preserve unresolved rows and source evidence.

**After merge/application:** stocked rows have the best supported place assignment and an explicit unplaced remainder.
**Next gate:** viewport map projection.

### PR 4, Parchment API and SDK: viewport map projection and elevation profile

Add a lightweight catalog-map endpoint accepting the canonical catalog filters, canonical `place_id` navigation, bounding box, zoom, and lens. Return deterministic clusters/features, safe provenance and geographic precision, unique-coffee/placement/placed/unplaced totals, effective-filter notices, and the interval-aware elevation profile. Apply catalog visibility and entitlement before aggregation. Accept and normalize antimeridian-crossing boxes, distinguish global totals from viewport placement totals, and preserve the explicit unplaced remainder behavior. Public/demo responses may use the shared public cache only when the full normalized request is in the key; authenticated session and API-key responses are private/no-store or equivalently account-partitioned. Add credential-variation, cache-header, structured-error, access-matrix, and malformed-geometry tests.

**After merge:** the web app can render an authorized map without downloading the full catalog or reimplementing clustering/statistics.
**Next gate:** coffee-app experience.

### PR 4A, coffee-app: authored contract documentation synchronization

When PR 1 or PR 4 changes a deployed public contract, land the dependent coffee-app documentation update in the same release train. Update the authored `/docs/api/*` source, API landing page, `src/lib/docs/content.ts`, README, and relevant Console guidance from verified behavior; keep generated API reference ownership in Parchment. The docs slice must describe the `grade` compatibility boundary, numeric elevation and place-ID semantics, BFF topology, access matrix, cache isolation, count/statistics rules, and deliberate CLI/Cherry availability. It must not advertise a flag, route, tier, field, or map behavior before the owning contract exists.

### PR 5, coffee-app: map-first catalog, BFF, and elevation lens

Add MapLibre-based rendering within the established Purveyors visual language, a same-origin `GET /api/catalog/map` thin BFF, a map/list toggle, results rail, mobile result sheet, URL-backed viewport/lens state, canonical place navigation, cluster/list interaction, marker/detail integration, elevation key and profile, entitlement-aware controls, and resilient list fallback. The BFF uses the server-held public-demo credential for anonymous website proof or the server-side session bearer for signed-in users, forwards the canonical request/response, and contains no map aggregation or authorization policy. A single marker hydrates its entitled catalog row through the existing `/api/catalog?ids=<id>` path before opening CoffeeCard; a cluster zooms or opens its contained results and never chooses an arbitrary row. Reuse the current CoffeeCard/detail, catalog filters, notices, watchlist, sourcing brief, and page context.

**After merge:** the catalog map is deployable behind a narrow release flag or route gate, with the existing list as fallback.
**Next gate:** production visual/data QA and release.

### PR 6, coffee-app: production rollout and discoverability

Validate representative world, country, region, elevation, unknown-origin, mobile, and degraded-map scenarios against production-shaped data. Add navigation/discoverability, analytics for map adoption and filter conversion, and remove the release gate after acceptance.

### PR 6A, CLI/Cherry compatibility and release verification

Verify the final Parchment fields, filters, map-related schemas, and entitlement notices against every first-class machine consumer. The CLI and Cherry may adopt only the capabilities their dependent slices have implemented; all other fields remain absent from their manifests/tool schemas. Record compatibility results with the release evidence so generated SDKs, authored docs, CLI, Cherry, and coffee-app cannot drift silently.

## Acceptance criteria

- A caller can open the map, share a URL, reload, and recover filters, viewport, lens, and selected coffee after entitled single-ID hydration.
- Unique result totals reconcile to the same effective non-spatial catalog query and entitlement. Placement and cluster counts are explicitly labeled as potentially non-additive for multi-origin coffees, and viewport totals are not conflated with global unplaced totals.
- Country, region, canonical place IDs, assignment precision, safe provenance, elevation bounds, and unknown/partial states render without semantic substitution. Legacy `grade` remains a separate text filter.
- Panning supports an explicit “search this area” transition, including antimeridian-crossing boxes; it does not create uncontrolled request churn. Unplaced rows remain accessible through a labeled global remainder.
- Cluster selection zooms or opens a contained list; single-feature selection hydrates through the BFF and uses the existing coffee detail behavior while preserving tracking/deep links.
- Unknown elevation is visible in coverage, partial bounds are reported separately, and only complete intervals contribute one unweighted midpoint each to scalar distribution/median.
- Public-demo/viewer/member, API Green, API Origin/Enterprise, admin, and strict API-key cases receive the capability-specific fields, controls, filters, notices, denials, and cache policy defined in the access matrix.
- Authenticated map responses cannot collide with public/demo cache entries, and no raw assignment evidence or supplier text is exposed in map responses.
- Parchment, coffee-app, CLI, and Cherry either implement the canonical contract in their dependent slice or omit it from advertised surfaces.
- Map or tile failure leaves a usable catalog list with an understandable recovery path.
- Mobile interaction, keyboard access, reduced motion, focus order, labels, and non-color elevation cues are covered.
- No new direct shared-data reads are added to coffee-app.

## Validation

- Parchment: focused catalog search/listing/facets/access/map tests, legacy `grade` compatibility and numeric-boundary tests, partial/null interval statistics, canonical-ID/alias tests, active/superseded lifecycle tests, antimeridian and count-semantics tests, route/OpenAPI schema tests, generated SDK consistency, credential-variation/cache tests, migration verification, `pnpm lint`, `pnpm typecheck`, and full relevant test suite.
- coffee-scraper: ADR-005 capability checks, forward-writer source fixtures, active-assignment correction and failed-observation/clear-null regressions, backfill dry-run and idempotency proof, and coverage report.
- coffee-app: URL/filter store tests, same-origin map BFF credential and forwarding tests, single-ID hydration and cluster interaction tests, Svelte component tests, map failure/SSR tests, authored-doc synchronization tests, accessibility checks, representative Playwright flows, `pnpm lint`, and `pnpm check --fail-on-warnings`.
- purveyors-cli and Cherry: shared query-name, entitlement, manifest/tool-schema, unsupported-capability, and no-local-filtering compatibility tests.
- Production-shaped canary: reconcile map/list counts at world and selected viewport scopes; inspect broad-centroid versus exact-site labels; verify elevation coverage against a narrow read-only database query.

## Material risks and deliberate deferrals

- **Geocoder licensing and provenance:** select a redistributable geographic dataset before committing coordinates. Basemap tiles do not grant geocoder-data rights.
- **Sparse fine-grained geography:** the first useful map will be strongest at country/region precision. Site coverage grows only with evidence.
- **Ambiguous names:** aliases such as repeated region or locality names require parent context; name-only global matching is rejected.
- **Multi-origin:** schema support is required before plotting; full supplier extraction may continue after initial release.
- **Elevation interpretation:** fixed bands aid scanning but vary by species and origin. Copy and legends must remain contextual, not evaluative.
- **Terrain:** 3D terrain or topographic relief is deferred. It adds visual weight without improving catalog-location truth in the first release.
- **Offline/self-hosted tiles:** MapLibre avoids SDK lock-in, but tile hosting/provider selection is a deployment decision for the UI slice.
