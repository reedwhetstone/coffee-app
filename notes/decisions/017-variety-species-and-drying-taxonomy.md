# ADR-017: Variety, species, and drying taxonomy

**Status:** Proposed

**Date:** 2026-10-02

## Context

The catalog filter rework (`notes/implementation-plans/2026-10-02-catalog-filter-ux-rework.md`) needs variety and drying filters that work as chips or searchable lists, but both fields are free text today.

Production evidence, read-only, 2026-10-02, in-stock catalog:

- `cultivar_detail`: 2,194 of 2,674 rows. Splitting on commas, slashes, and "and" gives 356 distinct tokens, mostly spelling variants (catuaí/catuai, ihcafe 90/ihcafe-90, geisha/gesha, heirloom/heirloom varieties). The 45 most common tokens cover 83% of mentions. Species labels ("arabica", "robusta") are mixed in.
- `drying_method`: 1,433 rows, 94 distinct strings, nearly all phrasings of a few methods (sun-dried, patio, raised or African beds, mechanical driers, greenhouse) and their combinations.

### Existing infrastructure this must fit

An audit of the scraper, Parchment, and coffee-app found:

- **Drying already has an extractor and evidence.** The scraper's shared `extractDryingMethodFromText` (`scrape/dataValidators.ts`) pulls the drying component out of compact process labels and records `dryingMethodEvidence`, which flows into `processing_evidence` under the ADR-004 processing-transparency contract. It stores the matched phrase verbatim, so there is no canonical value to filter on. The scraper's catalog data dictionary keeps drying "outside the origin/actor MVP" as evidence.
- **Cultivar is retained as text; species is deferred.** The scraper catalog redesign (scraper ADR-005 and `notes/catalog-redesign/catalog-data-dictionary.md`) keeps `cultivar_detail` as a first-class text field, and defers `species` to "a follow-up ADR" because species labels hide in `type`, cultivar strings, and narratives. It also requires `type` to be emptied into governed homes, including species, before deletion.
- **The Market Index is waiting on this.** Parchment reserves `cultivar` and `drying` as metadata-index dimensions and rejects them with "awaiting taxonomy normalization" (`packages/api/src/marketIndex/resource.ts`).
- **Canonical coffee matching expects it.** The canonical green coffee matching plan lists normalized cultivar as an identity signal.
- **There is a governed-vocabulary pattern to reuse.** Scraper ADR-005 requires a canonical list plus alias map, unknown values kept as evidence instead of written, and no column without an owning vocabulary, parser, write policy, and tests. ADR-016 implemented that as an append-only Parchment reference table (`green_grade_designations`) with a membership trigger, an audit for unmapped tokens, and a Catalog maintenance backfill.

## Decision

Add three governed taxonomies (variety, species, drying method) using the ADR-016 pattern, extended so the vocabulary can grow without code or schema changes.

### 1. Vocabulary tables

One append-only Parchment reference table per taxonomy, plus aliases:

- `coffee_varieties`: `code` (stable slug, e.g. `bourbon`, `pink_bourbon`, `sl28`, `ethiopian_landrace`), `label`, `parent_code` (nullable family, e.g. `yellow_bourbon` → `bourbon`), `species_code`, `description`, `active`, `sort_order`.
- `coffee_species`: `code` (`arabica`, `robusta`/`canephora`, `liberica`, `excelsa`, `eugenioides`, `hybrid`), `label`, `active`.
- `drying_methods`: `code` (`patio`, `raised_bed`, `african_bed` with parent `raised_bed`, `mechanical`, `greenhouse`, `sun_unspecified`, and so on), `label`, `parent_code`, `description`, `active`, `sort_order`.
- `taxonomy_aliases`: `taxonomy`, `alias` (normalized lowercase text), `code`. Many aliases map to one code.

Rows are never deleted (retire with `active = false`); codes are immutable. Same guards as `green_grade_designations`.

### 2. Catalog columns

- `varieties text[]` and `species_codes text[]`, beside the unchanged `cultivar_detail`.
- `drying_methods text[]`, beside the unchanged `drying_method`, joining the ADR-004 structured processing family (`processing_base_method`, `fermentation_type`, `process_additives`).

Arrays, because lots are often blends of varieties and dried in stages (patio, then mechanical). Constraint triggers reject codes outside the vocabularies. Raw text columns stay for display and search.

### 3. Room to grow

The user requirement is that legitimate new nuance must never be forced into an existing bucket.

- **New values are rows, not code.** Adding a variety, species, or drying method is a reviewed migration that inserts vocabulary and alias rows. The scraper loads the vocabulary and aliases from Parchment at the start of each run (with a bundled snapshot as fallback), so it recognizes new codes without a deploy. This improves on ADR-016, whose scraper pins a static code list.
- **Hierarchy keeps nuance without fragmenting filters.** A specific value (Pink Bourbon, African beds) records its parent (Bourbon, raised bed). Filters can match a family (all Bourbons) or a specific value, and facets can roll up or drill down.
- **Unknown values are never discarded or guessed.** Tokens with no alias stay in the raw text, are recorded as unmapped in evidence, and are reported by a scraper audit finding, as with grade codes. Triage adds an alias (spelling variant) or a new entry (legitimately new), and the Catalog maintenance backfill re-runs over affected rows.
- **No catch-all bucket.** There is no "other" code; an unmapped value simply has no canonical code yet, and stays searchable as text.

### 4. Evidence and extraction

- Drying: canonicalize the output of the existing `extractDryingMethodFromText` through the drying aliases. Evidence stays in `processing_evidence`; no new evidence store.
- Variety and species: a deterministic tokenizer over `cultivar_detail` (and structured source fields where scrapers have them) maps tokens through the aliases. Species tokens ("arabica", "robusta") route to `species_codes`, never to `varieties`. Variety evidence uses the same per-field evidence shape as ADR-016 (`grading_evidence` stays grading-only; varieties get their own entry in a service-only evidence relation, not a public column).
- Species from `type`: when the `type` deprecation port runs, species labels found there map through the species aliases. That completes the species destination the scraper data dictionary deferred.

### 5. Access

Variety, species, and drying are descriptive facts, not fine grading detail. Filters and facets are available to every account, consistent with origin and process. (Grading stays paid per ADR-016.)

## Integration

- **Parchment:** migration (tables, aliases, columns, triggers, seed); `/v1/catalog/taxonomies` vocabulary endpoint (or extend `/v1/catalog/grades` into a general vocabulary route); filters `variety` (code or family), `species`, `dryingMethod`; facets with family roll-up; comparison rows use labels; unblock the Market Index `cultivar` and `drying` dimensions; SDK minor release.
- **Scraper:** runtime vocabulary loader; tokenizer and canonicalizer; audit finding for unmapped tokens; Catalog maintenance backfill; supplier rubric note.
- **Cherry and CLI:** search parameters, facets fields, and a vocabulary lookup, following the grade tooling.
- **coffee-app:** variety searchable multi-select grouped by family, drying chips, species chips (Origin and supplier or Coffee section of the filter panel); card shows canonical labels with raw text on hover.
- **Canonical matching:** use `varieties` instead of raw cultivar text.

## Seed

Seeded from the 2026-10-02 token distribution: every token with five or more in-stock mentions gets a code or alias, and the rest start as unmapped audit items. Expected seed: about 60 varieties with families, 5 species, 6 drying methods, and roughly 200 aliases.

## Sequence

1. This ADR.
2. Parchment migration and vocabulary endpoint.
3. Scraper loader, canonicalizer, audit, backfill.
4. Parchment filters, facets, comparison rows, Market Index dimensions, SDK; Cherry and CLI.
5. coffee-app filters and card display (folds into the filter rework's panel).

The filter rework slice 1 does not wait for this chain; variety and drying filters appear when step 4 ships.

## Consequences

- One mechanism (vocabulary rows plus aliases plus audit) governs grades, varieties, species, and drying; future taxonomies (appellations, certifications) can use it.
- The runtime-loaded vocabulary means a bad alias row affects writes immediately; aliases go through reviewed migrations, and the trigger still guards codes.
- Raw text stays authoritative for display, so no information is lost if a mapping is wrong; a corrected alias plus backfill fixes stored codes.
