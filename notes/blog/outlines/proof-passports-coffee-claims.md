# Outline: What If the Next Coffee Marketplace Unit Is Evidence, Not Listings?

**Pillar:** api-architecture
**Target:** 1,200 words max (standard post ceiling)
**Status:** outlined
**Source material:**
- `notes/PRODUCT_VISION.md`
- `notes/BLOG_STRATEGY.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/004-processing-transparency-schema-api.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/big-ideas/2026-04-30-purveyors-proof-layer.md`
- `notes/implementation-plans/2026-05-01-catalog-proof-summary-seed.md`
- `src/lib/catalog/proofSummary.ts`
- `src/lib/catalog/proofCoverage.ts`
- `src/lib/server/catalogResource.ts`
- `src/lib/docs/content.ts`
- `repos/coffee-scraper/notes/implementation-plans/2026-05-01-proof-passport-pilot.md`

## Thesis

Specialty coffee treats the listing as the atomic unit of the market, but the scarce object is no longer the listing. It is the evidence envelope behind the claim: who produced it, what process was disclosed, when the coffee arrived, whether price is public, and what parts are still unknown.

The counterintuitive angle: better marketplaces may not win by showing more inventory. They may win by making every claim machine-readable enough to be trusted, filtered, and acted on by humans and agents without pretending to certify what they cannot verify.

## Voice Constraints

- Short and punchy. Standard post ceiling is 1,200 words, despite older outline-template language that allowed 1,500-2,000.
- Gladwell/Freakonomics framing: open with the wrong unit of analysis, then flip from listings to evidence.
- No salesmanship, no narrative arc. Do not pitch Purveyors as the hero. Use it as one concrete implementation example.
- Data and analysis over narrative. Cite internal coverage numbers and exact proof-summary behavior.
- 1-2 external citations max. Use them only to ground the broader market shift toward traceable product evidence.
- Keep compliance language cautious. This is disclosure intelligence, not certification, legal assurance, EUDR compliance, or supplier verification.
- No em dashes.

## Verification Checklist

- [ ] Confirm current `/v1/catalog` docs still describe `include=proof`, `/v1/catalog/proof-coverage`, `raw_evidence_not_included`, and proof limitations.
- [ ] Confirm `src/lib/catalog/proofSummary.ts` still uses four families: process, provenance, freshness, pricing.
- [ ] Confirm CoffeeCard proof badges still use cautious labels such as `Process disclosed`, `Provenance identified`, `Freshness dated`, `Tiered pricing`, and `Price listed`.
- [ ] Confirm raw `processing_evidence` is still withheld from public catalog responses and only `process.evidence_available` is exposed.
- [ ] Confirm proof coverage endpoint remains aggregate-only and does not expose row-level evidence or supplier rankings.
- [ ] Recheck scraper-side proof-readiness numbers before drafting. The May 1 planning sample said stocked rows had strong basic facts but weak proof-enabling fields: `processing_evidence` 106/1,923, `producer` 210/1,923, `arrival_date` 1,015/1,923, `processing_base_method` 600/1,923, and `processing_disclosure_level` 668/1,923.
- [ ] Verify source examples before using them. May 1 planning notes contrasted `captain_coffee` as high-disclosure with `cafe_imports`, `covoya`, `coffee_bean_corral`, and `sea_island` as different evidence-gap archetypes.
- [ ] Avoid saying Purveyors performs supplier verification, regulatory diligence, or certification unless a later product actually does.

## External References

1. European Commission, EUDR due diligence overview: https://green-forum.ec.europa.eu/nature-and-biodiversity/deforestation-regulation-implementation/understand-due-diligence_en
   - Use for the claim that coffee markets are moving toward documented, structured traceability. Key points to paraphrase: EUDR due diligence requires operators to collect product, supplier, country of production, legality evidence, and geolocation information before relevant products enter or leave the EU market; due diligence documentation must be kept for five years.

2. European Commission, Ecodesign for Sustainable Products Regulation and Digital Product Passport: https://commission.europa.eu/energy-climate-change-environment/standards-tools-and-labels/products-labelling-rules-and-requirements/ecodesign-sustainable-products-regulation_en
   - Use for the cross-industry analogy. Key point to paraphrase: the EU Digital Product Passport frames product data as a digital identity card that stores relevant product information to support sustainability, circularity, and compliance. Do not imply coffee is directly covered by DPP rules; use it as evidence of a broader product-data direction.

## Structure

### 1. The listing is the wrong atom (200 words)

Open with the familiar marketplace assumption: more listings equals more value. In green coffee, that is only partly true. A buyer can already see dozens of coffees with origin, process, tasting notes, and supplier copy. The problem is not merely scarcity of options. It is uncertainty about what each claim means and how much confidence to place in it.

Key turn: a listing says `Ethiopia natural, strawberry, arrived recently`. An evidence layer asks four different questions: who said that, what field or source supports it, when was it observed, and what is missing?

Make the HN-friendly abstraction explicit: this is the same product-design mistake as treating documents as the unit of search after embeddings arrive. The valuable unit becomes the claim plus provenance, not the page that contains it.

Internal grounding:
- Product vision: truthful green coffee data beats marketing copy.
- ADR-004: legacy `processing` collapsed too many meanings into one text field.
- ADR-005: data visibility and search leverage are different products.

### 2. Coffee claims have become too valuable to leave as prose (250 words)

Explain why this matters now. Process, provenance, freshness, and pricing are no longer decorative metadata. They influence buying decisions, customer trust, risk, and agent recommendations.

Use concrete examples:
- Co-fermentation and additive processing made vague process labels commercially loaded. `Natural`, `anaerobic`, `co-fermented`, and `fruit-infused` are not interchangeable buyer claims.
- Producer identity is not just story copy. It affects relationship value, repeat buying, lot comparison, and trust.
- Arrival date, stocked state, and price tiers are operational facts. A stale listing and a fresh listing can look identical if the market only stores marketing text.
- API and agent consumers need explicit signals. An agent cannot responsibly recommend a coffee by repeating supplier prose if the data model cannot tell disclosed from inferred from missing.

Bring in external context carefully:
- EUDR puts coffee inside a regulatory world where traceability, documentation, and production-location evidence matter.
- Digital Product Passport work shows the broader direction: products are gaining machine-readable evidence identities.

Do not overclaim. The line should be: specialty coffee can learn from this direction without pretending every catalog card is a compliance document.

### 3. A proof passport is a grammar, not a badge (300 words)

Define the proof passport in product terms. It is not a shiny trust badge and not a legal certificate. It is a grammar for saying what kind of evidence exists for each claim family.

Use the current Purveyors implementation as the concrete example:
- `process`: base method, fermentation type, additives, disclosure level, confidence, evidence availability.
- `provenance`: country, region, farm notes, supplier source, eventually stronger producer/farm/co-op entities.
- `freshness`: stocked date, arrival date, last updated, currently stocked.
- `pricing`: price per pound, price tiers, wholesale classification.

Then map labels to caution:
- `disclosed` is not `certified`.
- `identified` is not `verified identity`.
- `dated` is not `fresh`.
- `tiered` is not `fair price`.
- `not_available` is not necessarily supplier failure.

Use exact limitation vocabulary from the code/docs: `not_certification`, `raw_evidence_not_included`, `supplier_verification_not_performed`.

This section should be the intellectual center: the product breakthrough is not scoring everything. It is refusing fake precision. A good proof layer preserves uncertainty in a form humans and software can use.

### 4. The moat is the gap report (250 words)

Flip the usual marketplace ranking logic. The first value of proof passports may not be showing strong badges. It may be making absence visible.

Use May 1 scraper planning numbers as the data anchor, after rechecking before draft:
- Basic facts looked strong in the sample: process present for 90.9% of stocked rows, country plus region for 89.9%, stocked plus scraped date for 98.8%.
- Proof-enabling fields were much weaker: processing evidence 5.5%, named producer 10.9%, arrival date 52.8%, structured process base method 31.2%, disclosure level 34.7%.

Interpretation: the market is not empty. It is under-instrumented. That distinction matters. A weak proof field is not just a missing database value. It is a map of where supplier feeds, scraper evidence capture, direct relationships, and product education should improve next.

Use source archetypes from the scraper plan, not as a supplier takedown but as metadata-style contrast:
- Some suppliers disclose arrival dates and pricing well.
- Some have broad catalogs but private pricing.
- Some offer cup or origin data but thin producer identity.

The moat is longitudinal evidence history plus source-specific disclosure behavior. Competitors can scrape today’s page. It is harder to copy years of claim provenance, confidence, and gaps.

### 5. Search leverage comes after proof visibility (200 words)

Close with the product boundary. Public surfaces should show enough proof to make the dataset credible. Paid/member/API surfaces should unlock leverage: proof filtering, confidence thresholds, exports, alerts, procurement briefs, and agent policies.

Tie back to ADR-005:
- Anonymous/viewer users can inspect that the data is real.
- Members and API customers pay for methods that turn that data into decisions.
- The proof object should flow through the same canonical contract: web, `/v1/catalog?include=proof`, aggregate proof coverage, CLI, and agent workflows.

End with a restrained thesis, not a manifesto:

The next marketplace advantage may not be having the longest list of coffees. It may be having the clearest answer to a smaller question: which claims are safe to act on, and why?
