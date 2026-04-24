# Outline: What If the Real Marketplace Is the Listing Schema?

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/PRODUCT_VISION.md, repos/coffee-app/notes/BLOG_STRATEGY.md, repos/coffee-app/notes/big-ideas/2026-04-09-open-coffee-listing-standard.md, repos/coffee-app/notes/API_notes/API-strategy.md, repos/coffee-app/notes/decisions/002-api-first-external-internal-split.md, repos/coffee-app/src/lib/server/catalogResource.ts, repos/coffee-app/src/lib/docs/content.ts, repos/coffee-app/src/routes/api/catalog-api/+server.ts, repos/coffee-scraper/scrape/sources/index.ts, repos/coffee-scraper/scrape/sources/configs/shopify-configs.ts, repos/coffee-scraper/scrape/sources/configs/woocommerce-configs.ts

## Thesis
Most people look at a fragmented market and think the moat is aggregation: scrape more suppliers, build a better catalog, win on coverage. The stronger control point is usually lower in the stack. Once buyers, suppliers, and agents all depend on the same normalized listing object, the platform that defines the schema, validates the feed, and distributes the contract starts to shape the market itself.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: the counterintuitive claim is that the durable marketplace moat is not the scraper or storefront. It is the listing contract underneath them.
- No salesmanship, no network-effects hand-waving. Stay specific about the mechanism.
- Data and analysis over narrative. Use the real 41-source footprint, the canonical `/v1/catalog` contract, and disclosure-quality examples.
- 1-2 research citations only, each doing real work.
- Purveyors should illustrate the principle, not become the pitch.
- Every section earns its place. If a section does not sharpen the schema-as-market argument, cut it.

## Verification Checklist
- [ ] `repos/coffee-scraper/scrape/sources/index.ts` plus generic config files still resolve to 41 live sources, or update the count before drafting
- [ ] `repos/coffee-app/src/lib/server/catalogResource.ts` still defines `/v1/catalog` as the canonical namespace and still supports `anonymous`, `session`, and `api-key` auth kinds
- [ ] `repos/coffee-app/src/routes/api/catalog-api/+server.ts` still delegates to `/v1/catalog` with `Deprecation`, `Link`, and `Sunset` headers
- [ ] `repos/coffee-app/src/lib/docs/content.ts` still positions `/v1/catalog` as the stable public contract and the CLI as the account-linked surface
- [ ] The draft explicitly labels supplier claim flows, direct-feed publishing, verification badges, and disclosure scoring as proposed future work, not shipped product behavior
- [ ] If the draft mentions public catalog, public analytics, or current supplier footprint as proof-of-value, verify the live routes and current counts on publish day

## External References
1. **Gregory Lewis, "Asymmetric Information, Adverse Selection and Online Disclosure: The Case of eBay Motors"** (American Economic Review, 2011)
   URL: https://www.aeaweb.org/articles?id=10.1257/aer.101.4.1535
   Key quote: "disclosure is the single most important determinant of prices"
   Why it matters: supports the claim that structured listing detail is not cosmetic. Better disclosure changes buyer behavior and pricing outcomes.

2. **B. Douglas Bernheim and Jonathan Meer, "How Much Value Do Real Estate Brokers Add? A Case Study"** (NBER Working Paper 13796, 2008)
   URL: https://www.nber.org/papers/w13796
   Key quote: "the MLS is the most important service offered by real estate brokers"
   Why it matters: gives the clean cross-industry analogy. The strategic control point is often the listing network itself, not the service bundle wrapped around it.

## Structure
### Scraping Feels Like the Moat. It Isn’t. (~300 words)
Open with the obvious story: fragmented markets reward whoever aggregates the most supply. That story is directionally true but strategically incomplete. A scraper-backed catalog proves demand, exposes opacity, and makes the market legible, but it still leaves the platform in the role of observer.

Use Purveyors as concrete evidence, not pitch material:
- the scraper already normalizes inventory across 41 live coffee sources
- the app already exposes a public catalog and public-facing intelligence surface
- ADR-002 and the docs stack already push toward one shared machine contract across web, API, CLI, and agent consumers

Key move in this section: draw the distinction between **market map** and **market infrastructure**. Scraping builds the map. The winning platform often owns the infrastructure layer the map eventually gets published through.

### Listing Fields Decide What the Market Can Compare (~330 words)
This section explains why the schema matters so much. Markets do not just depend on inventory existing. They depend on buyers being able to compare the right attributes consistently.

Key points:
- in green coffee, decision-critical fields are things like arrival date, provenance depth, cultivar, processing, pricing tiers, freshness, and availability
- when sellers disclose these inconsistently, buyers fall back to relationship, vibes, and scattered PDF-level interpretation
- once those fields are normalized, the market stops comparing pages and starts comparing objects
- disclosure quality can become a first-class ranking and trust primitive instead of hidden supplier effort

Use the Lewis paper here to reinforce the mechanism: disclosure affects market outcomes. Connect that to Purveyors' prior scarcity/disclosure work without rehashing the entire earlier post.

Section goal: make the reader see that a schema is not just a database concern. It determines what buyers can even perceive as comparable.

### The MLS Lesson: The Interface Is Not the Whole Product (~320 words)
Use the real-estate analogy carefully. Zillow gets the attention, but MLS is the deeper infrastructure lesson. The product that looks like a search experience often sits on top of the more strategic asset: the standardized listing network.

Key points:
- Bernheim and Meer make the core point directly: the listing network is the valuable service layer
- the important shift is not “beautiful UI replaces brokers”; it is “shared listing infrastructure reorganizes the market around a common object”
- coffee has similar fragmentation: supplier-owned pages, relationship moats, uneven metadata, and no widely trusted canonical listing format
- a coffee platform that becomes the place suppliers publish structured inventory into is playing a different game than a platform that merely scrapes pages well

Tie this back to Purveyors' current architecture. `/v1/catalog` is already the beginning of a canonical market surface. The unshipped strategic leap is moving from canonical read contract to canonical publish contract.

### From Observer to Publishing Standard (~470 words)
This is the heart of the outline. Lay out the proposed kernel clearly and explicitly as future-state product strategy.

Core pieces to cover:
- claimed supplier profiles
- dead-simple direct feed paths: CSV, JSON feed, API, eventually CLI-assisted publishing
- canonical listing-schema validation
- visible "verified" / "direct from supplier" signaling
- disclosure-quality scoring as a product primitive
- one listing object available across app, API, CLI, and agent workflows
- scraper retained as bootstrap, discovery, and audit infrastructure rather than removed

Important framing:
- this is not a generic marketplace thesis
- it is a governance thesis about who defines the market object and who gets trusted to publish it
- the moat shifts from coverage alone to schema + validation + distribution + workflow
- agents matter because they amplify the value of one stable machine-readable contract; they do not replace the human adoption problem

This section should also surface the biggest risk honestly: suppliers may resist transparency because better comparison reduces relationship rents. That tension is part of why the idea is interesting.

### The Smallest Test That Would Prove It (~280 words)
Close with the cheap experiment from the strategy note, tightened into a clean operator test.

Suggested structure:
- 3-5 supplier claim-and-verify pilot
- one dead-simple publishing path, probably CSV or JSON upload
- richer profile plus verified badge for participating suppliers
- one buyer-side utility filter: verified direct listings only
- measure whether direct-feed suppliers produce fresher data, richer field coverage, and stronger buyer engagement than scrape-only suppliers

Final point: if suppliers will publish into the contract and buyers systematically prefer those listings, the schema is starting to become the market. If they will not, the idea fails early and cheaply.

The ending should feel like a reframe, not a pitch: the strategic question is not "can we scrape enough pages?" It is "can we become the contract this market trusts to publish through?"
