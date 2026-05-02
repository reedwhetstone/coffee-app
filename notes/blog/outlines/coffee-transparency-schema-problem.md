# Outline: What If Coffee Transparency Is a Database Schema Problem?

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** notes/decisions/004-processing-transparency-schema-api.md; notes/decisions/005-catalog-access-level-positioning.md; notes/blog/outlines/published/co-fermentation-exposed-coffees-real-transparency-gap.md; notes/blog/source-map.md; notes/pr-audits/2026-04-24-pr-289-processing-transparency-verify.md; notes/pr-audits/2026-04-29-pr302-vision-red-team.md; supabase/migrations/20260424_processing_transparency_fields.sql; supabase/schema.sql; coffee-scraper notes/pr-audits/2026-04-24-pr-208-processing-breakdown-rereview.md

## Thesis

The coffee industry keeps treating processing transparency as a vocabulary problem: define better labels, argue about co-fermentation, maybe add a richer description field. The counterintuitive point is that the market cannot reward transparency until transparency becomes a machine-readable contract: base method, fermentation type, additives, duration, disclosure level, confidence, and evidence, with null kept separate from explicit none.

## Voice Constraints

- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: creative angle, see ideas from unexpected places.
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Cite numbers and concrete evidence.
- 1-2 research citations that directly reinforce specific claims.
- Every section earns its place. If it does not deliver new insight, cut it.
- Purveyors appears only as the concrete implementation example, not the pitch.

## Verification Checklist

- [ ] Confirm ADR-004 fields still exist in `supabase/schema.sql`: `processing_base_method`, `fermentation_type`, `process_additives`, `process_additive_detail`, `fermentation_duration_hours`, `processing_notes`, `processing_disclosure_level`, `processing_confidence`, `processing_evidence`, and generated `processing_evidence_available`.
- [ ] Confirm `/v1/catalog` exposes a sanitized nested `process` summary while withholding raw `processing_evidence` by default.
- [ ] Confirm `has_additives=false` still means explicit `['none']`, not missing or undisclosed additives.
- [ ] Confirm current coverage numbers before drafting. ADR-005's 2026-04-29 anonymous sample: 1,058 rows; `processing_base_method` populated on 51 rows with 5 unique values; `fermentation_type` and `process_additives` populated on 0 rows; `processing_disclosure_level` populated on 54 rows with 3 unique values; `drying_method` populated on 435 rows with 74 raw values.
- [ ] Confirm current source count before using any supplier-scale claim. Source-map audit says scraper docs reported 41 live sources on 2026-04-26.
- [ ] Confirm process facets remain gated as search leverage under ADR-005 while process facts can still be displayed as trust proof.
- [ ] Confirm the draft does not repeat the co-fermentation post. This is a follow-up about schema as market infrastructure, not another taste/authenticity debate.

## External References

1. **Gregory Lewis, American Economic Review (2011), "Asymmetric Information, Adverse Selection and Online Disclosure: The Case of eBay Motors."**
   - URL: https://www.aeaweb.org/articles?id=10.1257/aer.101.4.1535
   - Key quote: "online disclosures are important price determinants"
   - Why it matters: disclosure is not cosmetic. In a market where buyers cannot inspect quality directly, structured seller disclosure affects prices and participation. Coffee processing metadata has the same market-structure problem: buyers cannot reward what suppliers do not disclose in comparable form.

2. **Specialty Coffee Association, Coffee Value Assessment.**
   - URL: https://sca.coffee/value-assessment
   - Key quote: "high-resolution picture of a specific coffee"
   - Why it matters: the SCA's own evaluation direction points toward multi-dimensional coffee value. The missing product layer is not another adjective-rich description. It is a data structure that can carry processing facts consistently across catalogs, APIs, search, and agent workflows.

## Structure

### 1. The wrong question is winning the argument (300-350 words)

Open by refusing the familiar co-fermentation frame. The loud argument is whether fruit, hops, yeast, or mossto in fermentation makes a coffee less authentic. The quieter structural problem is that most catalog infrastructure cannot distinguish a washed coffee with no additives from a coffee where the supplier simply did not say anything about additives.

Key move: absence is not a value. If the schema only has one free-text `processing` field, every missing fact gets flattened into prose. "Anaerobic Natural" becomes a label, not a queryable structure. "No additives disclosed" becomes indistinguishable from no disclosure. A buyer cannot compare methods. An API cannot filter safely. An agent cannot reason about the difference without guessing.

Use the co-fermentation post as the setup, not the body. That post exposed the gap. This one asks what had to change after the debate moved from taste to infrastructure.

Concrete source points:
- ADR-004: legacy `processing` collapses base method, fermentation environment, additives, duration, drying, disclosure quality, and provenance into one string.
- PR #208 scraper work: extraction had to preserve raw compound context like "Anaerobic Natural" before legacy normalization, otherwise the system lost the exact split the market needs.

### 2. Markets cannot price disclosure they cannot compare (350-450 words)

Bring in Lewis's eBay Motors paper as the transferable economics frame. Online used-car sellers reduce uncertainty through photos, text, and contractible disclosure. Those disclosures affect price because buyers can compare them across listings. The coffee version is stranger: specialty coffee already celebrates transparency, but much of the transparency lives in supplier prose, PDF offer sheets, relationship networks, or one-off labels that do not survive aggregation.

The sharper claim: disclosure only becomes market infrastructure when it becomes comparable. A seller who gives fermentation duration, additives, drying method, and confidence should receive market credit for that work. But if one catalog stores "Black Honey Double Carbonic Maceration Mossto with Galaxy Hops" as one string and another stores "Natural" as one string, the comparison layer is gone.

Use current Purveyors numbers as a concrete, draft-time check:
- ADR-005 sample of 1,058 anonymous `/v1/catalog` rows had 51 `processing_base_method` values, 0 `fermentation_type`, 0 `process_additives`, 54 `processing_disclosure_level`, and 435 `drying_method` values.
- That is not a failure of ambition. It is the honest shape of a newly structured field family before the upstream market has learned to publish into it.

Core insight: the first version of a transparency schema will look sparse. That sparseness is useful. It shows the difference between missing data, low disclosure, and real explicit claims. A pretty vocabulary would hide that gap.

### 3. A schema is a governance decision, not an engineering detail (400-500 words)

Explain ADR-004 as a product governance move. The field list matters because each field encodes a market claim:

- `processing_base_method`: the broad buyer-readable category.
- `fermentation_type`: the environment or technique.
- `process_additives`: explicit disclosed inputs, with `none` reserved for explicit none.
- `process_additive_detail`: named inputs like hops, mandarin, wine yeast, or mossto.
- `fermentation_duration_hours`: duration when stated or safely converted.
- `processing_disclosure_level`: whether the supplier gave none, label-only, structured, narrative, or high-detail disclosure.
- `processing_confidence`: how certain the extractor/system is.
- `processing_evidence`: internal provenance, not public marketing copy.
- `processing_evidence_available`: public signal that evidence exists without exposing raw supplier text.

The important part is not the exact field names. It is the semantics:
- Null means not disclosed or not safely known.
- Explicit `none` means the source actually said none.
- Raw evidence stays protected because provenance is needed for review, but supplier copy should not be dumped into public API responses by default.
- Backward compatibility matters. Legacy `processing` remains for existing consumers while richer process data grows around it.

This section should make the reader feel the hidden product philosophy: a database migration can be a public truthfulness policy. It decides what the product is allowed to claim, what it must leave blank, what it can ask suppliers to improve, and what downstream agents are allowed to trust.

### 4. The search gate is part of the transparency design (300-400 words)

Connect ADR-005 without turning the post into pricing strategy. Purveyors distinguishes data visibility from search leverage. It can show process facts publicly because that proves the dataset is real and helps users trust individual coffees. But the ability to search across structured method, fermentation, additives, disclosure level, and confidence is sourcing leverage. That belongs in member/API tiers.

This is not arbitrary gating if the boundary is honest:
- Public/viewer surface: "Can I see whether this coffee has credible processing facts?"
- Member/API surface: "Can I search the market by those facts and make faster sourcing decisions?"

The API-first angle is crucial. If docs say anonymous callers can use process filters but the route returns 401 or 403, the product has lied to agents. That was the PR #302 red-team point: in an API-first product, docs are part of the interface. Schema, entitlement, docs, UI, and error envelopes have to tell the same story.

Close this section with the practical lesson for builders: once a field becomes a market lever, it needs access policy, server-side enforcement, docs, tests, and examples. Otherwise the schema creates more ambiguity than it removes.

### 5. The future market publishes into the contract (250-350 words)

End by widening the aperture. The most interesting version of this is not that Purveyors scrapes better processing labels. Scraping is bootstrap infrastructure. The durable market shift happens when suppliers learn the publishing contract: here is the base method, fermentation type, additive claim, duration, drying method, disclosure level, and evidence standard buyers and agents expect.

Tie back to SCA CVA. The industry is already moving toward a higher-resolution picture of coffee value. Processing transparency is one slice of that. But high-resolution evaluation needs high-resolution data plumbing. Otherwise every rich assessment collapses back into a paragraph.

Possible final turn:
- The co-fermentation debate asked whether a process is legitimate.
- The schema question asks whether the market can describe any process precisely enough for buyers to compare it.
- That second question is less dramatic, but it is more durable. The market does not get more transparent when everyone agrees on better words. It gets more transparent when the data model makes omission visible.
