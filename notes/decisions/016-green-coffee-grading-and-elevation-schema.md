# ADR-016: Green coffee grading and elevation schema

**Status:** Proposed

**Date:** 2026-10-01

## Context

`coffee_catalog.grade` does not hold grades. The scraper's canonical column schema defines it as "Elevation/altitude ONLY" (`"1500 MASL"`, `"1200 - 1800 MASL"`) and routes real grade designations (SHB, Grade 1, AA, EP, screen sizes) into the free-text `appearance` column. The structured `elevation_min_masl` and `elevation_max_masl` columns added for origin authority are written only by sources with a source-specific mapping.

Production evidence, read-only, 2026-10-01, in-stock coffees (2,632):

- Elevation: 1,553 rows have numeric elevation. 581 rows carry elevation only as `grade` text, from about 25 sources with zero parsed rows (Rhoads, Burman, Home Roast, Captain Coffee, Hacea, Sweet Maria's, Smokin Beans, Coffee Shrub, Copan Trade and others). 498 rows have no elevation.
- Every in-stock non-null `grade` (2,133) is elevation text.
- Grade evidence lives in `appearance` (1,251 rows), titles, and descriptions, mixed with prose and supplier product tiers: "Fine Cup (FC), Strictly Soft (SS)", "SHG", "Grade 1, Giling Basah…", "Peaberry", "Microlot", "Regional Select", "Guji G3", "SHG EP", "Kenya AB", "Screen 18+".
- Text mentions across in-stock rows: SHB/SHG/HB 418, EP 377, Ethiopian or Indonesian grade numbers 297, screen 324, moisture 271 (many are drying narrative, not lab results), density 172, cup score terms 90, water activity 10.
- `score_value` (444 in-stock rows) is a bare number with no protocol.

Green coffee is graded along independent dimensions, and each producing country mixes them:

- **Size:** screen size in 64ths of an inch on round-hole sieves (ISO 4150 practice), and peaberry. Kenya, Tanzania and Uganda (AA, AB, PB), Colombia (Supremo, Excelso) and India (AA, AB) grade mainly by size.
- **Altitude or density:** SHB, SHG, HB, HG, with thresholds that differ by country.
- **Defects and preparation:** defect counts are protocol-bound. SCA grades a 350 g sample with Category 1 and Category 2 defects. Brazil's official classification (COB, "NY" types) and Indonesia's national standard count a 300 g sample with their own equivalence tables. Ethiopia's grades combine defects with cup evaluation. Preparation marks such as EP, wet-polished and hand-sorted describe sorting, not quality.
- **Cup quality:** SCA 2004 cupping form scores, SCA Coffee Value Assessment (CVA) affective scores, Q-grader scores, Cup of Excellence jury scores and supplier in-house scores are not interchangeable. Brazil's cup classes (Strictly Soft, Soft, Rioy) are categorical.

Downstream consumers of `grade` today: Parchment listing filters (`grade`, `appearance`, both stripped for unentitled callers), the lot comparison "Grade" row, Purveyor Score provenance (`grade` or `appearance` present adds 3 points), coffee-app's card ("Grade / elevation"), beans overview, Settingsbar sort labels, user-entered beans in `BeanForm`, generated SDK types, the CLI and Cherry tools.

## Decision

Represent elevation, size, grade designations, lab analysis and cup score as separate, protocol-aware fields. All schema changes are additive. `grade` is deprecated, then removed after consumers migrate.

**Principle: disclosed, never inferred.** Columns hold what the supplier states. A code that implies a range (SHB implies altitude, AA implies screen) does not write that range into elevation or screen columns. Implied ranges come from the reference table and are labeled as implied wherever shown. Null means not disclosed.

### 1. Elevation

`elevation_min_masl` and `elevation_max_masl` (existing) are the only elevation fields. A single deterministic parser in the shared post-processing step handles every source: ranges, single values, "above X", feet converted to meters, and thousands separators. Source-structured values take precedence over parsed text, which takes precedence over LLM extraction. The raw string is kept in `grading_evidence`.

### 2. Screen size

New `screen_size_min smallint` and `screen_size_max smallint`, in 64ths of an inch, constrained to 8 through 20. "Screen 18+" stores min 18 and max null. "17/18" stores 17 and 18.

### 3. Grade designations

New `grade_codes text[]` holding namespaced codes, plus a reference table `green_grade_designations`:

- `code` (primary key), for example `KE:AA`, `KE:PB`, `TZ:AA`, `ET:G1`, `ID:G1`, `GT:SHB`, `CR:SHB`, `HN:SHG`, `MX:SHG`, `CO:SUPREMO`, `CO:EXCELSO`, `BR:NY2`, `BR:SS`, `BR:FC`, `VN:G1`, `UG:SCREEN18`, `IN:PLANTATION_A`, `PG:AX`, `PREP:EP`, `PREP:WET_POLISHED`, `PREP:HAND_SORTED`, `PREP:TRIPLE_PICKED`, `SIZE:PEABERRY`.
- `system` (issuing body or convention), `country_code` (nullable for cross-origin codes), `dimension` (`size`, `altitude`, `defects`, `cup`, `preparation`), `label`, `description`.
- `implied_screen_min`, `implied_screen_max`, `implied_elevation_min_masl`: seeded only where the issuing body publishes a definition, with the citation in the seed migration.
- `active` and `sort_order`.

Altitude codes are namespaced by country because thresholds differ. New systems are new rows, not new columns. Tokens the extractor recognizes as grade-like but cannot map are recorded in `grading_evidence` as unmapped and reported by the audit, never discarded or guessed. Supplier product tiers (Microlot, Regional Select, Crown Jewel) are not grades and stay in `appearance`.

### 4. Lab analysis

New `green_analysis jsonb` with a versioned shape, validated by the same Zod schema in the scraper and Parchment and by a database check constraint on value ranges:

```json
{
  "version": 1,
  "moisture_pct": 10.8,
  "water_activity": 0.55,
  "density_g_l": 720,
  "density_method": "free_settled",
  "quakers": null,
  "defects": {
    "protocol": "sca_350g",
    "sample_g": 350,
    "category_1": 0,
    "category_2": 3,
    "full_defect_equivalents": null
  }
}
```

The defect `protocol` values are `sca_350g`, `cob_300g`, `sni_300g`, `ecx` and `unspecified`. Defect counts are compared or ranked only within the same protocol. Values outside physical ranges (moisture 0 to 20, water activity 0 to 1, density 400 to 1000 g/L after unit normalization) are rejected into evidence for review. Narrative drying targets ("dried to 11% moisture") are not lab results and are not written here.

### 5. Cup score

Keep `score_value`. Add `score_protocol` with one of `sca_2004`, `cva_affective`, `q_arabica`, `coe`, `supplier_unspecified`. Rows without a stated protocol use `supplier_unspecified`. Scores are ranked against each other only within the same protocol.

### 6. Evidence

New `grading_evidence jsonb` mirrors `processing_evidence`. Each extracted field records the value, the raw text, the method (`source_structured_field`, `title`, `description_text`, `llm`) and a confidence. Like processing evidence, it is not exposed publicly by default.

### 7. Retiring `grade`

1. The scraper stops writing new elevation text to `grade` once the shared parser ships, and the backfill populates the structured fields.
2. Parchment keeps returning `grade` and accepting the `grade` filter (mapped to elevation) with `deprecated: true` in OpenAPI for at least one SDK minor cycle, with a removal date in the API changelog.
3. Before dropping the column, API usage logs must show no external callers using `grade`, and coffee-app, the CLI and Cherry must read only the new fields.
4. User-entered beans: elevation-shaped text moves to the elevation columns; any other text is preserved in `appearance` for the owner to review.

## Integration plan

### Scraper (upstream)

- `COLUMN_SCHEMA`: add the new fields; the LLM extraction field for elevation captures raw elevation text for the deterministic parser; `appearance` is redefined as physical description prose and supplier tiers after grade tokens are extracted. Grade tokens stay in `appearance` text as well, so nothing disappears from display.
- New `cleaning/gradingExtractor.ts` (alongside the certification and producer extractors): deterministic recognition of codes, screens and lab values from structured source fields, titles, `appearance` and descriptions. The LLM is used only for lab values in prose and must return a supporting quote.
- Source field policies declare which grading fields each source provides structurally (for example Royal's analysis grid, Hacea's "Humidity" and "Density" lines, Sweet Maria's appearance line).
- `SUPPLIER_INTEGRATION_RUBRIC.md`: new suppliers must map grading fields or declare them absent.
- Backfill through `BaseBackfillProcessor` across stocked and unstocked rows: a dry run first, with counts per source, an unmapped-token report and a contradiction report, then apply.
- Audit checks: elevation text present with numeric elevation null fails (the current regression); grading tokens present in text with `grade_codes` empty; unmapped tokens; contradictions such as `KE:AA` with a disclosed screen of 14; completeness per source for each new field.
- `embeddingService` includes grade labels and screen in embedding text.

### Database (Parchment migrations)

New columns, the reference table and its seed, check constraints, a GIN index on `grade_codes`, a btree index on `screen_size_min`, updates to catalog RPCs and views that project catalog columns, release contracts and read-only verifier SQL.

### Parchment API

- `/v1/catalog` responses add a nested `grading` object: `elevation {min_masl, max_masl}`, `screen {min, max}`, `codes [{code, label, dimension, system, implied}]`, `analysis` and `cup_score {value, protocol}`. Top-level `grade` remains until removal.
- Listing filters: `screenMin`, `screenMax`, `gradeCode` (repeatable), `gradeDimension`, `peaberry`, `labAnalyzed`, `moistureMax`, `waterActivityMax`, `densityMin`, `scoreProtocol`. The existing `elevationMinMasl` and `elevationMaxMasl` filters match on range overlap.
- Facets: counts per grade code grouped by dimension, screen distribution and elevation bands.
- New `GET /v1/catalog/grades`: the designation vocabulary, so web, CLI and Cherry explain codes consistently.
- Comparison: rows for Elevation, Screen size, one row per grade dimension, Moisture, Water activity, Density, Defects (best marks only within one protocol) and Cup score (best marks only within one protocol). Physical attributes get no "best" marks; price remains the only ranked default.
- Planned segment comparison adds elevation band, screen size and grade code as dimensions.
- Entitlement: new fields follow the existing gating for elevation and appearance until pricing review decides otherwise.

### Parchment Intelligence and Market Index

- Like-for-like value: price premiums by grade tier within an origin (AA versus AB within Kenya, SHB versus HB within Guatemala), and by elevation band and screen size.
- Buy signals and "Is this price fair?" compare against peers with the same origin and grade tier, not the whole origin.
- Quality-aware value (slice 7) uses grading dimensions and protocol-matched cup scores instead of Purveyor Score alone.

### Purveyor Score

The provenance factor moves from "`grade` or `appearance` present" to structured disclosure: numeric elevation, screen, grade codes and lab analysis. This bumps `purveyor_score_version`, and the score shift is reported before release.

### SDK

Regenerated types for the `grading` object, a `catalog.grades()` helper, typed new filters, a minor version bump and a deprecation note for `grade`.

### Cherry

Catalog search accepts elevation range, screen, grade codes and peaberry. Facets return grade counts. A grade reference tool (or the facets tool) explains codes from the vocabulary endpoint. Comparison picks up the new rows. Prompt guidance: size grades are not quality grades, and scores and defects compare only within one protocol.

### CLI

`purvey catalog search` gains `--elevation-min`, `--elevation-max`, `--screen-min`, `--grade`, `--peaberry` and `--lab-analyzed`. New `purvey catalog grades` lists the vocabulary. `purvey catalog compare` includes the new rows. JSON output carries the `grading` object.

### coffee-app

- Catalog filters: elevation range, screen size, grade chips grouped by dimension, peaberry, EP and "lab analyzed".
- Coffee card: elevation in the origin section; a "Bean and grade" section with labeled code chips explained from the vocabulary; a lab analysis block when present; implied ranges labeled as implied.
- Numeric elevation sorting; beans pages and `BeanForm` use the structured fields with a code picker; docs content explains grading.
- Subscription copy is updated if any new field is plan-gated.

## Sequence

1. This ADR.
2. Scraper elevation changeover and backfill. This needs no schema change and fixes the 581 text-only rows.
3. Migration: new columns, reference table and seed.
4. Scraper grading extractor, audit checks and backfill (dry run, then apply).
5. Parchment API, SDK minor release, Cherry tools and comparison rows.
6. CLI, coffee-app filters and display, Purveyor Score version bump.
7. Market Index like-for-like value and segment dimensions.
8. `grade` removal after the deprecation window and usage check.

## Consequences

- One stable, additive contract covers every common grading system; new systems extend the reference table without API changes.
- Many fields will be sparse. Facets show counts so filters do not look broken, and "Not disclosed" stays distinct from a negative value.
- Separating disclosed from implied values keeps the catalog honest at the cost of fewer filled columns.
- Purveyor Scores shift when the provenance factor changes.
- Out of scope: crop year and harvest date (freshness matters for green buyers and needs its own decision), and robusta-specific cup protocols beyond the codes listed.
