# ADR-005: Catalog access levels and search entitlement positioning

**Status:** Accepted

**Date:** 2026-04-29

## Context

PR #302 exposed advanced process-transparency filters on the public catalog. That made a local implementation question visible as a product strategy question: what should anonymous visitors, free signed-in viewers, subscribed members, API customers, and admins each be able to see and do?

The existing product vision says public surfaces should prove value before the paywall, while gating should protect deeper workflows rather than hide the existence of value. ADR-003 already applies that logic to analytics: a small public proof surface is allowed, while deeper market intelligence sits behind entitlement. ADR-004 adds structured processing fields and provenance-aware process metadata to the catalog API, but it does not decide which user levels should receive advanced query tools.

This ADR establishes the access-level model for catalog data, filters, charts, and related search tooling so future catalog, analytics, API, CLI, and GenUI work has a stable product contract.

## Investigation findings

### Current Purveyors behavior

As of 2026-04-29, the live `/api/catalog/filters` endpoint is public and returns broad filter metadata for anonymous callers, including source, continent, country, legacy processing, structured process base method, processing disclosure level, cultivar detail, type, grade, appearance, and arrival dates.

The live anonymous `/v1/catalog` response exposes the core coffee fields plus structured process fields such as `processing_base_method`, `fermentation_type`, `process_additives`, `processing_disclosure_level`, `processing_confidence`, and `drying_method`.

A live anonymous `/v1/catalog` sample of 1,058 rows showed:

- `processing_base_method`: 51 populated rows, 5 unique values.
- `fermentation_type`: 0 populated rows.
- `process_additives`: 0 populated rows.
- `processing_disclosure_level`: 54 populated rows, 3 unique values.
- `drying_method`: 435 populated rows, 74 unique raw values.

This means the empty PR #302 dropdowns are mostly a data coverage problem for `fermentation_type` and `process_additives`, not just a Svelte/schema wiring problem. It is also a product contract problem because `drying_method` has meaningful coverage and appears on cards, but PR #302 does not include it in filter metadata or the advanced filter UI.

Several currently public filter candidates are not ready to become polished search facets without normalization. `cultivar_detail`, `type`, `grade`, `appearance`, `arrival_date`, and `drying_method` have high-cardinality, inconsistent raw values. They are useful as displayed catalog facts and potentially useful for text or semantic search, but should not be presented as premium structured dropdowns until normalized into buyer-readable taxonomies.

### Comparable product pattern

Data platforms usually separate data visibility from workflow leverage:

- Public or free access proves that the dataset exists and is credible.
- Logged-in free access expands evaluation, onboarding, and product-qualified usage.
- Paid access unlocks the operator tooling: advanced filters, saved searches, alerts, exports, AI-assisted search, dashboards, historical analysis, and workflow automation.
- Enterprise/API access expands scale, integrations, reliability, support, and contractual needs.

Crunchbase Pro is a close pattern for this kind of search product. Its Pro search docs position advanced search around hundreds of filters, saved searches, real-time result updates, notifications, column customization, and exports. The important lesson is not that Purveyors should copy those exact mechanics. The lesson is that advanced search is the monetizable workflow layer, not mere data display.

Security best practice also points to centralization. OWASP treats access control as policy-driven authorization and recommends documenting an access policy, enforcing it in trusted server-side code, denying by default except for public resources, and reusing access control mechanisms rather than scattering checks. Stripe's entitlement model makes the same product architecture point from the billing side: features should map to products and active entitlements so feature access can be granted or revoked without changing every local call site.

## Decision

Purveyors will distinguish **catalog data visibility** from **catalog search leverage**.

- Anonymous visitors may see enough data to understand the product and trust the dataset, but anonymous access is a CTA surface, not a place to keep adding filter power or charts.
- Free signed-in viewers may inspect the core catalog deeply enough to evaluate Purveyors and understand the data asset, but their search capabilities remain deliberately limited.
- Subscribed members are the primary audience for tooling. They receive the best search, filtering, charting, monitoring, and workflow methods.
- API tiers remain a separate commercial surface with their own limits, but should map conceptually to the same capability families so the web, CLI, API, and agent layers do not drift.
- Admin access is operational and should not be used as product positioning.

## Access-level positioning

| Level | Product job | Data visibility | Search and tooling | What should feel compelling |
| --- | --- | --- | --- | --- |
| Anonymous | Prove Purveyors exists and is worth joining | Limited public catalog preview, selected public analytics from ADR-003, docs, blog, SEO-safe snippets | Freeze the anonymous feature set. Keep only minimal broad discovery already needed for the funnel, such as origin, legacy process, and basic text search. Do not add new filter categories, advanced process filters, semantic search, saved search, alerts, exports, or new charts. | Breadth of catalog, freshness, supplier coverage, visible structure, and a clear reason to sign up. |
| Viewer | Let a serious evaluator inspect the catalog | Broad read access to public catalog rows and rich CoffeeCard facts, including normalized process, drying method, price tiers, supplier links, arrival/stock status where available | Limited search: simple keyword, origin/country, legacy process, pagination, sorting, and possibly one or two obvious broad filters. No advanced multi-facet query builder, no semantic search, no saved searches, no alerts, no deep charts. | Trust that the data is real and rich enough to support sourcing decisions. The account should feel useful but not like the finished tool. |
| Member | Give buyers and roasters leverage | Full catalog visibility appropriate for the product, including wholesale-aware views and richer structured metadata where licensed and safe | Full search scope: structured process facets, drying method once normalized, price ranges, score ranges, freshness, supplier, wholesale, advanced sorting, semantic/natural-language search, saved searches, alerts, comparisons, and premium charts. | Decision speed. Members should feel they can answer sourcing questions faster than by checking supplier sites manually. |
| API Green | Let developers evaluate integration fit | Limited row and rate access to canonical API data | Basic query contract, evaluation-scale usage, clear upgrade prompts before quota pain | Confidence that the API is real and stable. |
| API Origin / Enterprise | Power production integrations and agents | Contract-scoped catalog data at higher scale | Higher rate limits, row limits, field selection, integrations, exports, support, and eventually enterprise entitlements | Reliable machine access to normalized coffee data. |
| Admin | Operate and debug the platform | Operationally necessary access | Internal tools, audit, QA, backfills | Correctness and safety, not monetization. |

## Feature entitlement policy

New catalog, analytics, or search features must declare their intended access level before implementation.

Default placement:

- **Anonymous:** only proof, crawlability, CTA, and already-accepted public slices. New anonymous filters and charts are rejected by default.
- **Viewer:** read expansion and evaluation UX, not leverage tooling. If a feature helps users inspect a single coffee or understand a field, viewer can be appropriate. If it helps users search, monitor, compare, or optimize across the dataset, it probably belongs to member.
- **Member:** advanced filtering, semantic search, saved searches, alerts, charts beyond the public proof layer, exports, comparison workflows, procurement workflows, and GenUI search agents.
- **API:** mirror the same product intent through rate, row, field, endpoint, and scope limits rather than copying every web role one-to-one.

The review question for every new catalog feature is:

> Does this feature reveal that Purveyors has value, or does it deliver the leverage someone would pay for?

If it reveals value, it can be public or viewer. If it delivers leverage, it belongs behind membership or an API paid tier.

## Data facet quality policy

A field should not become a dropdown facet just because it exists in `coffee_catalog`.

A structured facet is ready when:

1. The field has enough non-null coverage to avoid empty or misleading controls.
2. Values are normalized into a small buyer-readable taxonomy, or the UI intentionally handles high-cardinality search.
3. Null, unknown, not disclosed, and explicit none are distinguishable.
4. The backend supports the filter with the same semantics as the UI.
5. The access level is decided server-side before the filter is exposed.

Fields that fail this bar can still appear on CoffeeCards as factual data, in full-text search, or in member-only exploratory search, but they should not become prominent dropdowns.

## Server-side enforcement policy

UI hiding is not sufficient. Any feature placed behind login or membership must be enforced at the route/data layer.

For catalog search this means:

- Centralize capability resolution in a reusable catalog entitlement helper, not ad hoc Svelte checks.
- Deny advanced query params at the server/API boundary for callers without the required capability.
- Return explicit `401` for unauthenticated callers when auth is required, and `403` for authenticated callers who lack the required membership or entitlement.
- Do not return premium filter metadata to anonymous callers if the corresponding filter is not available to them.
- Include tests proving that direct URL/API requests cannot bypass the UI gate.

The existing `resolveCatalogVisibility` helper is a useful start for public/wholesale visibility, but it should grow into or delegate to a capability-oriented contract such as `resolveCatalogAccessCapabilities`, with capabilities like:

- `canViewFullCatalog`
- `canUseBasicFilters`
- `canUseAdvancedFilters`
- `canUseProcessFacets`
- `canUseSemanticSearch`
- `canUseSavedSearches`
- `canViewPremiumCharts`
- `canViewWholesale`
- `canExport`

## Application to PR #302

PR #302 should not ship advanced process transparency filters to anonymous users.

Recommended adjustment:

1. Keep CoffeeCard process transparency display where the data is present, because this is catalog data visibility and helps prove the dataset is real.
2. Move the advanced process filter controls behind at least signed-in viewer access, and preferably behind `member` if these are positioned as sourcing leverage.
3. Server-enforce the same access rule for direct `/catalog` URL params, `/api/catalog/filters`, and `/v1/catalog` query params.
4. Do not render empty dropdowns for `fermentation_type` or `process_additives` until a backfill or extractor creates real coverage.
5. Add `drying_method` to the member-level advanced-filter roadmap, but normalize its 74 current raw values before presenting it as a dropdown.
6. Treat `cultivar_detail`, `type`, `grade`, and `appearance` as raw display/search data until a dedicated taxonomy pass cleans them.

My product recommendation is stricter than PR #302: **viewer gets broad catalog reading, member gets advanced search leverage.** If we want viewers to get a taste of advanced search, expose a disabled preview or one carefully chosen teaser filter with an upgrade prompt, not the full query builder.

## Consequences

Positive consequences:

- Future catalog work has a stable access model instead of re-litigating every filter.
- Anonymous pages stay focused on acquisition and crawlability instead of becoming a free power tool.
- Viewers can still evaluate the data asset, which supports product-led activation.
- Members get a clearer reason to subscribe: better sourcing decisions through search leverage.
- Server-side enforcement reduces accidental premium-data leakage and forced-browsing bypasses.
- API and web product strategy stay conceptually aligned without forcing identical tier names.

Tradeoffs:

- Some public demos will feel less powerful than the underlying data can support.
- Viewer/member boundaries require careful copy so free users do not feel arbitrarily blocked.
- Feature teams must do entitlement design before UI implementation, which adds up-front work.
- Existing public endpoints may need compatibility handling if clients already rely on advanced query params.

## Implementation guidance

Near-term follow-up work should be split into independently mergeable slices:

1. **PR #302 correction:** remove anonymous advanced process filters, gate controls and query params, and add direct-route tests.
2. **Catalog capability helper:** introduce a central capability contract used by `/catalog`, `/api/catalog/filters`, and `/v1/catalog`.
3. **Facet coverage audit:** measure field coverage and cardinality nightly or during scraper audits so filter decisions are data-backed.
4. **Drying method normalization:** convert raw `drying_method` values into a small taxonomy before exposing it as a member filter.
5. **Membership copy:** update catalog CTA language so anonymous, viewer, and member states explain the value ladder clearly.

## References

- OWASP Broken Access Control: https://owasp.org/www-community/Broken_Access_Control
- OWASP Top 10 Broken Access Control: https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/
- Stripe Billing Entitlements: https://docs.stripe.com/billing/entitlements
- Stripe subscriptions and access provisioning: https://docs.stripe.com/billing/subscriptions/overview
- Crunchbase Pro advanced search docs: https://support.crunchbase.com/hc/en-us/articles/115010583327-Build-an-Advanced-Search-with-Crunchbase-Pro
- Crunchbase Pro saved searches: https://support.crunchbase.com/hc/en-us/articles/115010745608-Save-a-Search-with-Crunchbase-Pro
- Paddle SaaS pricing strategy: https://www.paddle.com/blog/saas-pricing-models-strategies-fltr
- Reforge product-led growth overview: https://www.reforge.com/blog/product-led-growth
