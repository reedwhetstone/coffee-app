# Outline: Is Co-Fermentation Cheating? Wrong Question. Most Coffee Can't Even Tell You How It Was Processed.

**Pillar:** supply-chain
**Target:** 1,900-2,200 words
**Status:** outlined
**Source material:** `repos/coffee-scraper/SUPPLIERS.md`, `repos/coffee-scraper/scrape/sources/prime-green-coffee.ts`, published post `who-profits-when-coffee-data-stays-scarce.svx`, SCA/WBC rules updates, Daily Coffee News Best of Panama coverage, Royal Coffee additive fermentation analysis, Perfect Daily Grind coverage

## Thesis

The specialty coffee world is having the wrong transparency fight. It is loudly debating whether co-fermentation is innovation or adulteration, while the basic processing data for ordinary coffee remains missing or inconsistent across much of the market. In the current supplier set, roughly 88% advertise some processing field in their integration schema, but only about 24% expose structured arrival-date data, about 29% expose farm notes, and only about 15% expose score data. The market is trying to regulate the weird edge case before it has standardized the ordinary case. Co-fermentation did not create a transparency crisis. It revealed how incomplete the industry's processing taxonomy already was.

## Voice Constraints
- Short and punchy. Hard cap around 2,200 words.
- Data and analysis first. No throat-clearing.
- Avoid simply repeating the broader information-gap post; stay focused on processing taxonomy, disclosure structure, and what the controversy revealed.
- Purveyors is an illustration, not a pitch.
- No em dashes.

## Verification
- [x] Confirm current supplier count in `SUPPLIERS.md`: 41 live suppliers
- [x] Confirm processing appears in 36/41 supplier provided-field schemas (~87.8%)
- [x] Confirm scoreValue appears in 6/41 (~14.6%)
- [x] Confirm arrivalDate appears in 10/41 (~24.4%)
- [x] Confirm farmNotes appears in 12/41 (~29.3%)
- [x] Confirm Prime Green Coffee process vocabulary from source file: Anaerobic, Black Honey, Carbonic Maceration, Fruit Fermentation, Honey Process, Mossto, Natural, Washed, Yeast Innoculation
- [x] Confirm SCA announced major 2023 WBC rules updates on Dec 22, 2022 and 2024 WBC rules release on Nov 2, 2023
- [x] Confirm Best of Panama organizers ejected four infused coffees in June 2024
- [ ] If possible before publish, re-check live catalog-level field fill rates against reachable DB endpoint. Current environment cannot resolve the Supabase host, so use `SUPPLIERS.md` schema-coverage as the verified internal source for this draft.

## External References
1. **Royal Coffee, Oct 23 2025**: "Additive Fermentation: Co-Fermented Coffee Redefines Flavor"  
   https://royalcoffee.com/co-fermented-coffee-processing-trends-and-controversy/  
   Key use: separates inoculation from co-fermentation, documents current labeling ambiguity, and gives a concrete example of a hyper-specific process description.

2. **Perfect Daily Grind, Sep 4 2025**: "Why co-fermented coffees are becoming a category of their own"  
   https://perfectdailygrind.com/2025/09/co-ferment-coffee-becoming-own-category-processing/  
   Key use: argues co-ferments are forcing the industry toward distinct categorization rather than vague catch-all labels.

3. **Specialty Coffee Association, Dec 22 2022 / Nov 2 2023**: 2023 and 2024 WBC rules update announcements  
   https://sca.coffee/sca-news/announcing-the-2023-athens-wcc-rules-regulations  
   https://sca.coffee/sca-news/busan-wbc-rules-regulations-released  
   Key use: confirms competitions were evolving rapidly in 2023 and that 2024 rules focused on clarification, which helps situate the controversy historically without overstating specific rule text we have not quoted.

4. **Daily Coffee News, Jun 28 2024**: "Best of Panama Organizers Take Hard Stance Against 'Infused' Coffees"  
   https://dailycoffeenews.com/2024/06/28/best-of-panama-organizers-take-hard-stance-against-infused-coffees/  
   Key use: documents that four altered/infused coffees were ejected from the 2024 competition and quotes the terroir-protection framing.

## Structure

### 1. The fight is real. The target is wrong.
Open with the split-screen: competitions and importers debating co-ferments while most supplier listings still cannot describe processing with useful precision. The argument sounds like a fight about authenticity. It is really a fight about missing standards.

### 2. The market can describe exotic processing better than ordinary processing
Use Prime Green Coffee's nine-category vocabulary as the sharp example. Then contrast it with the broader supplier schema map: processing appears often, but adjacent decision-critical fields do not. That means the industry can name a fringe method more easily than it can contextualize freshness, farm provenance, or quality signal.

### 3. Co-fermentation is forcing taxonomy pressure
Use Royal Coffee and Perfect Daily Grind to show why co-ferments create classification pressure. Once terms like inoculated, infused, mossto, carbonic, and additive fermentation show up, "processed coffee" stops being a usable bucket.

### 4. Best of Panama exposed the governance layer
Bring in the June 28, 2024 Daily Coffee News coverage. Best of Panama did not just reject four coffees; it showed that when definitions are weak, governance bodies improvise. That is not a stable market design.

### 5. The real product problem is hierarchical processing data
Argue for structured fields: base process, fermentation environment, additive class, inoculation method, duration, and disclosure confidence. Flat labels are breaking. The market needs a tree, not a tag cloud.

### 6. Immediate vs tail risk
Immediate risk: buyer confusion, weak comparison-shopping, incentives for vague listings, competition rule fights. Tail risk: fragmented standards across importers, trust collapse around "specialty" labeling, and lost ability to compare process-driven premiums across the market.

### 7. Opportunity map
Actionable plays for roasters, importers, and data products:
- Separate terroir questions from processing questions
- Reward explicit disclosure even when buyers dislike the method
- Track processing as a hierarchy rather than a string
- Add confidence and provenance metadata to process claims
- Build category views that compare washed, anaerobic, co-ferment, and inoculated lots on the same footing

### 8. Product implication for purveyors
One concrete implication: processing needs to be modeled as a normalized, multi-attribute structure, not a single text field. The next fields to track are base process, fermentation style, additive presence, additive type, and disclosure-confidence source.

## Data fields the product should track next
- `processing_base_method`
- `fermentation_environment`
- `processing_additives_present` (boolean)
- `processing_additive_type`
- `processing_inoculation_type`
- `processing_duration_hours`
- `processing_disclosure_confidence`
- `processing_source_text`
- `processing_normalization_version`
