# Proposal: Purveyors Market Wire

_Created: 2026-07-19_
_Status: Original strategic proposal. Market Brief naming, product corrections, and
implementation authority now live in `notes/market-wire/implementation-plan.md`._

> **Historical-only record.** This proposal preserves the original 2026-07-19
> strategy. Its Market Wire naming, `/wire` surface, WP-1 through WP-4 sequence,
> edition-facts assumptions, and publication-object model are superseded and must
> not be used as implementation guidance. Use
> `notes/market-wire/implementation-plan.md` for current contracts, naming, and
> dependency order.

_Domain: Purveyors ecosystem_
_Canonical source: this repo_

## One-line thesis

Build the Reuters wire for green coffee: a free, citation-rich stream of market changes that suppliers, roasters, writers, and agents distribute for Purveyors, with paid personalization, history, and action workflows.

## Why this matters

Purveyors has an unusually broad data asset but no repeatable distribution engine. A visitor can inspect the catalog or Market Index, yet must already know that Purveyors exists and choose to return. Lower subscription prices may improve conversion after discovery, but they do not solve discovery itself.

The underlying scraper already observes the raw material for a compelling recurring media product: new arrivals, delistings, price moves, below-market lots, supplier changes, proof gaps, and origin trends. Publishing those changes as a trustworthy wire turns the data layer into a habit and gives every cited supplier, shared chart, newsletter excerpt, RSS reader, and agent integration a reason to distribute Purveyors.

## Why now

- The normalized catalog covers 40+ US importers and is already publicly discoverable.
- Market signals, price history, supplier statistics, metadata indexes, proof summaries, and sourcing briefs exist across the platform.
- The public Market Index establishes the proof-first funnel, while Parchment Intelligence already has a paid entitlement and checkout path.
- Sourcing Radar defines the personalized paid destination; Market Wire can become its public acquisition loop.
- External coffee intelligence products validate demand for recurring market information, but none appears to own a broad, public, structured feed of US specialty green-coffee offer-list changes.

## Existing assets this leverages

- coffee-scraper: daily supplier observations, arrivals, availability, pricing, provenance, and quality audits.
- parchment-api: catalog, market signals, statistics, metadata indexes, proof, SDK, and machine-readable contracts.
- coffee-app: public catalog and Market Index, subscription entitlements, saved sourcing intent, watchlists, chat, and evidence views.
- purveyors-cli: agent-first market and procurement reads that can make the wire portable beyond the website.
- blog and search footprint: an existing editorial surface that can explain important changes and acquire both coffee and developer audiences.

## The concept

Purveyors Market Wire is a continuously updated, provenance-backed publication layer over the green-coffee market.

The free product publishes a deliberately useful subset:

1. A weekly email and web edition with the most important arrivals, delistings, price moves, and origin changes.
2. Stable, indexable signal pages with source links, observation time, and methodology.
3. RSS/Atom and a small free API projection so writers, communities, agents, and niche tools can syndicate the feed.
4. Supplier and origin snapshots designed to be cited and shared.

The paid product applies leverage rather than hiding proof:

- custom origins, processes, suppliers, price ceilings, and sourcing mandates
- immediate alerts instead of the delayed public digest
- full history, comparisons, exports, and Ask Parchment analysis
- Sourcing Radar matches and actions tied to the buyer's own intent
- Mallard Studio context for owned inventory, roasting, and margin decisions

The commercial packaging can remain simple during validation: Intelligence at $12/month, Studio at $5/month, or a $15/month founding bundle. Parchment API remains a separate developer and platform product.

## Strategic upside

- Revenue: Creates a low-friction paid upgrade from a recurring free habit and gives the $12 Intelligence plan an obvious distinction: personalization, speed, depth, and action.
- Growth / funnel: Every brief, signal, supplier citation, RSS subscriber, and embedded chart becomes a distribution node rather than a one-time page view.
- Defensibility: The archive compounds into a longitudinal record of specialty green-coffee availability and price movement that becomes more valuable over time.
- Product positioning: Establishes Purveyors as the source people cite when describing what changed in the green-coffee market.

## Why this could be a great idea

It solves the actual bottleneck. The platform already has more capability than market awareness. A media-like wire makes the data asset legible before asking for payment, then converts recurring attention into personalized decision support. It also connects the public proof surface, weekly procurement brief, Sourcing Radar, API, CLI, and blog into one coherent funnel.

## Why this could be a terrible idea

Free recurring intelligence could satisfy too much demand, train users not to pay, or create supplier tension when Purveyors highlights delistings and unfavorable price comparisons. A noisy or stale feed would also damage the trust advantage. The free edition must be useful but delayed and general; paid value must come from relevance, immediacy, history, and workflow.

## Historical launch-validation framing

The original proposal evaluated a build-now publication core with a human review
gate, direct outreach, a founding offer, and recurring measures for list growth,
opens, evidence clicks, replies, repeat visits, and paid conversion. It also
assumed a shared edition-facts/publication-object pipeline and a WP-1 through WP-4
build order. Those assumptions are retained only to explain the proposal's origin;
they are not the current implementation contract.

The original cross-product notes likewise described expected roles for
coffee-scraper, parchment-api, purveyors-cli, and coffee-app. Current ownership,
route boundaries, compatibility contracts, and MR sequencing are defined only in
`notes/market-wire/implementation-plan.md` and the governing ADRs.

## Current authority

Use `notes/market-wire/implementation-plan.md` for all Market Brief implementation
questions. This proposal, `notes/market-wire/research.md`,
`notes/market-wire/design.md`, and `notes/market-wire/infrastructure.md` are
historical records and do not own active work.

## Historical recommendation

The original recommendation was to build a minimal publication core with a human
publish gate and direct outreach from edition #1, then use subscriber, retention,
evidence-click, and paid-founder metrics to refine the product and earn automation.
That recommendation is historical; the current implementation boundary is defined
in `notes/market-wire/implementation-plan.md`.
