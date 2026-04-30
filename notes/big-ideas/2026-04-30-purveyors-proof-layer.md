# Proposal: Purveyors Proof Layer

_Created: 2026-04-30_
_Status: Proposal_

## One-line thesis

Turn Purveyors into the machine-readable trust layer for specialty coffee lots, issuing disclosure passports that verify what a listing claims about process, provenance, freshness, producer identity, and regulatory risk.

## Why this matters

Purveyors is already strongest where the coffee market is weakest: turning inconsistent supplier copy into comparable, provenance-aware data. Recent work on structured processing fields, disclosure levels, producer evidence extraction, and catalog access tiers points at a bigger opportunity than search.

The specialty market does not only need more listings. It needs a way to know which claims can be trusted.

That matters because specialty coffee is moving into a world where claims are becoming more valuable and more dangerous:

- co-fermentation and additive processing make vague processing labels commercially risky
- producer and farm identity influence price, story, and customer trust, but are inconsistently disclosed
- arrival, stock, and price freshness drive buying decisions, but supplier pages rarely expose them in structured form
- regulatory pressure, especially deforestation and traceability rules, is pushing buyers toward evidence-backed supply chain records
- agents and software integrations need explicit evidence envelopes, not narrative tasting notes

The bigger product idea is to package Purveyors' normalization, evidence capture, and disclosure scoring as a trust product, not just a catalog feature.

## Why now

Three internal assets have converged.

First, coffee-app just accepted the canonical direction that catalog data visibility and catalog search leverage are different products. That creates room for a paid trust layer above basic visibility: structured process facets, richer provenance, premium claims, and evidence-backed search belong behind membership or API tiers.

Second, coffee-scraper has moved from generic extraction toward evidence-aware quality systems. Processing transparency fields are now persisted, and producer evidence extraction is active work. That means Purveyors can increasingly distinguish between "supplier said this," "the model inferred this," "this was normalized from a field," and "this is not disclosed." That distinction is the basis of a proof product.

Third, external timing is favorable. The EU deforestation regulation now explicitly covers coffee and requires due diligence with traceability to production plots for relevant commodities. Digital Product Passport work in Europe is also pushing product categories toward interoperable machine-readable records. Whether or not Purveyors directly serves EUDR compliance on day one, the market direction is clear: trustworthy structured product evidence is becoming infrastructure.

This idea also avoids repeating the last three moonshots. The Procurement Brief packages market movement. The Open Coffee Listing Standard makes suppliers publish structured inventory. The Copilot Network turns Purveyors into an agent operating layer. The Proof Layer is narrower and more defensible: it makes the trustworthiness of every coffee claim into a product primitive.

## Existing assets this leverages

- coffee-app: canonical `/v1/catalog`, public catalog, access-tier ADR, structured process fields, CoffeeCard disclosure display, analytics gates, API documentation, billing surface, blog narrative around processing transparency and data scarcity
- purveyors-cli: manifest-first machine contract, catalog search/get/stats/similar commands, exported functions consumed by the app, headless auth, agent-friendly JSON output, role-aware command surface
- coffee-scraper: 42 live suppliers, LLM cleaning pipeline, COLUMN_SCHEMA-driven extraction, Zod validation, provided-vs-extracted field policy, processing transparency persistence, producer evidence extraction, supplier audit discipline
- blog / API / data moat / agent workflows: public authority on co-fermentation transparency, metadata scarcity, agent-native product surfaces, docs-as-code strategy, and API-first coffee intelligence

## The concept

Build Purveyors Proof Layer: a claims, evidence, and trust passport system for green coffee lots.

Every catalog entry gets a structured proof object that says not just what the coffee is, but how Purveyors knows it.

A passport might include:

1. **Processing proof**

   - base method, fermentation type, additives, duration, drying method, and disclosure level
   - explicit distinction between disclosed, inferred, missing, and contradictory processing claims
   - evidence availability without exposing raw copyrighted supplier text by default

2. **Provenance proof**

   - producer, farm, mill, cooperative, region, country, altitude, cultivar, lot name, and exporter/importer context
   - confidence levels for each entity
   - whether the data came from a structured field, supplier prose, repeated catalog pattern, or direct supplier feed

3. **Freshness and availability proof**

   - first seen, last seen, arrival date, delisting date, stock status, price tiers, wholesale threshold, and supplier update cadence
   - divergence detection when a supplier page changes or a claimed field disappears

4. **Claim quality score**

   - not a vague coffee quality score
   - a disclosure-quality score based on completeness, evidence strength, freshness, consistency, and buyer relevance
   - separate scores by claim family: process, provenance, price, availability, regulatory traceability

5. **Machine-readable passport**

   - exposed through `/v1/catalog/:id/proof` or an additive `proof` projection
   - mirrored through `purvey catalog get --include-proof` and API field selection
   - designed for agents, buyers, auditors, and downstream product pages to cite safely

6. **Public trust badge and private evidence room**

   - public catalog cards can show badges such as "process disclosed," "producer identified," "freshness verified," or "limited evidence"
   - members and API customers can inspect richer proof summaries
   - suppliers can eventually claim a listing and upload stronger evidence, but the product does not require direct supplier adoption to start

The key move is that Purveyors stops treating missing metadata as a cleanup problem and starts treating evidence quality as commercial infrastructure.

## Strategic upside

- Revenue:
  - paid member search by proof quality, not just coffee attributes
  - API tier upsell for proof projections, evidence confidence, and claim-quality filtering
  - supplier-side premium profile or verification products later
  - compliance-adjacent packages for roasters who need auditable sourcing records
- Growth / funnel:
  - public badges make the data moat visible without exposing all premium leverage
  - blog posts can turn messy industry controversies into concrete product demos
  - roasters can share proof-backed coffee pages with customers, wholesale clients, or internal buyers
- Defensibility:
  - evidence history compounds over time and is harder to copy than a single scraped snapshot
  - confidence and disclosure scoring improve as supplier coverage, audits, and direct feeds accumulate
  - agent workflows prefer explicit trust envelopes over generic narrative data
- Product positioning:
  - Purveyors becomes the neutral trust interpreter for green coffee listings
  - the product moves from "find coffee" to "know what claims are safe to act on"

## Why this could be a great idea

It turns Purveyors' current operational pain into a moat.

Every scraper audit, extraction fix, processing taxonomy change, and producer parsing improvement creates a better proof graph. Competitors could scrape listings, but rebuilding longitudinal evidence history, source-specific disclosure behavior, field-level confidence, and claim provenance would be slow.

It also gives Purveyors a clean paid feature boundary. Anonymous users can see that proof exists. Viewers can inspect some trust signals. Members, API customers, and agents pay for leverage: proof filtering, confidence thresholds, evidence summaries, watchlists, exports, and compliance-adjacent records.

Most importantly, the product has a sharp narrative. Specialty coffee has been arguing about transparency as culture. Purveyors can make it infrastructure.

## Why this could be a terrible idea

It may sound like compliance software before Purveyors has the authority, coverage, or customer trust to sell compliance software.

That is the main trap. If the product promises regulatory assurance too early, it inherits legal expectations it cannot satisfy. The right first version must be careful: this is evidence-backed coffee intelligence, not certification, legal due diligence, or a substitute for supplier documentation.

There is also a supplier-politics risk. Publicly scoring disclosure quality could annoy suppliers whose listings look thin. If handled badly, Purveyors could look like an adversarial scraper rather than a neutral translator of public information.

## Cheapest proving experiment

Run a proof-layer pilot on 100 coffees across 5 suppliers.

1. Pick suppliers with different metadata styles: one high-disclosure microlot source, one conventional retail supplier, one wholesale importer, one Shopify generic source, and one source with noisy prose.
2. Generate proof passports from existing fields plus scraper evidence envelopes for process, producer, arrival/freshness, and price-tier claims.
3. Add a static internal report ranking the 100 coffees by claim quality and listing the most common evidence gaps.
4. Manually review 20 passports for hallucinated certainty, missing nulls, and misleading confidence.
5. Turn the best 10 passports into a private demo page or markdown packet for Reed review.

Success is not "the badges look nice." Success is whether the proof object reveals decision-grade differences that ordinary catalog browsing hides.

## What would need to be true

- The scraper must preserve enough evidence metadata to support field-level confidence without republishing raw supplier copy.
- The proof object must be additive and backward-compatible with `/v1/catalog`.
- Claim scoring must reward disclosure and freshness, not moralize supplier quality.
- The UI must explain uncertainty plainly: disclosed, inferred, not disclosed, conflicting, stale.
- Purveyors must avoid legal overclaiming. Proof passports are intelligence artifacts until a later verified-supplier or compliance partner product exists.
- Members and API users must value trust filters enough to pay for them.

## Cross-product implications

- App:
  - CoffeeCards gain compact trust badges and proof summaries.
  - Member catalog search can filter by claim quality, disclosure level, producer-identified lots, process-disclosed lots, and freshness confidence.
  - Admin/review tools can inspect evidence gaps and flag suspicious claims.
- CLI:
  - Add `purvey catalog get <id> --include-proof`, `purvey catalog search --min-proof-score`, and machine-readable proof summaries.
  - Agents can require confidence thresholds before recommending a coffee.
- Scraper:
  - Evidence capture becomes first-class: field source, extraction path, confidence, freshness, and contradiction detection.
  - Audits shift from null-rate warnings toward claim-quality and proof-coverage metrics.
- API / agent layer:
  - `/v1/catalog` gains an optional proof projection or sibling proof endpoint.
  - API tiers can monetize proof fields, confidence filters, and exports.
  - Agent recommendations can cite why a claim is trustworthy instead of simply repeating catalog text.

## Recommendation

Explore it further, but keep the first version explicitly intelligence-oriented rather than compliance-certified.

The Proof Layer is risky because it touches legal, supplier relationship, and trust territory. That is also why it is worth exploring. If Purveyors can become the system that tells buyers which coffee claims are safe to act on, it earns a stronger position than a catalog, brief, or chatbot alone.

## References

- EU deforestation regulation overview: https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en
- EU Digital Product Passport policy context: https://commission.europa.eu/energy-climate-change-environment/standards-tools-and-labels/products-labelling-rules-and-requirements/sustainable-products/ecodesign-sustainable-products-regulation_en
- Specialty Coffee Association traceability framing: https://sca.coffee/value-assessment
- GS1 product data and traceability standards: https://www.gs1.org/standards/traceability
