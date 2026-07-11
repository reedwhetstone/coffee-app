# Process transparency backgeneration implementation plan

**Date:** 2026-04-29
**Status:** Proposed
**Related:** ADR-004, ADR-005, PR #302, PR #304, `coffee-scraper`, `coffee-app`

## Goal

Fill and maintain the processing-transparency columns added by ADR-004 without weakening the ADR-005 access-tier contract.

This plan covers a clean backgeneration path for missing data in the new process columns and the follow-up work needed before those columns become polished member-level facets.

## Columns in scope

ADR-004 process-transparency columns:

- `processing_base_method`
- `fermentation_type`
- `process_additives`
- `process_additive_detail`
- `fermentation_duration_hours`
- `processing_notes`
- `processing_disclosure_level`
- `processing_confidence`
- `processing_evidence`

Adjacent column that is already useful but not normalized enough for a dropdown:

- `drying_method`

## Current live coverage snapshot

A read-only public `/v1/catalog?stocked=all&page=N&limit=100` sample on 2026-04-29 returned 2,814 rows.

Coverage in that sample:

| Field                         | Populated rows | Unique values | Notes                                                                                        |
| ----------------------------- | -------------: | ------------: | -------------------------------------------------------------------------------------------- |
| `processing_base_method`      |             51 |             5 | Has useful seed coverage. Values: `Decaf`, `Natural`, `Semi-Washed`, `Washed`, `Wet-Hulled`. |
| `fermentation_type`           |              0 |             0 | Not ready for UI facets.                                                                     |
| `process_additives`           |              0 |             0 | Not ready for UI facets.                                                                     |
| `process_additive_detail`     |              0 |             0 | Not ready for UI facets.                                                                     |
| `fermentation_duration_hours` |              1 |             1 | Too sparse for filtering.                                                                    |
| `processing_notes`            |             20 |            20 | Useful for evidence and card context, not facet-ready.                                       |
| `processing_disclosure_level` |             54 |             3 | Useful internally. Values: `high_detail`, `none`, `structured`.                              |
| `processing_confidence`       |             51 |             4 | Useful for gating and QA, not a public free filter.                                          |
| `drying_method`               |          1,305 |           171 | Strong coverage, poor normalization. Needs taxonomy before dropdown exposure.                |

## Existing scraper support

The `coffee-scraper` codebase already has most of the plumbing required for a clean backgeneration run.

### Canonical schema

`coffee-scraper/scrape/schema/columnDefinitions.ts` includes the ADR-004 fields with AI extraction rules, format constraints, and anti-examples. The canonical schema drives:

- TypeScript field names
- Zod validation schemas
- AI cleaning prompt generation
- camelCase to snake_case database mapping

`coffee-scraper/scrape/schema/fieldMapper.ts` builds `camelToDb` and `dbToCamel` from that schema, excluding only `deferDbWrite` fields.

### Extraction prompt

`coffee-scraper/scrape/cleaning/extractionPrompt.ts` generates a unified extraction prompt from `AI_EXTRACTABLE_FIELDS`. It already includes critical rules that match ADR-004:

- use `null` when source information is absent
- do not invent UI placeholders for missing processing metadata
- do not infer additives from tasting or aroma descriptors alone
- separate base process, fermentation technique, additives, drying method, and flavor descriptors
- include short evidence quotes for additive, fermentation, duration, or low-confidence claims

### Deterministic post-processing

`coffee-scraper/scrape/cleaning/postProcessors.ts` already normalizes and bounds process fields:

- base method through `normalizeProcessingBaseMethod`
- fermentation type through `normalizeFermentationType`
- additives through evidence-bound extraction
- additive details through evidence-bound extraction
- duration through evidence-backed extraction
- disclosure level through `classifyProcessingDisclosure`
- confidence through disclosure-aware scoring
- evidence through `processProcessingEvidence`

`coffee-scraper/scrape/dataValidators.ts` contains the normalizers and extraction helpers, including:

- `PROCESSING_BASE_METHOD_VALUES`
- `FERMENTATION_TYPE_VALUES`
- `PROCESS_ADDITIVE_VALUES`
- `PROCESSING_DISCLOSURE_LEVEL_VALUES`
- `normalizeProcessingBaseMethod`
- `normalizeFermentationType`
- `extractProcessAdditivesFromText`
- `extractProcessAdditiveDetailFromText`
- `extractFermentationDurationHours`
- `classifyProcessingDisclosure`
- `buildProcessingBreakdown`

### Backfill path

`coffee-scraper/scrape/backfillDataCleaning.ts` already selects the process columns and includes them in `cleanableFields`.

It converts database rows into `ScrapedData`, calls `UnifiedCleaner.clean`, then writes returned fields through `camelToDb`.

That is the right backbone, but it is not yet a clean targeted process backgeneration workflow because:

- it uses the generic `fieldName: "cleaned"` fetch path from `BaseBackfillProcessor`, which is not process-field specific
- `BaseBackfillProcessor.fetchRecordsNeedingProcessing` only fetches rows where one configured field is `null`
- the current generic backfill has no explicit dry-run/report mode
- process fields should be updated conservatively, with evidence and review flags, not treated as a blanket generic cleaning pass

## App support and API exposure

PR #302 adds useful app-side support:

- `src/lib/catalog/catalogResourceItem.ts` maps structured fields into a nested `process` summary.
- `src/lib/components/CoffeeCard.svelte` displays process data as factual coffee-card visibility.
- `src/lib/data/catalog.ts` includes resource projection columns for structured process fields.
- `src/lib/server/catalogResource.ts` can expose a normalized nested process object without exposing raw `processing_evidence` by default.

This should be kept.

What should not ship as-is is the public working query leverage. Backgenerated fields should improve data visibility first, then member/API paid search leverage after entitlement and quality gates are in place.

## Backgeneration design

Create a targeted process-transparency backgeneration command in `coffee-scraper`, not an ad hoc one-off script.

Suggested file:

- `coffee-scraper/scrape/backfillProcessingTransparency.ts`

### Requirements

1. Select only rows with enough source text to support processing extraction.
2. Target rows where any ADR-004 field is missing or stale:
   - `processing_base_method is null`
   - `fermentation_type is null` where text has fermentation cues
   - `process_additives is null` where text has additive cues
   - `process_additive_detail is null` where text has explicit additive detail
   - `fermentation_duration_hours is null` where text has duration cues
   - `processing_disclosure_level is null`
   - `processing_confidence is null` when disclosure is not `none`
   - `processing_evidence is null` when a structured claim needs provenance
3. Include existing values in the prompt so the cleaner can preserve valid scraper-provided fields.
4. Write only fields that have source-supported values.
5. Preserve `null` for absent or undisclosed details.
6. Never write `none`, `unspecified`, or `None Stated` as a substitute for silence unless source evidence explicitly supports that distinction.
7. Support `--dry-run`, `--limit`, `--source`, `--id`, `--stocked-only`, and `--all` flags.
8. In dry-run mode, print and optionally write a JSONL diff with before/after values, evidence, confidence, and review flags.
9. In write mode, update rows in small batches and log a summary by field.
10. Never run write mode from product/app automation without explicit operator intent.

### Candidate selection

Use a process-specific selector rather than `BaseBackfillProcessor.fetchRecordsNeedingProcessing`.

Recommended candidate query shape:

- `select` the source text fields and all current process fields
- default `stocked = true`
- require at least one of:
  - `description_long`
  - `description_short`
  - `farm_notes`
  - `processing`
  - `drying_method`
- prioritize rows with process evidence cues:
  - `anaerobic`
  - `carbonic`
  - `lactic`
  - `ferment`
  - `co-ferment`
  - `infused`
  - `inoculated`
  - `mossto` or `mosto`
  - `yeast`
  - `fruit` near processing terms
  - `hours` or `days` near fermentation terms

This avoids wasting model calls on rows that cannot gain structured transparency.

### Update policy

Write field values only when they pass these checks:

- `processing_base_method`: normalized to the allowed base method taxonomy
- `fermentation_type`: normalized to allowed fermentation taxonomy and source-supported
- `process_additives`: non-empty allowed additive list and source-supported, never from tasting notes alone
- `process_additive_detail`: source-supported raw additive or culture detail
- `fermentation_duration_hours`: positive numeric hours with explicit fermentation duration evidence
- `processing_notes`: concise processing note, not copied marketing paragraphs
- `processing_disclosure_level`: one of `none`, `label_only`, `structured`, `narrative`, `high_detail`
- `processing_confidence`: number from 0 to 1, null when disclosure is `none`
- `processing_evidence`: valid provenance envelope with short quotes and `schemaVersion: 1`

If evidence conflicts or multiple base methods are detected without explanation, set `needsReview: true` in `processing_evidence` rather than guessing.

## Drying method normalization track

`drying_method` has much better coverage than the new process fields, but 171 raw values is too noisy for dropdown UX.

Create a separate normalization pass before member-level dropdown exposure.

### Suggested normalized taxonomy

- `Raised beds`
- `African beds`
- `Patio-dried`
- `Sun-dried`
- `Mechanical`
- `Greenhouse`
- `Covered beds`
- `Combination`
- `Other`

### Requirements

1. Do not overwrite raw `drying_method` until product decides whether to preserve raw text separately.
2. Prefer adding a derived app-level facet mapper first, for example `normalizeDryingMethodFacet(raw: string): string[]`.
3. Treat multi-method values like `Raised beds, Patio-dried` as multi-select facets.
4. Add coverage/cardinality reporting before exposing the facet.

## Implementation slices

### Slice 1: process backgeneration audit command

**Repo:** `coffee-scraper`

**Objective:** add a read-only report command to measure missing process fields and candidate rows.

Likely files:

- `scrape/auditProcessingTransparency.ts` or `scrape/backfillProcessingTransparency.ts`
- `scrape/dataValidators.test.ts`
- `scrape/cleaning/postProcessors.*.test.ts`
- package script if existing conventions support it

Output should include:

- total rows checked
- rows with source text
- null counts per ADR-004 column
- candidate counts per evidence cue
- current value cardinality per column
- top raw `drying_method` values
- sample row IDs for manual review

Validation:

```bash
pnpm test -- --run scrape/dataValidators.test.ts scrape/cleaning/unifiedCleaner.processing.test.ts scrape/cleaning/postProcessors.country.test.ts
pnpm check
```

### Slice 2: dry-run backgeneration

**Repo:** `coffee-scraper`

**Objective:** process candidate rows through `UnifiedCleaner` without DB writes.

Flags:

```bash
pnpm backfill:processing-transparency -- --dry-run --limit 25
pnpm backfill:processing-transparency -- --dry-run --source "Royal Coffee" --limit 25
pnpm backfill:processing-transparency -- --dry-run --id 12345
```

Dry-run artifact:

- JSONL with `id`, `source`, `name`, before fields, proposed fields, evidence, review flags, and rejection reasons
- summary table by field and source

Acceptance:

- dry-run proposes no additive claims from tasting notes alone
- rows without process evidence retain null fields
- existing valid values are preserved
- confidence and disclosure levels are consistent with evidence

### Slice 3: guarded write mode

**Repo:** `coffee-scraper`

**Objective:** allow explicit, small-batch DB writes after dry-run review.

Flags:

```bash
pnpm backfill:processing-transparency -- --write --limit 50
pnpm backfill:processing-transparency -- --write --source "Ally Coffee" --limit 50
pnpm backfill:processing-transparency -- --write --id 12345
```

Safety requirements:

- `--write` required for DB writes
- default is dry-run
- require `--limit` for first implementation
- log every field count changed
- skip rows with no proposed database-writeable fields
- never clear non-null fields unless a later explicit repair mode is added
- support resume by querying null/stale fields rather than local state

### Slice 4: app-side member facet readiness report

**Repo:** `coffee-app`

**Objective:** add a lightweight script or test fixture that can decide which process fields are facet-ready.

Report fields:

- non-null count
- coverage percentage
- unique count
- top values
- placeholder/null/unknown distinctions
- buyer-readable status
- recommended access level

Initial thresholds:

- dropdown-ready when coverage is meaningful and unique count is small enough to scan
- high-cardinality values require search chips/typeahead, not dropdowns
- values with raw supplier wording need normalization first

### Slice 5: member-only facet enablement

**Repo:** `coffee-app`

**Objective:** once entitlement and data readiness are in place, enable process facets for members.

Allowed initial member facets after backgeneration:

- `processing_base_method`
- `processing_disclosure_level`
- `processing_confidence_min`

Hold until coverage improves:

- `fermentation_type`
- `process_additives`
- `process_additive_detail`
- `fermentation_duration_hours`

Hold until normalized:

- `drying_method`

## Required tests

### `coffee-scraper`

- `normalizeProcessingBaseMethod` maps common strings without treating drying-only evidence as natural process.
- `normalizeFermentationType` handles anaerobic, carbonic, lactic, yeast-inoculated, mossto, co-fermented, and experimental phrases.
- `extractProcessAdditivesFromText` requires processing evidence and rejects tasting-note-only fruit.
- `extractProcessAdditiveDetailFromText` returns concrete details only when evidence exists.
- `extractFermentationDurationHours` handles hours and days near fermentation cues.
- `processProcessingEvidence` creates valid envelopes with short quotes, supported fields, `needsReview`, and `schemaVersion: 1`.
- Backgeneration dry-run emits proposed diffs without DB writes.
- Write mode cannot run unless `--write` is present.

### `coffee-app`

- `CoffeeCard.svelte` displays process summary when fields are present.
- `/v1/catalog` includes nested `process` summary but not raw `processing_evidence` by default.
- Process facets are blocked for anonymous/viewer until entitlement allows them.
- Filter metadata omits fields that are not usable by the caller.
- Empty or low-coverage fields do not render misleading dropdown controls.

## Validation commands

`coffee-scraper`:

```bash
pnpm test -- --run scrape/dataValidators.test.ts scrape/cleaning/unifiedCleaner.processing.test.ts scrape/cleaning/postProcessors.country.test.ts
pnpm check
```

`coffee-app`:

```bash
pnpm test -- --run src/lib/catalog/processDisplay.test.ts src/lib/components/CoffeeCard.svelte.test.ts src/routes/v1/catalog/catalog.test.ts src/routes/api/catalog/filters/filters.test.ts src/routes/catalog/page.server.test.ts
pnpm check
```

## Rollout sequence

1. Land PR #302 entitlement correction in `coffee-app` so advanced process query leverage is not public by accident.
2. Add the `coffee-scraper` audit command and run read-only coverage reports.
3. Add dry-run backgeneration and inspect sample outputs by source.
4. Run small write batches only after dry-run review.
5. Re-run live coverage and cardinality report.
6. Enable member-only process facets only for fields that pass readiness thresholds.
7. Normalize `drying_method` into a buyer-readable member facet in a separate PR.

## Non-goals

- Do not expose raw `processing_evidence` publicly.
- Do not infer additives from tasting notes or marketing flavor copy.
- Do not make `fermentation_type` or `process_additives` public dropdowns while coverage is zero.
- Do not turn `drying_method` into a dropdown using raw 171-value supplier text.
- Do not combine scraper write-mode backgeneration with catalog entitlement changes in one PR.
