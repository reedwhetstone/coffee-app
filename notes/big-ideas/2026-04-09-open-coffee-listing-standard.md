# Proposal: Purveyors Network, the Open Coffee Listing Standard

_Created: 2026-04-09_
_Status: Proposal_

## One-line thesis
Turn Purveyors from a scraper-backed catalog into the default structured listing standard for green coffee, where suppliers publish inventory once and every roaster, app, CLI workflow, and AI agent can discover, compare, and act on it.

## Why this matters
Right now the market is fragmented, relationship-gated, and structurally hard to compare. Purveyors already proves the demand side of the problem: buyers want normalized coffee data, public analytics, and machine-readable access. But scraping alone caps the business. It keeps Purveyors in the role of intelligent observer.

The bigger play is to become part of the market's operating infrastructure.

If suppliers start treating Purveyors as the place to publish structured inventory, not just the place that scrapes it, the business changes shape:
- the data gets fresher and deeper
- the scraper becomes bootstrap + verification infrastructure instead of the whole moat
- roasters get a trusted comparison and procurement layer
- agents get a canonical machine interface for coffee sourcing
- Purveyors becomes harder to displace because it owns the schema, distribution, and workflow layer

This is the Zillow / MLS move, but for green coffee and for agent-native buyers.

## Why now
Several product assets have quietly lined up for this:

- The scraper already covers 41 suppliers, which is enough to bootstrap the market surface and show suppliers what a normalized listing looks like.
- The app already has a public catalog, public analytics, authenticated workflows, and deeper operational surfaces for inventory, roast, and sales.
- The API direction is explicit and the CLI is now becoming a reliable machine contract, which matters if agents are real customers.
- The recent product and blog direction keeps reinforcing the same thesis: structured, authoritative context wins when markets are fragmented and relationship-gated.
- The existing Procurement Brief proposal is a strong revenue product, but it is still downstream packaging of the data moat. This idea moves upstream and tries to own the distribution standard itself.

The moment feels right because Purveyors now has enough supply-side coverage to seed the network and enough product narrative to explain why the network should exist.

## Existing assets this leverages
- coffee-app: public catalog, public analytics, authentication, billing surface, inventory / roast / sales workflows, mobile-first shell work, conversational UX direction
- purveyors-cli: machine-readable manifest, structured JSON error envelopes, headless auth, reusable business logic, agent-friendly command surface
- coffee-scraper: 41 live suppliers, normalized schema, LLM-assisted extraction, daily monitoring, direct-vs-browser collection strategy, verification backstop for supplier-published data
- blog / API / data moat / agent workflows: public writing on coffee data scarcity and agent-native product surfaces, canonical `/v1/catalog` direction, disclosure-quality framing, trust in Purveyors as the neutral data layer

## The concept
Build a supplier-side publishing and verification layer on top of the current catalog.

Instead of treating suppliers only as pages to scrape, Purveyors lets them claim their catalog presence and publish structured inventory directly into the network.

Core pieces:

1. **Claimed supplier profiles**
   - A supplier claims its presence on Purveyors.
   - It gets a lightweight console to verify core business info, manage feed settings, and see how its listings appear.

2. **Direct listing feeds**
   - Suppliers can publish via CSV upload, simple JSON feed, API endpoint, or eventually through the CLI.
   - Purveyors validates the feed against a canonical listing schema.
   - Direct feeds get a visible "verified" or "direct from supplier" badge.

3. **Disclosure-quality as a product primitive**
   - Purveyors scores listings and suppliers on structured disclosure quality: arrival date, provenance depth, cultivar, cup score, freshness, pricing tiers, and other decision-critical fields.
   - Better disclosure earns better visibility, better trust, and better distribution.

4. **Buyer-side procurement workspace**
   - Buyers get watchlists, supply-change alerts, RFQ-style workflows, and eventually approval-gated purchase recommendations.
   - The network is not just searchable inventory. It is a decision-and-action layer.

5. **Agent-native access**
   - Every verified listing is available through the same schema across app, API, and CLI.
   - An internal or external agent can answer questions like "show me verified fresh-crop Ethiopians under $8.20/lb with direct arrival metadata" and then prepare an RFQ or recommendation packet.

6. **Scraper as market coverage and audit infrastructure**
   - The scraper does not go away.
   - It seeds the public graph, discovers suppliers before they join, detects divergence between public site and direct feed, and keeps Purveyors from becoming a self-reported black box.

This makes Purveyors a hybrid of catalog, intelligence layer, publishing standard, and procurement control plane.

## Strategic upside
- Revenue:
  - Supplier-side subscriptions for claimed profiles, feed tooling, analytics, and premium distribution
  - Buyer-side subscriptions for watchlists, alerts, briefs, and procurement workflows
  - Potential RFQ / transaction / lead-routing take rates later
- Growth / funnel:
  - Public listings and supplier pages expand SEO and distribution
  - Suppliers have an incentive to bring traffic to their Purveyors presence
  - Verified listings create a stronger public proof-of-value loop than scraped listings alone
- Defensibility:
  - The moat shifts from "we scrape more sites" to "the market publishes through our schema and buyers operate through our workflow"
  - Direct-feed history plus scrape verification plus buyer behavior becomes a much stronger data asset than supplier pages alone
  - Agent-native command surface makes Purveyors the easiest platform for third-party automation to adopt
- Product positioning:
  - Purveyors stops looking like a better catalog and starts looking like the operating system for coffee sourcing intelligence
  - It aligns with the long-term product vision better than a generic marketplace or a standalone roast tracker

## Why this could be a great idea
It compounds almost every asset that already exists.

The scraper gives initial supply. The catalog gives visibility. The analytics layer gives proof that normalized comparison is useful. The API and CLI give machine access. The buyer workflows give a reason to stay after discovery. The blog and public thinking give a strong narrative for why this infrastructure should exist.

Most importantly, it changes the strategic role of scraping. Scraping is excellent for bootstrapping a market map. It is not a perfect long-term control point. A publishing standard is.

If this works, Purveyors becomes the interface layer between suppliers, buyers, and agents. That is the kind of wedge that can support multiple businesses later: intelligence subscriptions, workflow software, supplier tooling, embedded APIs, and transaction surfaces.

## Why this could be a terrible idea
It is a two-sided-market and behavior-change bet.

Suppliers may not want more comparison transparency. They may see structured disclosure as commoditizing their relationship advantage. Roasters may like the data but still buy through old relationship channels. Purveyors could end up spending a lot of energy trying to create a standard that incumbents have weak incentive to adopt.

There is also a risk of premature platform ambition. Building supplier tooling, buyer workflows, feed validation, and neutral-market governance too early could distract from the simpler products that monetize the existing data asset first.

## Cheapest proving experiment
Do not start with a full network. Start with a claim-and-verify pilot.

1. Add a "Claim this supplier" path for 3 to 5 friendly or promising suppliers already in the scraped catalog.
2. Offer a dead-simple direct-feed template: CSV or JSON upload, no heavy integration.
3. Give claimed suppliers a verified badge and richer public profile.
4. Track whether direct-feed suppliers provide meaningfully better metadata freshness, richer field coverage, and better buyer engagement than scrape-only suppliers.
5. For buyers, expose a single high-value filter: "verified direct listings only."

If suppliers adopt the claim flow and buyers prefer verified inventory, there is a real network kernel. If they do not, the idea probably dies before consuming too much roadmap.

## What would need to be true
- Suppliers must believe Purveyors gives them distribution, trust, or workflow leverage they do not get from their own sites alone.
- Buyers must value verified freshness and structured metadata enough to change behavior.
- Purveyors must remain neutral enough that both sides trust the platform's ranking and disclosure rules.
- The canonical schema has to be genuinely useful, not just technically clean.
- The scraper has to keep working as bootstrap and audit infrastructure even as direct feeds grow.
- The app, CLI, and API have to stay behaviorally consistent so agent and developer adoption feels easy.

## Cross-product implications
- App:
  - Supplier claim flows, verified supplier pages, disclosure scoring, direct-listing filters, watchlists, RFQ workflows, procurement alerts
- CLI:
  - Feed validation and publish commands for suppliers, verified-only search for buyers, watchlist and procurement automation commands for operators and agents
- Scraper:
  - Shifts toward discovery, verification, freshness auditing, and market-coverage expansion instead of being the only ingestion path
- API / agent layer:
  - Canonical listing schema becomes the product; third-party agents and apps integrate against a stable market surface instead of a best-effort scraped one

## Recommendation
Explore it further.

This is the highest-upside strategic idea because it turns current assets into market infrastructure instead of just a strong application. It should not replace near-term monetization work like the Procurement Brief. But it is exactly the sort of bigger, riskier, potentially category-defining direction worth validating now with a tiny supplier-claim pilot.
