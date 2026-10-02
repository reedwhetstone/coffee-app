# ADR-018: Variety, species, and drying taxonomy

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
- **The existing API has text filters with these names.** Parchment's `/v1/catalog` `variety` param is a case-insensitive partial match on `cultivar_detail`, and `dryingMethod` is a partial match on `processing` or `drying_method` (`packages/api/src/catalog/search.ts`). The CLI exposes both as text flags. These are stable public contracts.
- **There is a governed-vocabulary pattern to reuse.** Scraper ADR-005 requires a canonical list plus alias map, unknown values kept as evidence instead of written, and no column without an owning vocabulary, parser, write policy, and tests. ADR-016, which is still **Proposed**, specifies that pattern for grades: an append-only Parchment reference table (`green_grade_designations`) with a membership trigger, an audit for unmapped tokens, and a Catalog maintenance backfill. Its Parchment migration (`supabase/migrations/20261002020000_green_coffee_grading_schema.sql`) and the scraper grading extractor are on main, but ADR-016's acceptance is not settled.

This ADR reuses ADR-016's shape, not its artifacts. Every table, trigger, loader, audit, and backfill it needs is built in its own sequence (steps 2 and 3), so it does not depend on ADR-016 being accepted. If ADR-016 changes before acceptance, the shared shape is reconciled when this ADR is accepted.

## Decision

Add three governed taxonomies (variety, species, drying method) using the vocabulary-plus-alias shape that ADR-016 proposes, extended so the vocabulary can grow without code or schema changes.

### 1. Vocabulary tables

One append-only Parchment reference table per taxonomy, plus aliases:

- `coffee_varieties`: `code` (stable slug, e.g. `bourbon`, `pink_bourbon`, `sl28`, `ethiopian_landrace`), `label`, `parent_code` (nullable family, e.g. `yellow_bourbon` → `bourbon`), `species_code`, `description`, `active`, `sort_order`.
- `coffee_species`: `code` (`arabica`, `canephora`, `liberica`, `excelsa`, `eugenioides`, `hybrid`), `label`, `active`. Each species has exactly one code. `canephora` is labeled "Robusta (C. canephora)", and "robusta" is an alias of it, not a second code.
- `drying_methods`: `code` (`patio`, `raised_bed`, `african_bed` with parent `raised_bed`, `mechanical`, `greenhouse`, `sun_unspecified`, and so on), `label`, `parent_code`, `description`, `active`, `sort_order`.
- `taxonomy_aliases`: `taxonomy`, `alias`, `code`. Many aliases map to one code; one alias never maps to more than one code:
  - `(taxonomy, alias)` is the primary key, so a normalized alias resolves to exactly one code per taxonomy and the loader's result never depends on row order.
  - `alias` is stored normalized (lowercase, trimmed, internal whitespace collapsed), enforced by a check constraint using the same normalization function the scraper applies to tokens.
  - `code` must exist in the vocabulary named by `taxonomy` (trigger).
  - Variety and species aliases are matched against the same `cultivar_detail` tokens, so an alias may not exist in both the `variety` and `species` taxonomies (trigger).

Rows are never deleted (retire with `active = false`); codes are immutable. Same guards as `green_grade_designations`. Remapping an alias is a reviewed migration that updates its `code`, followed by the backfill.

### 2. Catalog columns

- `varieties text[]` and `species_codes text[]`, beside the unchanged `cultivar_detail`.
- `drying_methods text[]`, beside the unchanged `drying_method`, joining the ADR-004 structured processing family (`processing_base_method`, `fermentation_type`, `process_additives`).

Arrays, because lots are often blends of varieties and dried in stages (patio, then mechanical). Constraint triggers reject codes outside the vocabularies. Raw text columns stay for display and search.

### 3. Room to grow

The user requirement is that legitimate new nuance must never be forced into an existing bucket.

- **New values are rows, not code.** Adding a variety, species, or drying method is a reviewed migration that inserts vocabulary and alias rows. The scraper loads the vocabulary and aliases from Parchment at the start of each run (with a bundled snapshot as fallback), so it recognizes new codes without a deploy. This improves on ADR-016's proposal, whose scraper pins a static code list.
- **Hierarchy keeps nuance without fragmenting filters.** A specific value (Pink Bourbon, African beds) records its parent (Bourbon, raised bed). Filters can match a family (all Bourbons) or a specific value, and facets can roll up or drill down (section 6).
- **Unknown values are never discarded or guessed.** Tokens with no alias stay in the raw text, are recorded as unmapped in evidence, and are reported by a scraper audit finding. Triage adds an alias (spelling variant) or a new entry (legitimately new), and the Catalog maintenance backfill re-runs over affected rows.
- **No catch-all bucket.** There is no "other" code; an unmapped value simply has no canonical code yet, and stays searchable as text.

### 4. Evidence and extraction

- Drying: canonicalize the output of the existing `extractDryingMethodFromText` through the drying aliases. Evidence stays in `processing_evidence`; no new evidence store.
- Variety and species: a deterministic tokenizer over `cultivar_detail` (and structured source fields where scrapers have them) normalizes each token and maps it through the aliases. Species tokens ("arabica", "robusta") route to `species_codes`, never to `varieties`. Variety evidence uses the per-field evidence shape ADR-016 proposes, in a service-only evidence relation, not a public column (`grading_evidence` stays grading-only).
- Species from `type`: when the `type` deprecation port runs, species labels found there map through the species aliases. That completes the species destination the scraper data dictionary deferred.

### 5. Access

This ADR does not change entitlements.

- **Purveyors website:** structured variety, species, and drying filters and their facet counts follow ADR-005. Normalized drying and multi-facet search are Member capabilities there, gated with the structured process facets (`canUseProcessFacets` in `resolveCatalogAccessCapabilities`). Anonymous and Viewer sessions see these controls locked with an upgrade reason, the loader strips the code params for them, and the BFF does not return their facet metadata to them. Canonical labels and raw text on CoffeeCards are catalog reading, so they are visible wherever the card is.
- **API:** per ADR-005's API-tier amendment, the code filters, facets, and vocabulary endpoint are public-data catalog capabilities available to every API plan with `catalog:read`. The vocabulary endpoint follows the `/v1/catalog/grades` access policy.
- **Enforcement:** Parchment is the boundary; the website loader's stripping is presentation. `varietyCode`, `speciesCode`, and `dryingMethodCode` join `PROCESS_FACET_FILTER_KEYS` (`packages/api/src/catalog/access.ts`), and their facet counts sit behind the same `canUseProcessFacets` check as the structured process facets. Anonymous, public demo key, and Viewer principals get the existing denial notice; members and customer API keys pass.
- Grading fields keep their existing gating; nothing here changes it.

Opening these filters to Anonymous or Viewer website sessions would require amending ADR-005 first.

### 6. Filter semantics

The existing `variety` and `dryingMethod` text params keep their partial-match semantics unchanged. Code matching uses new params, following `gradeCode`:

- `varietyCode`, `speciesCode`, `dryingMethodCode`: each repeatable.
- Within one param, values are any-of: a row matches if it carries any selected code.
- Across params, and with every other filter, conditions are combined with AND, as today.
- A family code matches rows carrying that code or any descendant. A specific code matches only rows carrying that code. Selecting a family and one of its children therefore returns the family's result.
- Unknown codes are a validation error, not an empty match. Retired codes stay valid and match rows that still carry them. Rows with no canonical code never match a code filter; they still match the text params.
- Facets count distinct rows. A family's count includes rows carrying any descendant, so a row with both `pink_bourbon` and `bourbon` is counted once under Bourbon.

The website, CLI, Cherry, and SDK use these semantics as defined by Parchment and do not reimplement matching.

## Integration

- **Parchment:** migration (tables, aliases, columns, triggers, seed); `/v1/catalog/taxonomies` vocabulary endpoint (or extend `/v1/catalog/grades` into a general vocabulary route); the section 6 code filters with existing text params unchanged, gated per section 5; facets with family roll-up; comparison rows use labels; unblock the Market Index `cultivar` and `drying` dimensions; SDK minor release.
- **Scraper:** runtime vocabulary loader; tokenizer and canonicalizer; audit finding for unmapped tokens; Catalog maintenance backfill; supplier rubric note.
- **Cherry and CLI:** code-filter parameters (for example `--variety-code`, `--species-code`, `--drying-method-code`) beside the unchanged text flags, facets fields, and a vocabulary lookup, following the grade tooling.
- **coffee-app:** variety searchable multi-select grouped by family, drying chips, species chips (Origin and supplier or Coffee section of the filter panel), gated per section 5. The card shows canonical labels with the raw supplier text available without hover: an accessible disclosure that opens on tap, click, or keyboard focus, and the raw text shown directly on the coffee detail view.
- **Canonical matching:** use `varieties` instead of raw cultivar text.

## Seed

Seeded from the 2026-10-02 token distribution: every token with five or more in-stock mentions gets a code or alias, and the rest start as unmapped audit items. Expected seed: about 60 varieties with families, 6 species, 6 drying methods, and roughly 200 aliases.

## Sequence

1. This ADR.
2. Parchment migration and vocabulary endpoint.
3. Scraper loader, canonicalizer, audit, backfill.
4. Parchment filters, facets, comparison rows, Market Index dimensions, SDK; Cherry and CLI.
5. coffee-app filters and card display (folds into the filter rework's panel).

The filter rework slice 1 does not wait for this chain; variety and drying filters appear in coffee-app when step 5 ships. Step 4 makes them available to API, CLI, and Cherry callers only.

## Consequences

- One mechanism (vocabulary rows plus aliases plus audit) governs varieties, species, and drying, and matches the shape ADR-016 proposes for grades; future taxonomies (appellations, certifications) can use it.
- The runtime-loaded vocabulary means a bad alias row affects writes immediately; aliases go through reviewed migrations, the alias key guarantees one target per alias, and the trigger still guards codes.
- Raw text stays authoritative for display, so no information is lost if a mapping is wrong; a corrected alias plus backfill fixes stored codes.
- Existing `variety` and `dryingMethod` text searches keep working, at the cost of two parallel params per field.
