# Catalog filter and sort UX rework

**Status:** Accepted (Reed, #purveyors; open questions answered 2026-10-02 and 2026-10-04, see Decisions)
**Date:** 2026-10-02
**Related:** ADR-005 (access levels), ADR-016 (green coffee grading), ADR-018 (variety, species and drying taxonomy), backlog entry "Finish the green coffee grading rollout"

## Problem

The catalog has three filter surfaces that overlap and disagree:

1. **Top filter bar** (`FilterBarSection`): Origin select, Process select (raw `processing` text), name search, and a "Hobbyist suppliers only" checkbox.
2. **Sidebar** (`Settingsbar`): every column in `getFilterableColumns('/catalog')`, mostly as free-text inputs: name, source, continent, country, region, processing, cultivar, type ("Importer"), grade, elevation range, appearance, score range, price range, stocked date. Sort offers almost every one of those columns.
3. **On-page "Advanced process transparency" panel** (`ProcessFilterSection`): base method, fermentation, additive, disclosure, and confidence selects.

The same idea appears in two places with different semantics (top-bar Process is a substring of raw `processing`; the panel's Base method is the structured field). Several sidebar fields are free text over values nobody can guess, and several are legacy or junk.

Live facet cardinality (stocked catalog, 2026-10-02) shows which fields are bounded vocabularies and which are open text:

| Field                                                    | Distinct values | Today                             | Notes                                                  |
| -------------------------------------------------------- | --------------- | --------------------------------- | ------------------------------------------------------ |
| processing_base_method                                   | 9               | panel select                      | clean, structured                                      |
| fermentation_type                                        | 8               | panel select                      | clean                                                  |
| process_additives                                        | 7               | panel select                      | clean                                                  |
| continents                                               | 6               | sidebar select                    | clean                                                  |
| processing_disclosure_level                              | 4               | panel select                      | clean                                                  |
| grade codes by kind (size, altitude, defects, cup, prep) | 6 to 14 each    | none                              | ADR-016, labeled vocabulary                            |
| screen size (min)                                        | 7               | none                              | ADR-016                                                |
| elevation bands (200 m)                                  | 13              | sidebar number range              |                                                        |
| countries                                                | 42              | top-bar select and sidebar select |                                                        |
| suppliers                                                | 45              | sidebar                           | stored as slugs                                        |
| arrival months                                           | 55              | sidebar select                    | includes "Spot"                                        |
| processing (raw text)                                    | 31              | top-bar select and sidebar text   | messy variants of the structured field                 |
| drying_method                                            | 94              | none in UI                        | messy free text                                        |
| type ("Importer")                                        | 255             | sidebar text                      | mostly junk ("Unroasted Coffee Beans", "Green Coffee") |
| grade (legacy)                                           | 431             | sidebar text                      | elevation text; superseded by elevation + grade codes  |
| appearance                                               | 481             | sidebar text                      | superseded by grade codes                              |
| cultivar_detail                                          | 635             | sidebar text                      | comma lists, inconsistent casing                       |
| regions                                                  | 1014            | sidebar text                      | open geography                                         |

## Principles

1. **One filter model, one panel.** A single filter panel (sidebar on desktop, bottom sheet on mobile) owns every filter. A slim primary row above results holds the few filters most shoppers use, and both read and write the same state. The on-page process panel goes away.
2. **Pick the control from the data, not habit.** The control must also match what the catalog contract can express (see Contract constraints).
   - Bounded vocabulary (up to ~15 values): chips with counts. Multi-select only where the API accepts a repeatable any-of parameter; otherwise single-select chips.
   - Medium vocabulary (15 to ~60 known names): searchable select with counts, multi-select under the same rule.
   - Open text (hundreds of values): a search box, never a dropdown; typeahead suggestions where values are reusable.
   - Numbers: range controls with bounds shown, plus useful presets.
   - Yes/no facts: toggles.
   - Dates: relative presets labeled for what they filter ("stocked in the last 30 days"), with arrival month as a secondary option.
3. **Counts everywhere.** Every option shows how many coffees match under the other active filters, from Parchment's `/v1/catalog/facets` counts (`include=grading` for entitled callers). Zero-count options are disabled, not hidden, while a filter on that field is active. This needs BFF work in slice 1 (see Delivery slices); the browser does not receive counts today.
4. **Progressive disclosure.** Primary row, then grouped sections in the panel, most useful first. Anything the viewer is not entitled to is visible but locked, with a one-line upgrade reason, rather than silently missing or silently ignored. Locks follow `resolveCatalogAccessCapabilities`; this plan changes one entitlement, the price range for signed-in free accounts (decision 3).
5. **Active filters are always visible** as removable chips above the results, with the result count and Clear all.
6. **Retire legacy and junk controls** instead of porting them. Retiring a control does not retire its URL parameter: legacy params keep applying until their API contract is formally removed.

## Contract constraints

The plan uses the current Parchment catalog contract as is. Checked against `parchment-api` `packages/api/src/catalog/listing.ts`, `search.ts`, `facets.ts` and coffee-app `src/lib/server/catalogAccess.ts` on 2026-10-02:

- **Repeatable any-of params:** `country`, `source` (supplier slugs), `gradeCode`, and the ADR-018 code filters `varietyCode`, `speciesCode` and `dryingMethodCode`. `gradeCode` matches a coffee carrying any selected code, across all kinds. A variety or drying family code also matches the codes under it (Bourbon matches Pink Bourbon).
- **Scalar params:** `continent`, `processing_base_method`, `fermentation_type`, `process_additive`, `processing_disclosure_level`, `arrivalDate`, `scoreProtocol`. Multiple values would need a new repeatable OR contract in Parchment and the SDK, which is out of scope here.
- **Search:** `name` is a partial match on the coffee name, `origin` a partial match across continent, country and region, `supplier` a partial match on the supplier slug. No param ORs name, supplier and origin together.
- **Dates:** `stockedDays` filters `stocked_date` (when Purveyors first stocked the listing). `arrival_date` is a separate exact-match field.
- **Entitlements:** anonymous and Viewer website sessions cannot use structured process params, score ranges, advanced sorts or premium metadata (`canUseProcessFacets`, `canUsePriceScoreRanges`, `canUseAdvancedSorts` are false); the loader strips them. Price range is the one change this plan makes (decision 3): it opens to Viewer sessions, which needs the price half of `canUsePriceScoreRanges` split out in Parchment and in the loader before slice 1 ships. The variety, species and drying code params are gated with the structured process params (ADR-018). Legacy `processing` text stays public. Per ADR-014, the public supplier-scope control is **Hobbyist suppliers only** (`showWholesale=false`), and `wholesaleOnly=true` is member/admin only.
- **Facets:** `/v1/catalog/facets` accepts the same filters as the listing and returns `facets` (value plus count) next to `values`; `include=grading` adds grade-code, screen and elevation-band counts for entitled callers, and `include=taxonomy` adds variety, species and drying code counts with family roll-up (a family counts every coffee carrying it or a code under it, once). The counts cover coded coffees only: nothing in the response counts coffees that carry no code, and family counts cannot be added up to find them, because a blend is counted under each of its families. The coffee-app BFF (`/api/catalog/filters`) currently forwards only stock and wholesale scope and returns `values` only.
- **Vocabularies:** `/v1/catalog/taxonomies` returns the variety, species and drying vocabularies (code, label, family, description), and `/v1/catalog/grades` returns the grade designations. Both grow by adding rows, so a control built on one reads its options from the endpoint, never from a list kept in coffee-app.
- **Totals:** the listing returns an exact `pagination.total` for the active filters, counting each coffee once, at any page size.
- **Cup score protocol:** ADR-016 displays `supplier_unspecified` scores as "protocol not stated" and never ranks or compares them.

## Proposed structure

### Primary row (always visible, all accounts; some controls locked by entitlement)

- **Search**: coffee name (`name`). Supplier and origin keep their own controls (Origin below, supplier in the panel), because no single param searches all three with OR semantics. A combined search would need a new Parchment `q` param plus SDK and BFF work; see decision 5.
- **Origin**: searchable multi-select of countries with counts (`country` is repeatable).
- **Process**: single-select chips for base method (Washed, Natural, Honey, Wet-Hulled, Decaf, ...) over `processing_base_method`. Replaces the panel's Base method for entitled viewers. For anonymous and Viewer sessions the chips are shown locked, and the existing public Process select over legacy `processing` text stays as their control, so no viewer gets chips that silently do nothing and no entitlement changes (see decision 6).
- **Price per lb**: range with presets (under $8, $8 to $12, $12+). Available to every signed-in account, including free Viewer accounts (decision 3). Anonymous visitors see the presets locked with a sign-in prompt, because ADR-005 freezes the anonymous filter set.
- **In stock** toggle (default on).
- **Sort** (see below).
- **Filters** button opening the panel, with a badge showing how many panel filters are active.

### Panel sections

1. **Origin and supplier**: continent chips (single-select); country multi-select (mirrors primary row); region search with typeahead; supplier searchable multi-select (display names, not slugs; `source` is repeatable); **Supplier scope**, per ADR-014: the public **Hobbyist suppliers only** toggle (`showWholesale=false`, neutral state includes all publishable coffees) for everyone, plus a **Wholesale only** option (`wholesaleOnly=true`) available only to member and admin sessions and shown locked for others. No "Retail" label; hobbyist-friendly is the contract's classification.
2. **Process** (structured fields; locked for anonymous and Viewer sessions, matching `canUseProcessFacets`): base method chips (mirrors primary row); fermentation chips; additive chips plus "Has additives" toggle. Each chip group is single-select because these params are scalar. Drying method chips (multi-select; `dryingMethodCode` is repeatable) over the ADR-018 codes, labeled and counted from `/v1/catalog/taxonomies` and `include=taxonomy`, with African beds shown under Raised beds (decision 2).
3. **Grade and quality** (paid; locked for free accounts):
   - Grade chips grouped by kind (Size, Altitude, Defects, Cup, Preparation), labeled from `/v1/catalog/grades` (for example "Kenya AA", "Guatemala SHB", "European Preparation (EP)"), with a tooltip from the vocabulary description. Selections across all groups are one `gradeCode` set with any-of semantics, so the section says "matches any selected grade"; requiring one grade from each kind would need a new contract.
   - Peaberry and Lab analyzed toggles.
   - Screen size range (8 to 20) and elevation range with 200 m band counts; "Include coffees with no stated value" checkbox for each.
   - Moisture max.
   - Cup score range with a protocol selector; `supplier_unspecified` scores are labeled "protocol not stated" (ADR-016) and are never offered for ranking or comparison.
4. **Variety** (same lock as Process, per ADR-018): searchable multi-select of varieties grouped by family, labeled and counted from `/v1/catalog/taxonomies` and `include=taxonomy` (`varietyCode` is repeatable; choosing a family includes the varieties under it); species chips over `speciesCode`, one for each species the same vocabulary returns (six today: Arabica, Robusta, Liberica, Excelsa, Eugenioides and interspecific hybrid), so a species added upstream appears without a coffee-app change. A coffee whose supplier wording is not in the vocabulary carries no code and cannot match a variety choice, so the section says how many coffees matching the other active filters have no standardized variety (decision 1). The facets do not report that number; the BFF derives it from two listing totals (slice 1).
5. **Freshness**: stocked in the last 7, 30, or 90 days (presets over `stockedDays`, which filters the date Purveyors first stocked the listing, not the supplier's arrival date); arrival month single-select (`arrivalDate`) as a secondary control.
6. **Transparency** (paid): disclosure level chips (single-select), proof filters when they ship. Processing confidence moves out of the UI (too technical for shoppers; still available through the API and CLI).

### Sort

Replace "sort by any column" with a curated list:

- Recently stocked (default; `stocked_date`)
- Price, low to high
- Price, high to low
- Purveyor Score (labeled as listing completeness; an advanced sort, so locked for anonymous and Viewer sessions)
- Name, A to Z

Elevation sorting is not in the list because no elevation sort field exists in the catalog contract; adding one is an upstream follow-up. Cup score sorting is offered only when a single established protocol is selected, never for `supplier_unspecified`, because scores on different or unstated scales do not order meaningfully. Sorting by region, appearance, type, grade, or cultivar text is removed from the UI; those `sortField` values in old URLs keep being honored under their current entitlement rules.

### Retired from the catalog UI

These controls leave the filter UI. Their URL params do not: a shared or bookmarked URL carrying `grade`, `appearance`, `type`, `processing` or `processing_confidence_min` keeps being parsed, forwarded to Parchment with its current semantics, and shown as a removable active-filter chip, so the result set never silently broadens. Params are dropped only after their API contract is formally removed (for `grade`, after the ADR-016 deprecation window and usage check).

- `grade` (legacy elevation text): replaced by elevation range and grade codes.
- `appearance` free text: replaced by grade codes; still shown on the coffee card.
- `type` ("Importer"): 255 values, mostly product-type noise. Remove the filter; consider fixing or dropping the field upstream.
- Raw `processing` text filter, for entitled viewers: replaced by the structured base method and fermentation. It stays the Process control for anonymous and Viewer sessions (see Primary row).
- Processing confidence select.
- The on-page "Advanced process transparency" panel.

## Delivery slices

0. **Price range for free accounts (Parchment).** Split the price half out of `canUsePriceScoreRanges` so signed-in Viewer sessions can use `pricePerLbMin` and `pricePerLbMax`; score ranges keep the current gate and anonymous access is unchanged. Ships before slice 1 so the primary-row price control works for free accounts on day one.
1. **Filter model and panel shell.** One filter state shape mapped to Parchment params; primary row; panel with Origin and supplier, Process (including drying chips), Variety, Freshness; active chips; curated sort; supplier-scope control per ADR-014; entitlement locks from `catalogAccess`; retire the on-page panel and legacy sidebar controls. Two sidebar range filters that members use today are not retired with it: elevation range (`elevationMinMasl`, `elevationMaxMasl`, `includeUnknownElevation`) and score range (`scoreValueMin`, `scoreValueMax`) move into the panel as they work now, with their current locks, because their Grade and quality replacements wait on slice 2 and slice 2 has no date until ADR-016 is accepted. URL state stays shareable and back-compatible: old params map exactly to new ones where an exact mapping exists, and otherwise keep applying as legacy filters (see Retired from the catalog UI); none is silently dropped. Facet counts: extend `/api/catalog/filters` to forward the active filter state (with the same entitlement stripping as the listing) and return Parchment's `facets` counts alongside `values`; for a field with an active selection, compute that field's counts with its own filter removed so alternatives are not all zero. No-standardized-variety count, for sessions entitled to the Variety section: the BFF takes two listing totals at the smallest page size, both with the variety selection removed, one for the remaining filters and one that adds every top-level variety code as `varietyCode`. A family code matches every code under it and the listing counts each coffee once, so the difference is the number of coffees with no variety code. Beyond slice 0, no new Parchment work is needed, because the contracts this slice uses are already live: the taxonomy vocabulary, code filters and code facets (Parchment #340 and #347, SDK 0.57.0). Slice 1 uses none of the grading fields; the two carried-over range filters are already in coffee-app today. coffee-app must first move from `@purveyors/sdk` 0.46.0 to the current release (0.59.0 on 2026-10-04), whose facets query accepts the listing filters, `include=grading` and `include=taxonomy`, and whose catalog item type carries `grading` and `taxonomy`.
2. **Grade and quality section.** Builds on ADR-016 (accepted 2026-10-04) and the Parchment contract it describes, which is live: grading filters, the `grading` object and `/v1/catalog/grades` (Parchment #333, SDK 0.52.0), then grading facets (Parchment #334, SDK 0.53.0). Cup score sorting ships here too, because it needs the protocol selector. The elevation and score range controls carried through slice 1 are replaced here by the versions in this section (band counts, protocol selector). Grading chips from the vocabulary; the BFF forwards `include=grading` for entitled callers only and passes grade counts through; ranges, toggles, locked state for free accounts, subscription copy.
3. **Transparency and polish.** Disclosure section, mobile bottom sheet tuning, empty states ("No coffees match; remove Peaberry to see 12"), analytics on filter use.

Each slice ships as its own PR with tests for the filter-to-param mapping, locked states per access level, URL round trips including legacy params, and BFF facet forwarding.

## Decisions

The six open questions this plan was reviewed with, as answered.

1. **Variety:** use normalized codes, not a typeahead over raw text. ADR-018 delivered them; the Variety section filters on `varietyCode` and `speciesCode`. (Reed, #purveyors, 2026-10-02: build a normalized vocabulary that can grow; ADR-018 accepted 2026-10-04.)
2. **Drying method:** offer chips over the normalized ADR-018 codes in the Process section. (Same decision as 1.)
3. **Price and score ranges:** a basic price filter is free. Score ranges stay paid. (Reed, #purveyors, 2026-10-02: "we can enable price filtering for free".) This plan places it at the signed-in Viewer level, recorded as an amendment to ADR-005: that decision reserves "one or two obvious broad filters" for Viewer and freezes the anonymous filter set, so anonymous visitors see the control locked with a sign-in prompt. Reed confirmed that placement in #purveyors on 2026-10-04: visitors who are not signed in keep the more minimal experience.
4. **Cup score:** keep it as a paid filter, with protocol labels. The protocol-labeled control ships in slice 2; until then members keep the score range they have today (slice 1). (Reed, #purveyors, 2026-10-02: "we can enable it"; protocol labels "are a good idea".)
5. **Combined search:** not needed. Name search, the Origin control and the supplier control stay separate, which needs no new Parchment parameter. (Reed, #purveyors, 2026-10-04: "I don't need a combined search box, I don't think".)
6. **Structured process for free viewers:** stays paid. Free viewers keep the legacy Process select and see the structured chips locked. (Reed, #purveyors, 2026-10-02: fine-detail metadata filters "should be paid tier/API".)
