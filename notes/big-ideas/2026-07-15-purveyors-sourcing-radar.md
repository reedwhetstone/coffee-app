# Proposal: Purveyors Sourcing Radar

_Created: 2026-07-15_
_Status: Graduated to MVP planning_
_Domain: Purveyors ecosystem_
_Canonical source: second brain_

## One-line thesis

Turn saved sourcing intent into a provenance-backed recurring decision artifact that tells each buyer what changed, why it matters, and which lots deserve action now.

## Why this matters

Purveyors has built most of an unusually strong intelligence stack: normalized listings from 40+ suppliers, longitudinal price and availability observations, market signals, saved sourcing criteria, watchlists, proof summaries, a typed API and SDK, an agent-first CLI, and a conversational evidence workspace. The missing product is the recurring loop that converts those assets into a decision a buyer expects to receive.

Today, users can inspect the market and manually ask questions. A sourcing professional pays when the system reliably notices the relevant change first, filters it through the buyer's standing intent, explains the evidence, and makes the next action obvious.

## Why now

The four product layers have converged:

- The scraper now records immutable supplier observation sets with fenced ingest and explicit provenance.
- Parchment API exposes market signals, price movement, metadata trends, procurement briefs, proof, ranking, and owner-scoped operational data.
- The CLI has completed its SDK/API cutover and exposes a stable machine contract for agents.
- The app has saved brief criteria, tracked lots, Market Index signals, chat tools, evidence surfaces, and confirmed write actions.

There is also a product-truth gap worth closing. Marketing and subscription copy promise a weekly procurement brief, while the actual recurring brief, recommendation run, alert, and delivery workflow have not shipped.

The important constraint is that the intelligence publication backbone is not finished. Legacy aggregate writers are frozen, immutable supplier observations exist, but the transactional publication builder and publication-aware reader cutover remain incomplete. Sourcing Radar should therefore begin by finishing that trust bridge rather than adding another UI over potentially stale aggregates.

## Existing assets this leverages

- coffee-scraper: 43 documented live sources, structured extraction, proof-quality auditing, price observations, immutable supplier observation sets, true observation timestamps, and durable Shopify coordination.
- parchment-api: catalog, proof, similarity, ranking, procurement brief/match endpoints, market signals, price-index statistics, metadata index, OpenAPI, MCP direction, and generated SDK.
- purveyors-cli: machine-readable manifest, stable JSON/error contracts, device authentication, market and procurement reads, and agent-ready catalog/inventory/roast/tasting/sales workflows.
- coffee-app: public catalog and Market Index, member watchlists, saved sourcing criteria, conversational market tools, active evidence shelf, subscription surface, and idempotent confirmed actions.

## The concept

Purveyors Sourcing Radar is a standing buying mandate, not another dashboard.

A user describes what they are trying to buy: origin, process, price ceiling, volume, freshness, proof requirements, wholesale posture, or similarity to an existing coffee. The system saves that intent and evaluates it against each trustworthy market publication.

Each run produces an immutable, explainable brief containing:

1. New matches that appeared since the last run.
2. Material price drops and below-market opportunities relevant to the mandate.
3. Tracked lots that were delisted, restocked, or became stale.
4. Evidence quality and publication freshness for every recommendation.
5. Explicit reasons, limitations, and what changed since the prior brief.
6. An Ask Parchment handoff that opens the recommendation with its evidence already in context.
7. Confirmed next actions such as adding a lot to the watchlist or inventory. RFQs and purchasing remain out of scope until real demand proves them necessary.

The first version is an in-app manual or weekly brief. External email, Discord, webhook, and autonomous purchasing are later delivery channels, not the core product.

## Strategic upside

- Revenue: Turns Parchment Intelligence from access to data into a recurring paid decision product; creates a clean reason to retain a subscription.
- Growth / funnel: A public Market Index proves breadth, while a personalized brief demonstrates the paid leverage of applying that market to a buyer's actual needs.
- Defensibility: The durable asset becomes the combination of longitudinal supplier observations, buyer intent, recommendation history, and outcome feedback, not a static catalog snapshot.
- Product positioning: Moves Purveyors from “browse the whole market” to “never miss the right buying moment.”

## Why this could be a great idea

It closes the loop across every existing repo instead of creating a fifth disconnected surface. The scraper supplies trustworthy change. Parchment turns change plus intent into deterministic recommendations. The SDK and CLI make the workflow portable to agents. The app delivers the brief, evidence, and confirmed action.

It also converts a product promise that already appears in pricing copy into something measurable. The primary success metric is not page views. It is whether users open briefs, inspect recommended lots, save or track them, and report that the system found something they would otherwise have missed.

## Why this could be a terrible idea

The system may produce a polished weekly artifact before Purveyors has enough real buyers to prove that the recommendations change purchasing behavior. If briefs are generic, noisy, or based on stale publication inputs, they will damage trust faster than another passive dashboard would.

The design must resist becoming an autonomous procurement fantasy. A narrow, explainable decision-support product is credible. Automated buying, supplier outreach, and broad “copilot” claims are not yet earned.

## Cheapest proving experiment

After the publication reader is trustworthy, recruit three design partners and run a four-week concierge pilot:

1. Capture one real sourcing mandate from each partner.
2. Generate the recommendation run deterministically once per week.
3. Review the top findings manually for freshness, relevance, and evidence quality.
4. Deliver the brief in-app or as a private static artifact.
5. Record whether each finding was already known, investigated, shortlisted, or acted on.

The experiment succeeds if at least two partners identify multiple recommendations they would have missed or found materially later. It fails if the briefs mostly restate obvious catalog matches.

## What would need to be true

- The provenance-aware market publication builder and reader cutover must ship before recommendations claim recency or market movement.
- Recommendation ranking must be deterministic and evidence-bearing; the LLM may explain results but cannot invent their order.
- Brief runs must be immutable enough to compare what changed between periods.
- Saved intent must support real buying constraints without becoming an enterprise procurement suite.
- The first users must be actual sourcing decision-makers, not only internal demos or API enthusiasts.
- Marketing must stop promising weekly delivery until the recurring workflow is real.

## Cross-product implications

- coffee-scraper: finish cohort/policy configuration, transactional publication building, atomic activation, and truthful fresh/carried/unavailable metadata; later derive a catalog change feed from immutable observations.
- parchment-api: make active publication manifests the source for market reads; add immutable recommendation runs that join sourcing briefs, tracked lots, proof, and market signals; expose run/read contracts through the SDK.
- purveyors-cli: add create/run/read sourcing workflow commands only when they serve the end-to-end mandate workflow; preserve publication and evidence metadata verbatim for agents.
- coffee-app: render the recurring brief as the paid decision surface, connect each finding to its lot evidence and Ask Parchment, and use confirmed actions for watchlist or inventory changes.

## Source-of-truth routing

- Canonical archive: `brain/moonshots/`
- If promoted: cross-repo program plan in `repos/coffee-app/notes/implementation-plans/`, with repo-local ADRs and mergeable slices owned by each product repo
- Product repo mirror or PR: [coffee-app #482](https://github.com/reedwhetstone/coffee-app/pull/482)

## Deep-research refinement, 2026-07-18

The recurring brief remains the strategic destination, but it is too large for the first value test.

A current-state audit found that saved sourcing briefs, deterministic matches, watchlists, Market Index signals, SDK methods, and CLI reads have already shipped. The missing product seam is saved brief intent joined to indexed price evidence. It also found that legacy aggregate writers are intentionally frozen and current readers do not reject stale “latest available” rows. Freshness must therefore be a launch gate, not presentation metadata.

The MVP is now deliberately smaller:

1. Wait for the accepted provenance-aware publication reader cutover.
2. Add one read-only Parchment endpoint that intersects an owned brief with existing `price_drop` and `below_market` evidence.
3. Add one manual coffee-app reference-client route.
4. Test with three real sourcing decision-makers for four weeks.

No new score, stored recommendation run, scheduler, external alert or delivery channel, CLI command, LLM ranking, RFQ, or purchase workflow belongs in the MVP. The in-app route and agent surface must still show current, explainable matches and useful next actions; the pilot measures whether those recommendations are genuinely new and useful rather than making customers prove the product's value through a research harness.

External research strengthens this boundary. ICO, USDA, and FAO data show meaningful volatility alongside record production and declining stocks, which supports monitoring rather than a perpetual-scarcity thesis. The Specialty Coffee Transaction Guide shows that specialty prices require like-for-like context beyond commodity benchmarks. Royal, Cafe Imports, Genuine Origin, and Algrano demonstrate fragmented catalog and transaction models. Vesper and roastery software vendors demonstrate paid demand for decision and planning leverage, but not willingness to pay for this specific Purveyors product.

The detailed evidence, freshness contract, two-PR sequence, stop points, and pilot metrics live in [coffee-app #482](https://github.com/reedwhetstone/coffee-app/pull/482).

## Recommendation

Proceed with the smallest coherent personalized MVP in coffee-app #482 after the provenance-aware publication reader cutover. It should capture a real sourcing intent, apply trustworthy indexed evidence, and present a short current result through the personalized dashboard and agent surface, with evidence links and natural next actions such as inspect, ask, watch, or shortlist. The three-partner, four-week pilot is a validation and measurement loop around that product, not a manual-only qualification surface. Keep external delivery, scheduled recurring briefs, autonomous purchasing, RFQs, generalized procurement operations, and new opaque scoring deferred.

## Product-conviction correction, 2026-07-18

The MVP must be a minimum complete value loop, not a qualification surface that makes customers responsible for proving whether Purveyors helped them. Falsifiability belongs in the product analytics and internal checkpoints; it should not become the primary customer experience.

The initial product should fulfill the core promise on day one: a customer supplies a real sourcing intent, Purveyors continuously applies trustworthy market evidence to it, and the personalized dashboard and agent surface present a short, current, explainable set of lots worth inspecting. Natural product actions such as opening evidence, asking Parchment a follow-up, viewing the supplier, watching or shortlisting a lot, and returning to the workflow provide the behavioral evidence. Optional dismissal or freshness feedback can improve the system, but the customer should not encounter a research questionnaire as the product.

This changes the MVP boundary from “manual test route plus disposition collection” to “smallest coherent personalized sourcing product with passive measurement.” Self-service intent capture or an equivalent conversational setup, personalized dashboard discovery, agent access to the canonical Radar result, trustworthy evidence, and useful next actions are core. Schedulers, external delivery, autonomous purchasing, RFQs, generalized procurement operations, and new opaque scoring remain excluded.

The governing distinction is: minimum scope, complete promise. The MVP can contain very few capabilities, but the capabilities it ships must make Purveyors feel like an agent that knows the buyer and helps them discover relevant coffee, not a pilot harness asking the buyer to validate a hypothesis.

## External patterns

- Mintec Analytics packages commodity price data, forecasts, and market intelligence around purchase timing and procurement decisions: https://www.mintecglobal.com/essential-intelligence-for-procurement-professionals
- Greensquare focuses green-coffee software on planning, budgeting, forecasting, and reducing purchasing risk: https://www.greensquare.co/
- Algrano owns contracting, freight, financing, and logistics rather than merely listing coffee: https://algrano.com/
