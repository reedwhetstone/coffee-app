# Purveyors Product Vision

**Status:** Canonical product direction
**Owner:** Reed Whetstone
**Last updated:** 2026-04-06

## What Purveyors is

Purveyors is a coffee intelligence platform. It turns fragmented supplier data, roast data, and business data into trustworthy decisions for roasters, coffee businesses, developers, and eventually AI agents acting on their behalf.

This is not just a marketplace and not just a roast logger. The core value is structured intelligence built on a proprietary coffee data layer.

## Who it is for

### Primary users
- **Serious home roasters and micro-roasters** who need better sourcing, roasting, and profitability workflows
- **Commercial roasters** who need systematic quality, visibility, and operational leverage
- **Developers and API consumers** who want normalized coffee data and machine-friendly platform access

### Secondary users
- Curious coffee buyers who benefit from better public catalog and analytics surfaces
- Internal and external AI agents that need reliable, structured coffee domain context

## Core product beliefs

1. **Truthful coffee data beats marketing copy.**
   Purveyors should make coffee easier to evaluate through normalized, comparable, transparent data. If a feature increases noise or obscures provenance, it is off-strategy.

2. **The data moat matters more than feature sprawl.**
   Supplier ingestion quality, field normalization, availability tracking, pricing structure, and semantic retrieval are strategic assets. Work that strengthens this moat compounds.

3. **API-first is product strategy, not implementation detail.**
   The same structured data and workflows should serve the web app, CLI, external API users, and agentic consumers. If we build logic that only works in one surface, that is usually a design smell.

4. **Intelligence should replace navigation where possible.**
   Purveyors should feel like a system that helps users decide, not a pile of disconnected CRUD screens. Search, analytics, recommendations, and conversational workflows should reduce operational friction.

5. **Public surfaces should prove value before the paywall.**
   Public catalog, docs, blog, and selected analytics should make the product's intelligence legible. Gating should protect the deeper workflow, not hide the existence of value.

6. **Professional depth should remain accessible.**
   The platform should scale from a serious individual roaster to a commercial operation without changing its conceptual model. We want enterprise-grade thinking without enterprise bloat.

## What we are building toward

### Near-term bets
- A trusted, normalized coffee catalog with meaningful filtering and semantic search
- Public analytics that prove the value of the underlying data asset
- A stable v1 API that external developers and agents can build against
- A first-class CLI that shares business logic with the web app
- Scraper quality systems that improve data coverage, provenance, and resilience over time
- A conversational / agentic interface layer that helps users act on the data, not just browse it

### Long-term direction
Purveyors should become the operating system for coffee intelligence: the place where sourcing, evaluation, operational workflows, and machine-readable coffee context all converge.

## What we should not do

- Build generic social/community features with weak connection to the data moat
- Ship convenience features that increase scope but do not improve decision quality
- Hide important logic behind opaque scores with no provenance or explanation
- Fork behavior across web, CLI, API, and agent surfaces when shared logic is possible
- Treat the blog as pure marketing rather than a public articulation of product direction
- Chase enterprise customization before the core platform model is coherent

## Strategy test for new work

A feature, fix, or plan is strategically strong if it does at least one of these:
- strengthens the coffee data moat
- improves decision quality for roasters
- increases consistency across web / CLI / API / agent surfaces
- makes public product value more legible
- reduces operational friction through intelligence rather than extra UI

A piece of work is strategically weak if it mainly:
- adds surface area without improving the data layer
- creates one-off logic for a single interface
- increases complexity without improving trust, clarity, or leverage
- drifts from coffee intelligence toward generic software cruft

## Authority order

When documents conflict, use this order:
1. **`notes/PRODUCT_VISION.md`** — canonical direction, brand, scope, and product principles
2. **ADRs in `notes/decisions/`** — canonical rationale for local architectural and product decisions
3. **`notes/MARKET_ANALYSIS.md`, `notes/API_notes/API-strategy.md`, `notes/BLOG_STRATEGY.md`** — supporting strategy docs
4. **Implementation plans and PR audits** — task-specific context and historical execution details
5. **Blog posts** — public articulation and examples, not the source of truth

## How to use this file

When planning, building, or reviewing work:
- read this file first
- explicitly note alignment or tension with it
- prefer work that compounds across multiple surfaces
- treat this file as the product compass, not just background reading
