# ADR-016: Green coffee grading and elevation schema

**Status:** Accepted (Reed, 2026-10-04, #purveyors)

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

`elevation_min_masl` and `elevation_max_masl` (existing) are the only elevation fields. A single deterministic parser in the shared post-processing step handles every source: ranges, single values, "above X", feet converted to meters, and thousands separators. Source-structured values take precedence over deterministically parsed text, which takes precedence over text the LLM located. The LLM may only locate raw elevation text and return it with a supporting quote; the deterministic parser always produces the numbers. The raw string stays in `grade` until removal (section 7) and is also recorded in `grading_evidence` once that column exists.

### 2. Screen size

New `screen_size_min smallint` and `screen_size_max smallint`, in 64ths of an inch, constrained to 8 through 20, with min required whenever max is set and min not greater than max. "Screen 18" stores 18 and 18. "Screen 18+" stores min 18 and max null, meaning open-ended upward. "17/18" stores 17 and 18.

### 3. Grade designations

New `grade_codes text[]` holding namespaced codes, plus a reference table `green_grade_designations`:

- `code` (primary key), always `<system>:<token>`, for example `KE:AA`, `KE:PB`, `TZ:AA`, `ET:G1`, `ID:G1`, `GT:SHB`, `CR:SHB`, `HN:SHG`, `MX:SHG`, `CO:SUPREMO`, `CO:EXCELSO`, `BR:NY2`, `BR:SS`, `BR:FC`, `VN:G1`, `UG:SCREEN18`, `IN:PLANTATION_A`, `PG:AX`, `PREP:EP`, `PREP:WET_POLISHED`, `PREP:HAND_SORTED`, `PREP:TRIPLE_PICKED`, `SIZE:PEABERRY`.
- `system`: a stable slug identifying one grading system, and the required prefix of `code` (enforced by a check constraint). A country's national standard uses the ISO country code; cross-origin conventions use `PREP` and `SIZE`; a second system within the same country gets its own slug (for example `<CC>_<BODY>`), so the same token can exist under both systems without conflation.
- `issuing_body`, `country_code` (nullable for cross-origin codes), `dimensions` (a non-empty set drawn from `size`, `altitude`, `defects`, `cup`, `preparation`), `label`, `description`. Composite grades carry every dimension they encode; `ET:G1`, for example, has `{defects, cup}`.
- `implied_screen_min`, `implied_screen_max`, `implied_elevation_min_masl`, `implied_elevation_max_masl`: seeded only where the issuing body publishes a definition, with the citation in the seed migration. A null max means the published definition has no upper threshold.
- `active` and `sort_order`.

Designation rows are never deleted; retired codes are set `active = false`. Every table that stores `grade_codes` has a constraint trigger that rejects any element without a matching `green_grade_designations.code`, because PostgreSQL cannot attach a foreign key to array elements. The scraper, backfill, Parchment and the bean editor validate against the same vocabulary before writing, so the trigger is the backstop, not the first check.

Altitude codes are namespaced by system, which for national standards is the country, because thresholds differ. New systems are new rows, not new columns. Tokens the extractor recognizes as grade-like but cannot map are recorded in `grading_evidence` as unmapped and reported by the audit, never discarded or guessed. Supplier product tiers (Microlot, Regional Select, Crown Jewel) are not grades and stay in `appearance`.

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

The defect `protocol` values are `sca_350g`, `cob_300g`, `sni_300g`, `ecx` and `unspecified`. Defect counts are compared or ranked only within the same established protocol. `unspecified` is a fallback, not a protocol: those counts are displayed with "protocol not stated" and are never ranked, given best marks, or used in comparisons, including against other `unspecified` records. Values outside physical ranges (moisture 0 to 20, water activity 0 to 1, density 400 to 1000 g/L after unit normalization) are rejected into evidence for review. Narrative drying targets ("dried to 11% moisture") are not lab results and are not written here.

### 5. Cup score

Keep `score_value`. Add `score_protocol` with one of `sca_2004`, `cva_affective`, `q_arabica`, `coe`, `supplier_unspecified`. Rows without a stated protocol use `supplier_unspecified`. Scores are ranked against each other only within the same established protocol. Like `unspecified` defects, `supplier_unspecified` scores are displayed with "protocol not stated" and are never ranked, given best marks, or used in protocol-matched comparisons or Market Index quality signals, because different suppliers use different scales. Callers can still select them with `scoreProtocol=supplier_unspecified`.

### 6. Evidence

New `grading_evidence jsonb` mirrors `processing_evidence`. Each extracted field records the value, the raw text, the source (`source_structured_field`, `title`, `appearance`, `description_text`, `legacy_grade`), the method (`structured_mapping`, `deterministic_parser`, `llm`) and a confidence. Source and method are independent, so an LLM-extracted lab value from description prose records `description_text` and `llm`, and a code parsed from `appearance` records `appearance` and `deterministic_parser`. Like processing evidence, it is not exposed publicly by default.

### 7. Retiring `grade`

1. The scraper keeps writing the raw elevation text to `grade` throughout the deprecation window, alongside the parsed elevation columns, so legacy readers and the legacy filter see unchanged behavior and the raw string is retained before `grading_evidence` exists. Writes to `grade` stop only in the removal step.
2. Parchment keeps returning `grade` and accepting the `grade` filter with its current semantics, a legacy text match on the stored value that is not mapped to elevation, with `deprecated: true` in OpenAPI for at least one SDK minor cycle and a removal date in the API changelog. Deprecation notes direct new clients to `elevationMinMasl`, `elevationMaxMasl` and `gradeCode`.
3. Before dropping the column, API usage logs must show no external callers using `grade`, and coffee-app, the CLI and Cherry must read only the new fields. Removal is ordered so no deployed writer or reader references a missing column: the scraper release that stops writing `grade` and the Parchment release that stops returning it and accepting its filter deploy first, and the migration that drops the column, with the RPC and view updates that stop projecting it, follows.
4. User-entered beans: elevation-shaped text moves to the elevation columns; any other text is preserved in `appearance` for the owner to review.

## Integration plan

### Scraper (upstream)

- `COLUMN_SCHEMA`: add the new fields; the LLM extraction field for elevation captures raw elevation text for the deterministic parser; `appearance` is redefined as physical description prose and supplier tiers after grade tokens are extracted. Grade tokens stay in `appearance` text as well, so nothing disappears from display.
- New `cleaning/gradingExtractor.ts` (alongside the certification and producer extractors): deterministic recognition of codes, screens and lab values from structured source fields, titles, `appearance` and descriptions. LLM use is limited to two cases, each requiring a supporting verbatim quote recorded in evidence: locating raw elevation text that the deterministic parser then converts (section 1), and lab values in prose. Grade codes and screen sizes are deterministic only.
- Source field policies declare which grading fields each source provides structurally (for example Royal's analysis grid, Hacea's "Humidity" and "Density" lines, Sweet Maria's appearance line).
- `SUPPLIER_INTEGRATION_RUBRIC.md`: new suppliers must map grading fields or declare them absent.
- Backfill through `BaseBackfillProcessor` across stocked and unstocked rows: a dry run first, with counts per source, an unmapped-token report and a contradiction report, then apply.
- Audit checks: elevation text present with numeric elevation null fails (the current regression); grading tokens present in text with `grade_codes` empty; unmapped tokens; contradictions such as `KE:AA` with a disclosed screen of 14; completeness per source for each new field.
- `embeddingService` includes grade labels and screen in embedding text.

### Database (Parchment migrations)

New columns, the reference table and its seed, check constraints, the `grade_codes` membership constraint trigger, a GIN index on `grade_codes`, a btree index on `screen_size_min`, updates to catalog RPCs and views that project catalog columns, release contracts and read-only verifier SQL.

### Parchment API

- `/v1/catalog` responses add a nested `grading` object: `elevation {min_masl, max_masl}`, `screen {min, max}`, `codes [{code, label, dimensions, system, implied {screen_min, screen_max, elevation_min_masl, elevation_max_masl}}]`, `analysis` and `cup_score {value, protocol}`. Top-level `grade` remains until removal.
- Listing filters: `screenMin`, `screenMax`, `includeUnknownScreen`, `gradeCode` (repeatable), `gradeDimension`, `peaberry`, `labAnalyzed`, `moistureMax`, `waterActivityMax`, `densityMin`, `scoreProtocol`. Filter semantics:
  - Screen uses the same rules as the existing elevation filters. A row's disclosed interval is `[screen_size_min, screen_size_max]`, with a null max meaning open-ended upward. It matches when that interval overlaps the requested closed interval, and a missing request side is unbounded, so a `17/18` lot matches `screenMin=18`. Rows with no disclosed screen are excluded when either bound is set unless `includeUnknownScreen=true`.
  - The existing `elevationMinMasl`, `elevationMaxMasl` and `includeUnknownElevation` filters keep their current closed-interval overlap behavior.
  - Implied ranges from grade codes never satisfy screen or elevation filters.
  - Repeated `gradeCode` values match rows that carry any listed code. `gradeDimension` matches rows with at least one code whose `dimensions` include the value.
  - `moistureMax`, `waterActivityMax` and `densityMin` are inclusive and exclude rows where the value is not disclosed.
- Facets: counts per grade code grouped by dimension (a composite code is counted under each of its dimensions, so dimension groups do not sum to the row total), screen distribution and elevation bands.
- New `GET /v1/catalog/grades`: the designation vocabulary, so web, CLI and Cherry explain codes consistently. It is part of the `/v1/catalog` family and uses the same access policy: a Bearer credential is required (anonymous callers get 401), any first-party session including viewers is accepted, and API keys need `catalog:read` on any plan. The public website reaches it through the coffee-app BFF's server-held demo key. The vocabulary is reference data, not catalog rows, so it is identical for every authorized caller and is not subject to row projection or collection item limits. API-key calls count against the account request quota and return the usual `X-RateLimit-*` headers.
- Comparison: rows for Elevation, Screen size, one row per grade dimension (a composite code appears in each of its dimension rows), Moisture, Water activity, Density, Defects (best marks only within one established protocol) and Cup score (best marks only within one established protocol). Physical attributes get no "best" marks; price remains the only ranked default.
- Planned segment comparison adds elevation band, screen size and grade code as dimensions.
- Entitlement: new fields follow the existing gating for elevation and appearance until pricing review decides otherwise.

### Parchment Intelligence and Market Index

- Like-for-like value: price premiums by grade tier within an origin (AA versus AB within Kenya, SHB versus HB within Guatemala), and by elevation band and screen size.
- Buy signals and "Is this price fair?" compare against peers with the same origin and grade tier, not the whole origin.
- Quality-aware value (slice 7) uses grading dimensions and protocol-matched cup scores instead of Purveyor Score alone. `unspecified` defects and `supplier_unspecified` scores are excluded.

### Purveyor Score

The provenance factor moves from "`grade` or `appearance` present" to structured disclosure: numeric elevation, screen, grade codes and lab analysis. This bumps `purveyor_score_version`, and the score shift is reported before release.

### SDK

Regenerated types for the `grading` object, a `catalog.grades()` helper, typed new filters, a minor version bump and a deprecation note for `grade`.

### Cherry

Catalog search accepts elevation range, screen, grade codes and peaberry. Facets return grade counts. A grade reference tool (or the facets tool) explains codes from the vocabulary endpoint. Comparison picks up the new rows. Prompt guidance: size grades are not quality grades, scores and defects compare only within one established protocol, and values with an unstated protocol are never compared.

### CLI

`purvey catalog search` gains `--elevation-min`, `--elevation-max`, `--screen-min`, `--grade`, `--peaberry` and `--lab-analyzed`. New `purvey catalog grades` lists the vocabulary. `purvey catalog compare` includes the new rows. JSON output carries the `grading` object.

### coffee-app

- Catalog filters: elevation range, screen size, grade chips grouped by dimension (composite codes appear in each of their groups), peaberry, EP and "lab analyzed".
- Coffee card: elevation in the origin section; a "Bean and grade" section with labeled code chips explained from the vocabulary; a lab analysis block when present; implied ranges labeled as implied.
- Numeric elevation sorting; beans pages and `BeanForm` use the structured fields with a code picker; docs content explains grading.
- Subscription copy is updated if any new field is plan-gated.

## Sequence

1. This ADR.
2. Scraper elevation changeover and backfill. This needs no schema change and fixes the 581 text-only rows. The scraper keeps writing raw elevation text to `grade`, so the raw value is retained until `grading_evidence` exists.
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
