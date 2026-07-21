# Proposal: Purveyors Coffee Intent Exchange

_Created: 2026-05-07_
_Status: Proposal_
_Domain: Purveyors ecosystem_
_Canonical source: this repo_

## One-line thesis

Turn Purveyors from a supply-side coffee intelligence platform into the first machine-readable demand graph for green coffee by letting roasters publish structured buy intents that Purveyors can match against live catalog, proof, price, and supplier data.

## Why this matters

Purveyors currently sees the market mostly from the supply side: supplier listings, price tiers, stock status, processing claims, certifications, proof evidence, and public analytics. That is already valuable, but it misses the most monetizable signal in a fragmented market: what buyers are trying to source before they succeed or give up.

The existing moonshots each strengthen a different side of the platform:

- Procurement Brief packages market movement into a paid intelligence product.
- Open Coffee Listing Standard asks suppliers to publish structured inventory.
- Copilot Network turns Purveyors into the agent layer for coffee buyers.
- Proof Layer makes trust and evidence machine-readable.

The missing layer is buyer intent. If Purveyors can capture demand before transactions happen, it stops being just a better catalog and becomes market infrastructure. It can answer not only "what coffees exist?" but "what is the market looking for right now, what supply is missing, and who should meet whom?"

## Why now

Several internal assets make this newly plausible:

- The scraper has enough supplier coverage and audit discipline to represent the live supply landscape credibly.
- The canonical `/v1/catalog` direction, public analytics gate, price index endpoint work, and proof-passport work create a supply-side data substrate that can score and explain matches.
- The CLI is now a first-class machine surface with manifest, structured output, headless auth, and exported functions. That matters because intent capture should work for agents, not just browser users.
- Catalog access-level work already separates proof from leverage. Structured intent matching is leverage, which gives it a natural member/API product boundary.
- Recent proof, certification, process transparency, and freshness work means matches can be constrained by trust requirements, not just origin and price.

External market signals point the same way:

- Grand View Research estimates procurement software at $10.06B in 2025, growing to $21.29B by 2033, with procurement platforms becoming AI-powered ecosystems for real-time visibility and strategic insight: https://www.grandviewresearch.com/industry-analysis/procurement-software-market-report
- Gartner reported in March 2026 that 67% of B2B buyers prefer a rep-free experience, and 45% used AI during a recent purchase, suggesting more buying work is becoming self-directed and digitally mediated: https://www.gartner.com/en/newsroom/press-releases/2026-03-09-gartner-sales-survey-finds-67-percent-of-b2b-buyers-prefer-a-rep-free-experience
- Gartner also forecasts task-specific AI agents in 40% of enterprise applications by the end of 2026, and agentic AI supply-chain software spend growing to $53B by 2030: https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025 and https://www.gartner.com/en/newsroom/press-releases/2026-04-07-gartner-forecasts-supply-chain-management-software-with-agentic-ai-will-grow-to-53-billion-in-spend-by-2030
- Commodity intelligence platforms such as Vesper package pricing, supply/demand, forecasts, alerts, and dashboards as decision infrastructure. Purveyors can do a narrower specialty-coffee version with a demand graph attached: https://vespertool.com/commodities/platform/
- Stripe's 2025 vertical SaaS benchmark argues that multiproduct vertical platforms have much larger addressable markets and faster growth, while AI and payments are expansion plays. A demand exchange creates a plausible path from data subscription to workflow, lead generation, and eventually transaction infrastructure: https://stripe.com/us/lp/vertical-saas-benchmark-2025

The timing is interesting because Purveyors has enough supply-side structure to make matching credible, while B2B buying behavior is drifting toward self-directed, AI-mediated workflows that need machine-readable offers and governed action surfaces.

## Existing assets this leverages

- **coffee-app**: public catalog, analytics gate, subscription/funnel architecture, `/v1/catalog`, access-level ADR, price index endpoint work, proof summary direction, docs and blog surfaces.
- **purveyors-cli**: agent-friendly manifest, JSON output, headless auth, catalog search/get/stats/similar commands, shared exported functions consumed by the app.
- **coffee-scraper**: live supplier coverage, price tiers, stock/freshness tracking, processing transparency fields, certifications contract, proof evidence, supplier health and audit loops.
- **Existing moonshots**: Procurement Brief provides the intelligence packaging pattern; Listing Standard provides supplier-side participation; Copilot Network provides the agent-facing workflow frame; Proof Layer provides trust constraints for matching.

## The concept

Build Purveyors Coffee Intent Exchange: a structured buyer-intent layer for green coffee sourcing.

A roaster, buyer, consultant, or agent publishes an intent object instead of manually browsing every supplier site. The intent might say:

- target origin, country, region, cultivar, process, drying method, certification, score, flavor direction, or substitutions
- desired quantity, acceptable pack sizes, delivery window, freshness requirements, and price band
- required proof threshold, such as disclosed processing, producer evidence, recent stock confirmation, or certification confidence
- willingness to consider substitutions, wholesale minimums, direct supplier contact, or future arrivals
- whether the buyer wants a private recommendation, supplier introduction, recurring alert, or agent-managed watch

Purveyors then matches that intent against the live catalog, proof layer, price index, and supplier freshness signals. The product surfaces a ranked match packet:

1. **Immediate matches**
   Coffees currently visible in the catalog that satisfy the intent, with proof warnings, price context, and supplier caveats.

2. **Near misses**
   Coffees that almost match, such as right origin but stale arrival date, right process but weak proof, or right price but wholesale-only minimums.

3. **Substitution suggestions**
   Adjacent origins, suppliers, processes, or lots that satisfy the business goal even if they miss the literal query.

4. **Unfilled demand signal**
   If the market has no good answer, Purveyors records that gap as anonymized aggregate demand.

5. **Supplier-side demand feed**
   Participating suppliers can see aggregated, anonymized demand windows, for example: "12 small roasters are looking for 5 to 25 bags of washed Kenya or Kenya-like coffees under $8.50/lb in the next 45 days, with disclosed arrival date and producer identity." Suppliers can respond with existing listings, direct feed updates, or upcoming lots.

6. **Agent-native action surface**
   A future CLI/API surface could expose intent submission and matching as `purvey intent create`, `purvey intent match`, or `/v1/intents`. A buyer's agent could maintain recurring intents, generate a weekly match packet, and request human approval before any external contact.

The key product shift is that demand becomes a first-class data asset. Every private sourcing search can improve the aggregate market picture without exposing buyer identity or private commercial strategy.

## Strategic upside

- **Revenue:** Adds a paid member/API workflow beyond browsing: recurring intent monitoring, match packets, supplier demand access, premium alerts, and eventually lead-generation or transaction fees.
- **Growth / funnel:** A free or low-friction "tell Purveyors what you are trying to source" flow can convert lurkers who do not want to learn the catalog. Suppliers get a reason to claim profiles because demand is visible.
- **Defensibility:** Combines supply data, proof data, buyer demand, and agent workflows. Competitors can copy a catalog UI more easily than a two-sided intent graph with historical match outcomes.
- **Product positioning:** Moves Purveyors from "coffee data and tools" toward "the routing layer for specialty coffee sourcing decisions."

## Why this could be a great idea

This turns Purveyors' biggest structural weakness into a moat. Scraping supply is powerful, but it remains a derivative view of supplier websites. Demand intent is proprietary because it comes from the workflows Purveyors owns. Once buyers submit intents and suppliers respond, Purveyors can see mismatches the public market cannot see: origins with latent demand, processes that buyers want but suppliers under-disclose, price bands with no supply, certifications that matter commercially, and substitution paths that repeatedly work.

It also creates a cleaner GTM wedge than a generic marketplace. Instead of asking buyers to switch procurement behavior all at once, the first promise is simple: state the sourcing problem once and receive better matches than manual supplier browsing. Instead of asking suppliers to join another marketplace, the first promise is sharper: see anonymized demand you cannot see from your own web analytics.

## Why this could be a terrible idea

This can collapse into marketplace theater. Capturing intents without enough buyer liquidity creates stale requests. Giving suppliers demand visibility without trusted suppliers creates spam and relationship risk. If Purveyors drifts into brokering transactions too early, it inherits operational, legal, support, and trust problems that the current product is not built to handle.

The biggest strategic risk is that coffee buying may remain relationship-led at the valuable end of the market. If buyers treat public intent submission as too sensitive, the graph never forms. A bad supplier match or careless disclosure of demand could also damage trust faster than a weak analytics feature would.

## Cheapest proving experiment

Run a concierge "intent matching" pilot without building the exchange.

1. Create a private intake prompt or form for 10 to 20 serious home roasters, micro-roasters, or consultants.
2. Ask each participant for one real sourcing intent with quantity, price band, target profile, timing, and hard constraints.
3. Manually match each intent against existing Purveyors catalog, proof, price, and freshness data.
4. Return a one-page match packet with immediate matches, near misses, substitution logic, and proof warnings.
5. Track three signals: whether the buyer says the packet saved real sourcing time, whether they ask for recurring monitoring, and whether any supplier would pay or participate to see anonymized demand.

Validation threshold: at least 5 of 10 buyers say they would pay for recurring intent monitoring or submit another real intent, and at least 2 suppliers express interest in receiving aggregated demand signals.

Falsification threshold: buyers refuse to provide actionable intent, matches are not better than manual browsing, or suppliers view aggregated demand as low-value noise.

## What would need to be true

- Buyers must be willing to disclose sourcing needs privately if identity and commercial details are protected.
- The live catalog and proof layer must produce match packets that are meaningfully better than generic search.
- Suppliers must value demand signals enough to claim profiles, improve feeds, or respond to matched opportunities.
- Purveyors must preserve trust by keeping early workflows human-approved and avoiding automatic outbound supplier contact.
- Privacy, antitrust, broker licensing, and commercial agency boundaries must be understood before any transaction or supplier-routing layer is monetized.
- Demand signals must aggregate safely. A small number of buyers in a niche origin could accidentally reveal strategy if the product is careless.

## Cross-product implications

- **coffee-app:** Adds an intent capture and match-packet surface, likely member-gated after a limited teaser. Future implementation would need an intent object model, buyer privacy settings, match history, and supplier-demand views.
- **purveyors-cli:** Adds a natural agent workflow: create recurring intents, fetch matches, inspect proof, and prepare human-approved supplier outreach. The manifest would need intent commands and capability metadata.
- **coffee-scraper:** Becomes more valuable because unmatched demand can prioritize source onboarding, field extraction, proof backfills, and supplier freshness audits.
- **API:** Creates a new endpoint family around intent creation, matching, and recurring watches. API tiers can monetize machine-to-machine procurement workflows.
- **Blog / public positioning:** Creates strong thought leadership: specialty coffee has public supply lists but no demand graph; agentic buying makes structured intent an asset.
- **Existing moonshots:** Strengthens Listing Standard by giving suppliers a reason to publish; strengthens Copilot Network by giving agents a concrete job; strengthens Proof Layer by making trust thresholds part of matching.

## Source-of-truth routing

- Original workspace pointer: `brain/moonshots/2026-05-07-purveyors-coffee-intent-exchange.md`
- If promoted: product strategy note in `brain/projects/` plus implementation plans in `repos/coffee-app/notes/implementation-plans/`, a coffee-app ADR for privacy/access-level rules, and CLI/API follow-up notes in the relevant repos.
- Product repo mirror or PR: n/a

## Recommendation

Explore this as a concierge validation experiment, not as a build plan yet. The upside is large because demand data could become Purveyors' hardest-to-copy asset, but the first step should prove that buyers will share real sourcing intent and that Purveyors can return match packets valuable enough to justify recurring use.
