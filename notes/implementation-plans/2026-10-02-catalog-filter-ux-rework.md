# Catalog filter and sort UX rework

**Status:** Proposed for review
**Date:** 2026-10-02
**Related:** ADR-016 (green coffee grading), backlog entry "Finish the green coffee grading rollout"

## Problem

The catalog has three filter surfaces that overlap and disagree:

1. **Top filter bar** (`FilterBarSection`): Origin select, Process select (raw `processing` text), name search, and a "Hobbyist suppliers only" checkbox.
2. **Sidebar** (`Settingsbar`): every column in `getFilterableColumns('/catalog')`, mostly as free-text inputs: name, source, continent, country, region, processing, cultivar, type ("Importer"), grade, elevation range, appearance, score range, price range, stocked date. Sort offers almost every one of those columns.
3. **On-page "Advanced process transparency" panel** (`ProcessFilterSection`): base method, fermentation, additive, disclosure, and confidence selects.

The same idea appears in two places with different semantics (top-bar Process is a substring of raw `processing`; the panel's Base method is the structured field). Several sidebar fields are free text over values nobody can guess, and several are legacy or junk.

Live facet cardinality (stocked catalog, 2026-10-02) shows which fields are bounded vocabularies and which are open text:

| Field | Distinct values | Today | Notes |
| --- | --- | --- | --- |
| processing_base_method | 9 | panel select | clean, structured |
| fermentation_type | 8 | panel select | clean |
| process_additives | 7 | panel select | clean |
| continents | 6 | sidebar select | clean |
| processing_disclosure_level | 4 | panel select | clean |
| grade codes by kind (size, altitude, defects, cup, prep) | 6 to 14 each | none | ADR-016, labeled vocabulary |
| screen size (min) | 7 | none | ADR-016 |
| elevation bands (200 m) | 13 | sidebar number range | |
| countries | 42 | top-bar select and sidebar select | |
| suppliers | 45 | sidebar | stored as slugs |
| arrival months | 55 | sidebar select | includes "Spot" |
| processing (raw text) | 31 | top-bar select and sidebar text | messy variants of the structured field |
| drying_method | 94 | none in UI | messy free text |
| type ("Importer") | 255 | sidebar text | mostly junk ("Unroasted Coffee Beans", "Green Coffee") |
| grade (legacy) | 431 | sidebar text | elevation text; superseded by elevation + grade codes |
| appearance | 481 | sidebar text | superseded by grade codes |
| cultivar_detail | 635 | sidebar text | comma lists, inconsistent casing |
| regions | 1014 | sidebar text | open geography |

## Principles

1. **One filter model, one panel.** A single filter panel (sidebar on desktop, bottom sheet on mobile) owns every filter. A slim primary row above results holds the few filters most shoppers use, and both read and write the same state. The on-page process panel goes away.
2. **Pick the control from the data, not habit.**
   - Bounded vocabulary (up to ~15 values): chips or checkboxes with counts, multi-select.
   - Medium vocabulary (15 to ~60 known names): searchable multi-select with counts.
   - Open text (hundreds of values): a search box, never a dropdown; typeahead suggestions where values are reusable.
   - Numbers: range controls with bounds shown, plus useful presets.
   - Yes/no facts: toggles.
   - Dates: relative presets ("arrived in the last 30 days"), with arrival month as a secondary option.
3. **Counts everywhere.** Every option shows how many coffees match under the other active filters (the facets endpoint, `include=grading` for paid callers). Zero-count options are disabled, not hidden, while a filter on that field is active.
4. **Progressive disclosure.** Primary row, then grouped sections in the panel, most useful first. Paid groups are visible but locked for free accounts, with a one-line upgrade reason, rather than silently missing.
5. **Active filters are always visible** as removable chips above the results, with the result count and Clear all.
6. **Retire legacy and junk fields** instead of porting them.

## Proposed structure

### Primary row (always visible, all accounts)

- **Search** (name, supplier, origin text) with a single input.
- **Origin**: searchable multi-select of countries with counts.
- **Process**: chips for base method (Washed, Natural, Honey, Wet-Hulled, Decaf, ...), multi-select. Replaces both the raw-text Process select and the panel's Base method.
- **Price per lb**: range with presets (under $8, $8 to $12, $12+); price range stays a paid capability today, so free accounts see presets locked (see open question 3).
- **In stock** toggle (default on).
- **Sort** (see below).
- **Filters** button opening the panel, with a badge showing how many panel filters are active.

### Panel sections

1. **Origin and supplier**: continent chips; country multi-select (mirrors primary row); region search with typeahead; supplier searchable multi-select (display names, not slugs); **Market** segmented control: Retail, Wholesale, Both (replaces "Hobbyist suppliers only").
2. **Process**: base method chips (mirrors primary row); fermentation chips; additive chips plus "Has additives" toggle; drying method only after it is normalized (open question 2).
3. **Grade and quality** (paid; locked for free accounts):
   - Grade chips grouped by kind (Size, Altitude, Defects, Cup, Preparation), labeled from `/v1/catalog/grades` (for example "Kenya AA", "Guatemala SHB", "European Preparation (EP)"), with a tooltip from the vocabulary description.
   - Peaberry and Lab analyzed toggles.
   - Screen size range (8 to 20) and elevation range with 200 m band counts; "Include coffees with no stated value" checkbox for each.
   - Moisture max.
   - Cup score range with a protocol selector; mixed or unstated protocols are labeled "Supplier's own scale" and not offered for ranking.
4. **Freshness**: arrived in the last 7, 30, or 90 days (presets over `stockedDays`); arrival month multi-select as a secondary control.
5. **Transparency** (paid): disclosure level chips, proof filters when they ship. Processing confidence moves out of the UI (too technical for shoppers; still available through the API and CLI).

### Sort

Replace "sort by any column" with a curated list:

- Newest arrivals (default)
- Price, low to high
- Price, high to low
- Purveyor Score (labeled as listing completeness)
- Elevation, high to low (paid)
- Name, A to Z

Cup score sorting is offered only when a single protocol is selected, because scores on different scales do not order meaningfully. Sorting by region, appearance, type, grade, or cultivar text is removed.

### Retired from the catalog UI

- `grade` (legacy elevation text): replaced by elevation range and grade codes.
- `appearance` free text: replaced by grade codes; still shown on the coffee card.
- `type` ("Importer"): 255 values, mostly product-type noise. Remove the filter; consider fixing or dropping the field upstream.
- Raw `processing` text filter: replaced by the structured base method and fermentation.
- Processing confidence select.
- The on-page "Advanced process transparency" panel.

## Delivery slices

1. **Filter model and panel shell.** One filter state shape mapped to Parchment params; primary row; panel with Origin and supplier, Process, Freshness; active chips; curated sort; Market control; retire the on-page panel and legacy sidebar fields. URL state stays shareable and back-compatible (old params map to new ones or are dropped with no error).
2. **Grade and quality section.** Grading chips from the vocabulary and `include=grading` facets, ranges, toggles, locked state for free accounts, subscription copy.
3. **Transparency and polish.** Disclosure section, mobile bottom sheet tuning, empty states ("No coffees match; remove Peaberry to see 12"), analytics on filter use.

Each slice ships as its own PR with tests for the filter-to-param mapping, locked states, and URL round trips.

## Open questions

1. **Variety:** typeahead over the raw cultivar text now, or wait for normalized cultivar tokens (635 raw values, comma lists)?
2. **Drying method:** hide until normalized (94 messy values), or offer chips for the few clean values (Sun-dried, Raised beds, Patio-dried)?
3. **Price and score ranges:** they are paid capabilities today. Should a basic price filter be free, given price is the most common shopper question?
4. **Cup score:** keep as a paid filter with protocol labeling, or leave it out of the UI until more lots state a protocol?
