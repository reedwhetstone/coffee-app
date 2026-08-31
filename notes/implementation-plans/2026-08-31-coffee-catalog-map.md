# Coffee Catalog Map and Elevation Explorer

**Status:** Proposed implementation plan  
**Date:** 2026-08-31  
**Owner:** Purveyors catalog experience  
**Governing direction:** `notes/PRODUCT_VISION.md`, `notes/decisions/005-catalog-access-level-positioning.md`, Parchment `PADR-0012`, Parchment `PADR-0013`, and coffee-scraper `ADR-005`

## Outcome

Ship a map-first view of the stocked green coffee catalog that lets a buyer move from a world view into countries, regions, subregions, localities, and supported cultivation sites while keeping the catalog list, coffee details, and filters in one coherent experience. Elevation is a first-class map lens with a visible MASL key, range filtering, and an aggregate profile for the current result set or viewport.

The map must represent every caller-visible catalog row honestly. Rows with unresolved geography remain visible in the results rail and contribute to an explicit unplaced count. A country or region centroid must never be presented as an exact farm location.

## Product boundary

### Intended behavior

- Desktop uses a map-first split view with a collapsible results rail. Mobile uses a full-screen map with a draggable results sheet.
- World and continental views show clusters. Zooming resolves clusters into the best supported geographic tier and, only where evidence exists, cultivation-site points.
- Cluster labels emphasize coffee count. Single-lot or narrow-place markers may show display price per pound. Selecting either opens the existing coffee detail experience.
- A map/list toggle preserves one catalog result set, URL state, and entitlement state rather than creating a second search product.
- Basic catalog proof remains available through the existing public-demo website path. Advanced geographic, elevation, price, process, supplier, freshness, and wholesale search leverage follows the API-resolved catalog entitlement.
- The elevation lens uses explicit bands, a neutral unknown state, and a MASL/feet display toggle. Elevation is production context, never a quality score.
- The elevation range filter uses interval-overlap semantics: a coffee matches when its reported `[elevation_min_masl, elevation_max_masl]` overlaps the requested range. Unknown elevation never becomes zero.
- The viewport profile reports coverage, distribution, median, and range only over caller-visible rows with elevation evidence, while naming the unknown count.

### Non-goals

- Do not infer exact farm coordinates from a country, broad region, supplier warehouse, producer name, processing site, or narrative description.
- Do not add synchronous third-party geocoding to catalog reads.
- Do not treat `processing_site`, farmer, producer, cooperative, or appellation as a physical child in the cultivation-site hierarchy.
- Do not use elevation as a ranking or quality proxy.
- Do not replace the current catalog list, CoffeeCard detail, watchlist, sourcing-brief, or deep-link behavior.
- Do not make coffee-app a shared-data or authorization authority.
- Do not solve historical multi-origin modeling by choosing one arbitrary point. Multi-origin assignments require the canonical many-to-many place model.

## Current evidence

The production catalog has 2,152 stocked rows. Of those, 2,119 have a country, 1,886 a region, 105 a subregion, 19 a locality, 397 a named cultivation site, and 1,171 an elevation bound. The existing shared table has the ADR-005 additive text and elevation columns, but no latitude, longitude, geometry, geographic precision, or canonical place identity. The canonical Parchment catalog and SDK currently expose and filter only the broad origin fields needed by the existing catalog surface.

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
- **MAP-NO-FALSE-PRECISION** | A marker exposes the assignment precision and provenance; broad centroids never present as exact sites. Ambiguous rows remain unplaced. | Place-resolution and response-contract negative tests. | Active | Catalog truthfulness principle.
- **MAP-MULTI-ORIGIN** | Multi-origin coffees may link to multiple places and are never collapsed to one invented primary location. | Many-to-many schema and multi-origin response fixtures. | Deferred to place-model slice | coffee-scraper ADR-005 multi-origin finding.
- **MAP-ELEVATION-RANGE** | Elevation bounds preserve ranges, overlap filtering is explicit, and null never becomes zero or a quality score. | Boundary, single-value, partial-bound, and null tests across API and UI. | Active | Existing ADR-005 elevation bounds.
- **MAP-UNKNOWN-COVERAGE** | Every caller-visible row remains represented in the experience; unresolved geography and elevation are counted and accessible in the rail/list. | Mixed known/unknown integration and UI tests. | Active | Selected product outcome.
- **MAP-RESILIENCE** | Basemap or map-render failure cannot make the catalog unusable. | Client error/fallback and SSR tests. | Active | Existing catalog availability.
- **MAP-PERFORMANCE** | The browser receives lightweight map features or aggregates, not thousands of full CoffeeCard payloads; clustering is deterministic for viewport, zoom, filters, and entitlement. | Contract payload, pagination/cluster-total, cache, and performance-budget tests. | Active | Parchment API authority and catalog performance direction.

## Delivery sequence

### PR 0, coffee-app: governing implementation plan

**Overall outcome:** the map and elevation explorer described above.  
**Current slice:** record the cross-repository authority, entitlement, truthfulness, failure, and proof obligations before implementation.  
**After merge:** successor PRs have one stable sequence and invariant ledger. No customer behavior changes.  
**Next gate:** Parchment geography/elevation contract.

### PR 1, Parchment API and SDK: catalog geography and elevation contract

Extend the canonical catalog resource projection with `subregion`, `locality`, `site`, `elevation_min_masl`, and `elevation_max_masl`. Add exact geographic tier filters and elevation-overlap parameters to shared search/listing/facets vocabulary, route schemas, OpenAPI, SDK, access declarations, and tests. Display projection and filter leverage remain distinct: advanced filters are entitlement-gated even when permitted rows expose the underlying facts.

**After merge:** every API consumer can read the existing geography/elevation facts through one typed contract, and entitled callers can query them consistently. No coordinates or map endpoint exist yet.  
**Next gate:** canonical place and assignment schema.

### PR 2, Parchment: canonical place registry and forward assignment contract

Add the normalized place and catalog-place assignment schema, constraints, provenance/precision enums, read model, and idempotent assignment path. Establish country/region centroid sourcing and explicit rules for exact sites, broad centroids, ambiguity, failed observation, and multi-origin rows. Do not run the historical backfill in this PR.

**After merge:** new or explicitly reconciled data can hold truthful, durable map positions without changing existing catalog reads.  
**Next gate:** historical assignment backfill.

### PR 3, scraper/Parchment data operation: audited historical place assignment

Resolve current catalog geography tuples into canonical places using deterministic aliases and reviewed geographic datasets. Produce coverage and ambiguity reports, then apply the idempotent backfill separately from forward behavior. Preserve unresolved rows and source evidence.

**After merge/application:** stocked rows have the best supported place assignment and an explicit unplaced remainder.  
**Next gate:** viewport map projection.

### PR 4, Parchment API and SDK: viewport map projection and elevation profile

Add a lightweight catalog-map endpoint accepting the shared catalog filters plus bounding box and zoom. Return deterministic clusters/features, geographic precision, placed/unplaced totals, effective-filter notices, and elevation coverage/distribution. Apply catalog visibility and entitlement before aggregation. Add public-demo cache behavior and strict machine-call semantics consistent with catalog listing/facets.

**After merge:** the web app can render an authorized map without downloading the full catalog or reimplementing clustering/statistics.  
**Next gate:** coffee-app experience.

### PR 5, coffee-app: map-first catalog and elevation lens

Add MapLibre-based rendering within the established Purveyors visual language, a map/list toggle, results rail, mobile result sheet, URL-backed viewport/lens state, marker/detail integration, elevation key and profile, entitlement-aware controls, and resilient list fallback. Reuse the current CoffeeCard/detail, catalog filters, notices, watchlist, sourcing brief, and page context.

**After merge:** the catalog map is deployable behind a narrow release flag or route gate, with the existing list as fallback.  
**Next gate:** production visual/data QA and release.

### PR 6, coffee-app: production rollout and discoverability

Validate representative world, country, region, elevation, unknown-origin, mobile, and degraded-map scenarios against production-shaped data. Add navigation/discoverability, analytics for map adoption and filter conversion, and remove the release gate after acceptance.

## Acceptance criteria

- A caller can open the map, share a URL, reload, and recover filters, viewport, lens, and selected coffee.
- Counts in clusters, results, unplaced totals, and elevation profiles reconcile to the same effective catalog query and entitlement.
- Country, region, subregion, locality, site, elevation bounds, and unknown states render without semantic substitution.
- Panning supports an explicit “search this area” transition; it does not create uncontrolled request churn.
- Map selection uses the existing coffee detail behavior and preserves tracking/deep links.
- Unknown-origin rows remain accessible. Unknown elevation is visible in coverage and excluded from numeric distribution.
- Public-demo/viewer/member and strict API-key cases receive the correct fields, controls, filters, notices, and denials.
- Map or tile failure leaves a usable catalog list with an understandable recovery path.
- Mobile interaction, keyboard access, reduced motion, focus order, labels, and non-color elevation cues are covered.
- No new direct shared-data reads are added to coffee-app.

## Validation

- Parchment: focused catalog search/listing/facets/access/map tests, route/OpenAPI schema tests, generated SDK consistency, migration verification, `pnpm lint`, `pnpm typecheck`, and full relevant test suite.
- coffee-scraper: ADR-005 capability checks, source fixtures, failed-observation/clear-null regressions, backfill dry-run and idempotency proof, and coverage report.
- coffee-app: URL/filter store tests, server/BFF contract tests, Svelte component tests, map failure/SSR tests, accessibility checks, representative Playwright flows, `pnpm lint`, and `pnpm check --fail-on-warnings`.
- Production-shaped canary: reconcile map/list counts at world and selected viewport scopes; inspect broad-centroid versus exact-site labels; verify elevation coverage against a narrow read-only database query.

## Material risks and deliberate deferrals

- **Geocoder licensing and provenance:** select a redistributable geographic dataset before committing coordinates. Basemap tiles do not grant geocoder-data rights.
- **Sparse fine-grained geography:** the first useful map will be strongest at country/region precision. Site coverage grows only with evidence.
- **Ambiguous names:** aliases such as repeated region or locality names require parent context; name-only global matching is rejected.
- **Multi-origin:** schema support is required before plotting; full supplier extraction may continue after initial release.
- **Elevation interpretation:** fixed bands aid scanning but vary by species and origin. Copy and legends must remain contextual, not evaluative.
- **Terrain:** 3D terrain or topographic relief is deferred. It adds visual weight without improving catalog-location truth in the first release.
- **Offline/self-hosted tiles:** MapLibre avoids SDK lock-in, but tile hosting/provider selection is a deployment decision for the UI slice.
