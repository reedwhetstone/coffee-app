# Proposal: Purveyors Market Brief

_Created: 2026-07-19_
_Status: Strategic proposal aligned to the approved build-now infrastructure direction; launch validation runs from edition #1_
_Domain: Purveyors ecosystem_
_Canonical source: this repo_

## One-line thesis

Build the Reuters wire for green coffee: a free, citation-rich stream of market changes that suppliers, roasters, writers, and agents distribute for Purveyors, with paid personalization, history, and action workflows.

## Why this matters

Purveyors has an unusually broad data asset but no repeatable distribution engine. A visitor can inspect the catalog or Market Index, yet must already know that Purveyors exists and choose to return. Lower subscription prices may improve conversion after discovery, but they do not solve discovery itself.

The underlying scraper already observes the raw material for a compelling recurring media product: new arrivals, delistings, price moves, below-market lots, supplier changes, proof gaps, and origin trends. Publishing those changes as a trustworthy Market Brief turns the data layer into a habit and gives every cited supplier, shared chart, newsletter excerpt, RSS reader, and agent integration a reason to distribute Purveyors.

## Why now

- The normalized catalog covers 40+ US importers and is already publicly discoverable.
- Market signals, price history, supplier statistics, metadata indexes, proof summaries, and sourcing briefs exist across the platform.
- The public Market Index establishes the proof-first funnel, while Parchment Intelligence already has a paid entitlement and checkout path.
- Sourcing Radar defines the personalized paid destination; Market Brief can become its public acquisition loop.
- External coffee intelligence products validate demand for recurring market information, but none appears to own a broad, public, structured feed of US specialty green-coffee offer-list changes.

## Existing assets this leverages

- coffee-scraper: daily supplier observations, arrivals, availability, pricing, provenance, and quality audits.
- parchment-api: catalog, market signals, statistics, metadata indexes, proof, SDK, and machine-readable contracts.
- coffee-app: public catalog and Market Index, subscription entitlements, saved sourcing intent, watchlists, chat, and evidence views.
- purveyors-cli: agent-first market and procurement reads that already keep Purveyors data portable beyond the website.
- blog and search footprint: an existing editorial surface that can explain important changes and acquire both coffee and developer audiences.

## The concept

Purveyors Market Brief is a continuously updated, provenance-backed publication layer over the green-coffee market.

The free product publishes a deliberately useful subset:

1. A weekly email and web edition with the most important arrivals, delistings, price moves, and origin changes.
2. Stable, indexable signal pages with source links, observation time, and methodology.
3. RSS/Atom summaries and links so writers, communities, agents, and niche tools can follow the feed. A public edition API projection is explicitly deferred (plan §11).
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

It solves the actual bottleneck. The platform already has more capability than market awareness. A media-like Market Brief makes the data asset legible before asking for payment, then converts recurring attention into personalized decision support. It also connects the public proof surface, weekly procurement brief, Sourcing Radar, API, CLI, and blog into one coherent funnel.

## Why this could be a terrible idea

Free recurring intelligence could satisfy too much demand, train users not to pay, or create supplier tension when Purveyors highlights delistings and unfavorable price comparisons. A noisy or stale feed would also damage the trust advantage. The free edition must be useful but delayed and general; paid value must come from relevance, immediacy, history, and workflow.

## Launch validation on the build-now core

Build the minimal core in the approved dependency order from `notes/market-wire/implementation-plan.md` §10: the account-owned email-subscription contract (MR-1), Resend projection and reconciliation (MR-2), the coffee-app signup and preference surface (MR-3), the account-deletion prerequisites and orchestration (MR-4, MR-5) that keep account-coupled email safe to launch, the `/blog` Market Brief content and archive surface (MR-6), the external-source observation contract (MR-7) with its RSS and social capture ingesters (MR-8, MR-9), the weekly source packet and draft PR (MR-10) that consumes them, and production-success-to-Resend-draft dispatch (MR-11). Run the first editions through the explicit human publish gate while the pipeline proves its cadence and content quality:

1. Assemble the weekly source packet and Parchment facts, then draft and review the canonical `.svx` Market Brief file.
2. Recruit 50 named roasters, buyers, coffee writers, and supplier-side contacts through direct outreach.
3. Publish each edition as an indexable web page and email, with tracked links to the underlying Market Index evidence.
4. Offer a founding plan: $12 Intelligence, $5 Studio, or $15 bundled, price-locked for the first 50 customers.
5. Measure subscriber growth, open rate, evidence clicks, replies, repeat visits, and paid conversions.

These launch metrics inform iteration and commercial validation from edition #1; they are not a gate that delays the foundational publication infrastructure. The validation loop succeeds with at least 50 qualified free subscribers and five paid founding customers, or equivalent high-signal design-partner demand. It signals a distribution problem if outreach requires constant personal chasing and readers do not return for subsequent editions.

## What would need to be true

- Market signals and observation timestamps must be trustworthy enough to publish without manual correction.
- Each item must cite its supplier evidence and clearly distinguish observation from inference.
- The public edition must be general or delayed enough that personalized alerts retain paid value.
- Email, RSS, and web editions must share one canonical publication object rather than becoming separate editorial workflows.
- The founding offer must be paired with direct outreach and onboarding; price reduction alone will not create demand.
- Supplier comparison must remain neutral and evidence-led to protect Purveyors' trust position.

## Cross-product implications

- coffee-scraper: preserve immutable, publication-ready observations and truthful freshness metadata.
- parchment-api: own the account-owned email-subscription, Resend projection, and external-source observation contracts (MR-1, MR-2, MR-7); edition publication stays out of MR-7 scope, and a public edition API projection is explicitly deferred (plan §11).
- purveyors-cli: public Market Brief read commands are explicitly deferred (plan §11); when added later they must consume a canonical Parchment contract and preserve citations and observation timestamps for agents.
- coffee-app: own the Market Brief content and archive surface (MR-6), publish indexable editions and signal pages, collect email conversion, and route paid subscribers into Intelligence, Sourcing Radar, and Studio.

## Source-of-truth routing

- Canonical implementation plan: `notes/market-wire/implementation-plan.md`; `design.md` and `infrastructure.md` are retained as superseded concept records, while this proposal records the strategic context and launch-validation metrics.
- Original source: `brain/moonshots/2026-07-19-purveyors-market-wire.md` (retained as the originating moonshot/pointer after consolidation)
- Product repo mirror or PR: n/a

## Recommendation

Build the minimal publication core now, with a human publish gate and direct outreach from edition #1. Use subscriber, retention, evidence-click, and paid-founder metrics to refine the product and earn automation; do not delay syndication infrastructure until demand proof.
