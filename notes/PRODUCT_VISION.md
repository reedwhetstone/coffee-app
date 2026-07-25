# Purveyors Product Vision

**Status:** Canonical product direction
**Owner:** Reed Whetstone
**Last updated:** 2026-07-22

## What Purveyors is

Purveyors is a green coffee supply-chain intelligence platform. It turns fragmented supplier data, pricing, availability, provenance, roast context, and business context into trustworthy sourcing and operational decisions for roasters, coffee businesses, developers, and eventually AI agents acting on their behalf.

This is not just a marketplace and not a roasting tool. The core value is structured intelligence built on a proprietary green coffee data layer, with Mallard Studio as the personal roaster context layer that makes that intelligence more specific to a user's own inventory and operations.

## Who it is for

### Primary users

- **Roasters doing sourcing and procurement** who need better green coffee visibility, supplier comparison, and decision support without replacing their existing operating infrastructure
- **Commercial roasters, green buyers, and coffee businesses** who need systematic supply-chain visibility, quality context, and operational leverage
- **Serious home roasters and micro-roasters** who benefit from the same market intelligence plus Mallard Studio personalization for inventory, roasting, tasting, and margin decisions
- **Developers and API consumers** who want normalized green coffee data and machine-friendly platform access
- **AI agents and internal automations** that consume Purveyors through the CLI, generated SDK clients, and external API contracts

### Secondary users

- Curious coffee buyers who benefit from better public catalog and analytics surfaces

## Core product beliefs

1. **Truthful green coffee data beats marketing copy.**
   Purveyors should make green coffee easier to evaluate through normalized, comparable, transparent supply-chain data. If a feature increases noise or obscures provenance, it is off-strategy.

2. **The supply-chain data moat matters more than feature sprawl.**
   Supplier ingestion quality, field normalization, availability tracking, pricing structure, provenance, and semantic retrieval are strategic assets. Work that strengthens this moat compounds.

3. **API-first is product strategy, not implementation detail.**
   The same structured data and workflows should serve the web app, CLI, external API users, and agentic consumers. If we build logic that only works in one surface, that is usually a design smell. Parchment owns shared behavior behind HTTP contracts; `@purveyors/sdk` is the generated typed client; coffee-app and `@purveyors/cli` are independent consumers. Human terminal UX matters, but machine clarity, explicitness, and composability come first.

4. **The CLI is not a sidecar utility. It is a core product surface.**
   The CLI should be designed as the easiest way for an agent to understand, call, and trust Purveyors workflows. Commands, arguments, manifest metadata, output modes, error envelopes, and auth flows should optimize for reliable machine use first, then layer human ergonomics on top.

5. **Intelligence should replace navigation where possible.**
   Purveyors should feel like a system that helps users decide, not a pile of disconnected CRUD screens. Search, analytics, recommendations, and conversational workflows should reduce operational friction across sourcing, evaluation, and roaster-side context.

6. **Public surfaces should prove value before the paywall.**
   Public catalog, docs, blog, and selected analytics should make the product's intelligence legible. Gating should protect the deeper workflow, not hide the existence of value. Anonymous surfaces are a CTA and trust surface, not the place to keep adding new filters, charts, exports, saved searches, or premium query tools.

7. **Data visibility and search leverage are different products.**
   Viewers should be able to inspect the coffee catalog deeply enough to trust the data asset. Subscribed members should receive the best methods for using that data: advanced filtering, semantic search, saved searches, alerts, premium charts, comparisons, exports, and workflow automation. See `notes/decisions/005-catalog-access-level-positioning.md` for the canonical access-level contract.

8. **Professional depth should remain accessible.**
   The platform should scale from a serious individual roaster to a commercial operation without changing its conceptual model. We want enterprise-grade green coffee supply-chain thinking without enterprise bloat.

9. **Mallard Studio is context, not the umbrella product.**
   Mallard Studio should help roasters apply Purveyors intelligence to their own inventory, roast, tasting, and margin context. It should not pull the platform back into the saturated generic roasting-tool category.

## What we are building toward

### Near-term bets

- A trusted, normalized green coffee catalog with meaningful member-level filtering and semantic search
- Public analytics that prove the value of the underlying supply-chain data asset without turning anonymous access into the power-user surface
- A stable v1 API that external developers and agents can build against
- A first-class CLI that is designed agent-first, consumes the same Parchment API contracts as the web app, and remains easy to call directly from real agent workflows
- Scraper quality systems that improve data coverage, provenance, and resilience over time
- A conversational / agentic interface layer that helps users act on the data, not just browse it
- Mallard Studio workflows that enrich intelligence with owned-stock and roaster-side context without becoming the core product category

### Long-term direction

Purveyors should become the operating system for green coffee supply-chain intelligence: the place where sourcing, market evaluation, roaster-side context, operational workflows, and machine-readable coffee data all converge.

## What we should not do

- Build generic social/community features with weak connection to the data moat
- Compete as a generic roasting tool or roast-log suite when the strategic differentiation is green coffee supply-chain intelligence
- Ship convenience features that increase scope but do not improve decision quality
- Hide important logic behind opaque scores with no provenance or explanation
- Fork behavior across web, CLI, API, and agent surfaces when shared logic is possible
- Treat CLI ergonomics as a documentation problem instead of a product-quality problem for the shared machine surface
- Treat the blog as pure marketing rather than a public articulation of product direction
- Chase enterprise customization before the core platform model is coherent

## Strategy test for new work

A feature, fix, or plan is strategically strong if it does at least one of these:

- strengthens the green coffee supply-chain data moat
- improves green coffee supply-chain decision quality for roasters and buyers
- increases consistency across web / CLI / API / agent surfaces
- makes the CLI easier for agents to discover, call, and trust directly
- makes public product value more legible
- moves users up the access ladder by separating proof from leverage
- reduces operational friction through intelligence rather than extra UI

A piece of work is strategically weak if it mainly:

- adds surface area without improving the data layer
- creates one-off logic for a single interface
- increases complexity without improving trust, clarity, or leverage
- drifts from green coffee supply-chain intelligence toward generic software cruft or generic roasting-tool competition

## Authority order

When documents conflict, use this order:

1. **`notes/PRODUCT_VISION.md`:** canonical direction, brand, scope, and product principles
2. **ADRs in `notes/decisions/`:** canonical rationale for local architectural and product decisions
3. **`notes/ARCHITECTURE.md`:** verified current implementation state and migration boundary
4. **`notes/DEVLOG.md`:** the only ordered cross-product backlog
5. **`notes/BLOG_STRATEGY.md` and current product notes:** supporting strategy docs
6. **Implementation plans and PR audits:** task-specific context and historical execution details
7. **Blog posts:** public articulation and examples, not the source of truth

## How to use this file

When planning, building, or reviewing work:

- read this file first
- explicitly note alignment or tension with it
- prefer work that compounds across multiple surfaces
- when a change touches shared workflows, test the Parchment contract and each affected client surface instead of relying only on the web UI
- treat this file as the product compass, not just background reading
