# Processing Transparency Implementation Plan

**Date:** 2026-04-24
**Status:** Proposed
**Primary repo:** `coffee-app`
**Related repo:** `coffee-scraper`
**Trigger:** PR #208, `blog: Is Co-Fermentation Cheating? Wrong Question.`, merged 2026-04-24

## Why this exists

PR #208 made the product argument clearly: the co-fermentation debate is less about whether one method is legitimate and more about whether the market has enough structured disclosure to compare methods honestly. The current product can filter on a single `processing` string, but that field collapses different concepts:

- base method, such as washed, natural, honey, wet-hulled
- fermentation environment, such as aerobic, anaerobic, carbonic maceration
- additive inputs, such as fruit, yeast, hops, spices, or none
- fermentation duration
- drying method
- supplier disclosure quality and evidence

That makes `processing = Anaerobic` useful but insufficient. A hop co-ferment, a yeast-inoculated anaerobic natural, and a conventional anaerobic lot can all collapse into one bucket even though their disclosure, risk, buyer intent, and competition implications differ.

The implementation should turn the blog methodology into product infrastructure: preserve the legacy processing label for compatibility, then add a structured processing breakdown with provenance, confidence, and evidence.

## Current state

### `coffee-app`

Relevant current surfaces:

- Database table: `supabase/schema.sql`, `public.coffee_catalog`
  - existing fields include `processing text` and `drying_method text`
  - no current fields for base method, fermentation type, additives, duration, disclosure level, confidence, or evidence
- Database generated types: `src/lib/types/database.types.ts`
  - current catalog row includes `processing`, `drying_method`, `price_tiers`, `wholesale`, and other catalog fields
- Catalog data layer: `src/lib/data/catalog.ts`
  - `CatalogSearchOptions.processing` maps to `processing ilike`
  - `CatalogSearchOptions.dryingMethod` searches `processing OR drying_method`
  - filter metadata selects `source, continent, country, processing, cultivar_detail, type, grade, appearance, arrival_date`
- API resource layer: `src/lib/server/catalogResource.ts`
  - `/v1/catalog` and `/api/catalog` share the catalog data layer
  - anonymous filtering is intentionally narrow: `country`, `processing`, `name`
- Product surfaces:
  - `/catalog` exposes country, processing, and name filters
  - `CoffeeCard.svelte` displays the single `coffee.processing` value
  - `/analytics` has processing distribution based on `processing`
  - docs and API pages mention catalog/process filtering as one field

### `coffee-scraper`

Relevant current surfaces:

- Scraped data type: `scrape/types/interfaces.ts`
  - includes `processing: string | null` and `dryingMethod: string | null`
  - no structured processing breakdown or provenance fields
- Canonical field schema: `scrape/schema/columnDefinitions.ts`
  - `processing` and `dryingMethod` are AI-extractable and scraper-provided
  - field descriptions are one-dimensional; they do not ask for base method vs fermentation vs additives
- Unified LLM cleaner: `scrape/cleaning/unifiedCleaner.ts` and `scrape/cleaning/extractionPrompt.ts`
  - one extraction prompt reads existing fields plus descriptions and returns the canonical field set
  - at most one unified extraction call before AI descriptions/tasting notes
- Deterministic processing normalization: `scrape/dataValidators.ts`
  - canonical values include `Washed`, `Natural`, `Honey`, `Semi-Washed`, `Wet-Hulled`, `Anaerobic`, `Pulped Natural`, `Carbonic Maceration`, `Fermented`, `Lactic Fermentation`, and decaf methods
  - unknown exotic processing terms pass through for review instead of being dropped
- Supplier reality:
  - some sources expose structured tables or categories, such as Prime Green Coffee's process categories
  - many sources encode process detail only in descriptions, farm notes, or product names
  - several suppliers provide no structured processing field at all

## Product principle

Do not replace `processing` yet. Make `processing` the backward-compatible display/search label, and add structured fields that explain what the label means.

The schema should distinguish three states that are currently conflated:

1. **Explicit none:** supplier says no additives, conventional fermentation, or no special process.
2. **Unknown:** supplier does not disclose enough information.
3. **Inferred:** the agent inferred a likely value from prose, categories, or naming patterns, with evidence and confidence.

This matters. `additives = none` and `additives = unknown` are commercially and legally different claims.

## Target data model

Use additive columns for queryable fields plus a JSONB evidence envelope for provenance. This is more practical than a fully normalized process taxonomy table right now because the taxonomy is still moving, but it keeps API/filter fields indexable.

### New `coffee_catalog` columns

```sql
ALTER TABLE public.coffee_catalog
  ADD COLUMN processing_base_method text,
  ADD COLUMN fermentation_type text,
  ADD COLUMN process_additives text[],
  ADD COLUMN process_additive_detail text,
  ADD COLUMN fermentation_duration_hours numeric,
  ADD COLUMN processing_notes text,
  ADD COLUMN processing_disclosure_level text,
  ADD COLUMN processing_confidence numeric,
  ADD COLUMN processing_evidence jsonb;
```

Recommended meanings:

- `processing_base_method`
  - canonical base bucket: `Washed`, `Natural`, `Honey`, `Pulped Natural`, `Semi-Washed`, `Wet-Hulled`, `Monsooned`, `Decaf`, `Other`, `Unknown`
- `fermentation_type`
  - process environment or technique: `Aerobic`, `Anaerobic`, `Carbonic Maceration`, `Lactic Fermentation`, `Yeast Inoculated`, `Mossto`, `Co-Fermented`, `Experimental`, `None Stated`, `Unknown`
- `process_additives`
  - controlled array: `fruit`, `yeast`, `hops`, `spice`, `botanical`, `mossto`, `starter-culture`, `other`, `none`, `unspecified`
  - never default to `none`; use `unspecified` when not disclosed
- `process_additive_detail`
  - free text for explicit named additives, such as `hops`, `mandarin`, `cinnamon`, `wine yeast`, `coffee mossto`
- `fermentation_duration_hours`
  - numeric duration only when explicitly stated or safely converted from days
- `processing_notes`
  - concise human-readable normalized note; no marketing copy
- `processing_disclosure_level`
  - `none`, `label_only`, `structured`, `narrative`, `high_detail`
- `processing_confidence`
  - 0 to 1 confidence for the structured breakdown
- `processing_evidence`
  - JSONB envelope with raw evidence, source path, extraction method, and review state

Example evidence envelope:

```json
{
	"method": "agent_description_pass",
	"source_fields": ["description_long", "farm_notes", "processing"],
	"raw_processing": "Anaerobic Natural with hops",
	"evidence": [
		{
			"field": "description_long",
			"quote": "fermented with hops",
			"supports": ["process_additives", "fermentation_type"]
		}
	],
	"confidence_by_field": {
		"processing_base_method": 0.82,
		"fermentation_type": 0.91,
		"process_additives": 0.95
	},
	"needs_review": false,
	"review_reason": null,
	"schema_version": 1
}
```

### Constraints and indexes

Start with CHECK constraints for narrow fields only if the current taxonomy is stable enough. Otherwise, enforce canonical values in TypeScript/Zod first and add DB constraints after the pilot.

Suggested first indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_coffee_catalog_processing_base_method
  ON public.coffee_catalog(processing_base_method);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_fermentation_type
  ON public.coffee_catalog(fermentation_type);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_process_additives
  ON public.coffee_catalog USING gin(process_additives);
```

## Scraper and agent-pass design

### Extraction order

Use a layered extraction system, not one giant prompt. The scraper should prefer evidence in this order:

1. **Supplier structured data:** tables, API fields, categories, key-value rows.
2. **Deterministic text extraction:** known aliases and regex patterns from product names, categories, process fields, and tags.
3. **Agent description pass:** LLM extraction from `descriptionLong`, `descriptionShort`, and `farmNotes` when structured fields are missing or ambiguous.
4. **Human review queue:** only for high-value or high-risk rows where evidence is contradictory, additive-related, or low confidence.

### Scraper type changes

Extend `ScrapedData` in `coffee-scraper` with a nested object first, then map to DB columns at insert/update time:

```ts
export interface ProcessingBreakdown {
	baseMethod: string | null;
	fermentationType: string | null;
	additives: string[] | null;
	additiveDetail: string | null;
	fermentationDurationHours: number | null;
	dryingMethod: string | null;
	notes: string | null;
	disclosureLevel: string | null;
	confidence: number | null;
	evidence: ProcessingEvidence | null;
}
```

Keep existing `processing` and `dryingMethod` fields during the migration. The new object should enrich, not replace, the existing row contract.

### Canonical schema changes

Update `scrape/schema/columnDefinitions.ts` to add processing-breakdown fields and stricter definitions:

- `processing`: legacy display label; may combine base and fermentation in supplier language
- `processingBaseMethod`: base transformation category only
- `fermentationType`: fermentation environment or technique only
- `processAdditives`: disclosed materials introduced during fermentation
- `processAdditiveDetail`: raw named additives or starter cultures
- `fermentationDurationHours`: explicit numeric duration
- `dryingMethod`: drying only, not a proxy for natural processing
- `processingDisclosureLevel`: how much the supplier disclosed
- `processingEvidence`: provenance envelope, not display copy

### Agent prompt requirements

The agent pass must be evidence-bound:

- return `unknown` or `unspecified` when the source does not say
- never infer additives from tasting notes alone
- require a short quote for any additive claim
- separate flavor descriptors from process inputs
- separate base method from fermentation environment
- preserve original supplier phrase in evidence
- assign field-level confidence
- flag contradictions, such as `Washed` plus `Natural` with no explanation

This is the key scraper-side lesson from PR #208: supplier descriptions often contain the information, but extracting it safely requires provenance. Otherwise the product will silently invent disclosure infrastructure instead of measuring it.

### Deterministic parser work

Extend `scrape/dataValidators.ts` with helpers that do not require an LLM:

- `normalizeProcessingBaseMethod(raw)`
- `normalizeFermentationType(raw)`
- `extractProcessAdditivesFromText(...text)`
- `extractFermentationDurationHours(...text)`
- `classifyProcessingDisclosure(row)`

Do not overload `normalizeProcessing()` further. It already has a compatibility job. New helpers should feed the structured breakdown.

### Source pilots

Pilot on a deliberately mixed set:

1. **Prime Green Coffee:** high processing vocabulary, structured categories, co-ferment-heavy inventory.
2. **Cafe Imports or Hacea:** richer structured metadata plus prose.
3. **One low-disclosure supplier:** proves `unknown` behavior and avoids hallucinated completeness.

Success criteria for the pilot:

- no regression in existing `processing` coverage
- every additive claim has evidence
- unknowns remain unknown rather than defaulting to none
- pilot rows expose useful filters in product/API surfaces
- audit output can report coverage by source and disclosure level

## API integration

### `/v1/catalog` response

Keep current top-level fields for compatibility. Add a nested `process` object in full responses:

```json
{
	"processing": "Anaerobic Natural",
	"drying_method": "Raised beds",
	"process": {
		"base_method": "Natural",
		"fermentation_type": "Anaerobic",
		"additives": ["hops"],
		"additive_detail": "hops",
		"fermentation_duration_hours": 72,
		"drying_method": "Raised beds",
		"disclosure_level": "high_detail",
		"confidence": 0.92,
		"evidence_available": true
	}
}
```

Do not expose full evidence quotes by default in the public API until privacy/copyright/product review. Expose `evidence_available`, `confidence`, and normalized fields first. Full evidence can remain internal or be available behind authenticated/product tiers later.

### Query parameters

Add these after schema and data-layer support:

- `processing_base_method=Natural`
- `fermentation_type=Anaerobic`
- `process_additive=hops`
- `has_additives=true|false`
- `processing_disclosure_level=high_detail`
- `processing_confidence_min=0.8`

Anonymous API should not receive all of these at once by default. Start with `processing_base_method` and maybe `fermentation_type`; keep richer filters for authenticated/API-key users if row limits and product tiering need protection.

### Docs and SDK/CLI follow-through

Update:

- `src/routes/api/docs/+page.svelte`
- `src/routes/docs/[section]/[slug]/+page.svelte` content sources, if catalog docs are backed by markdown/docs metadata
- `llms.txt` or catalog docs discovery surfaces if they list API shape
- `@purveyors/cli` catalog commands once the API fields ship

## Product surface integration

### Public catalog

First product UI should be simple:

- replace single processing text with chips:
  - base method
  - fermentation type
  - additive disclosure badge when present
  - drying method only when known
- add filters for base method and fermentation type
- keep existing `processing` filter during transition
- add a tooltip or microcopy distinction between `none disclosed` and `not disclosed`

Important: do not make the catalog look more certain than the data. Confidence and unknown states should be visible enough to discourage overclaiming.

### Analytics

Extend `/analytics` processing distribution from one donut to a breakdown:

- base method distribution
- fermentation type distribution
- additive disclosure count
- disclosure quality by supplier

This is a strong Parchment Intelligence surface because it turns metadata quality into market structure: who documents process well, who hides behind generic labels, and which processing styles are growing.

### Product narrative surfaces

Use this as a repeatable proof point:

- Catalog: better filters and buyer trust
- API: structured processing fields for agents and buyers
- Intelligence: supplier disclosure benchmarking
- Blog: PR #208 becomes an example of product research driving schema evolution

## Implementation slices

Each slice should be mergeable if the next one never ships.

### PR 1: ADR + schema proposal + generated types

Owner repo: `coffee-app`

Scope:

- create an ADR for processing transparency schema
- add migration for additive columns
- regenerate/update Supabase types
- add DB comments explaining unknown vs none
- no product UI changes

Acceptance:

- `pnpm check` passes
- migration is additive and backward compatible
- existing `/v1/catalog` tests pass unchanged

### PR 2: Catalog data-layer and API response support

Owner repo: `coffee-app`

Scope:

- extend `CatalogItem` mapping with a `process` response object
- add search filters for base method, fermentation type, additives, disclosure level, and confidence
- update `/v1/catalog` tests
- update API docs with additive fields

Acceptance:

- existing clients using `processing` do not break
- new filters are covered by route/data-layer tests
- anonymous filter contract is explicit and tested

### PR 3: Scraper schema and deterministic parser groundwork

Owner repo: `coffee-scraper`

Scope:

- add `ProcessingBreakdown` type
- add canonical field definitions and Zod validation
- add deterministic helpers for base method, fermentation type, additives, duration, and disclosure level
- keep old `processing` behavior unchanged

Acceptance:

- parser tests cover co-ferment, yeast, hops, fruit, carbonic, lactic, duration, and unknown cases
- `normalizeProcessing()` behavior is not broken

### PR 4: Evidence-bound agent extraction pass

Owner repo: `coffee-scraper`

Scope:

- add a dedicated processing-breakdown extraction prompt or structured section in the unified prompt
- require evidence spans and confidence
- add post-processing guardrails
- add fixtures for descriptions where tasting notes mention fruit but no additive is disclosed

Acceptance:

- additive claims require evidence
- `unknown` and `unspecified` are preserved
- LLM failure leaves legacy fields intact

### PR 5: Pilot sources and audit report

Owner repo: `coffee-scraper`

Scope:

- wire Prime Green Coffee first
- wire one rich structured supplier and one low-disclosure supplier
- add audit output by source: coverage, disclosure level, additive claims, low-confidence rows
- optionally export a CSV/JSON review queue

Acceptance:

- pilot scrape passes
- no existing coverage regression for `processing`
- audit proves source-level disclosure differences

### PR 6: Ingestion/backfill bridge

Owner repos: `coffee-scraper` and `coffee-app`, likely separate PRs if deployment order demands it

Scope:

- map scraper `ProcessingBreakdown` to DB columns
- backfill existing rows from existing `processing`, `drying_method`, and descriptions where available
- keep confidence lower for backfilled/inferred rows
- add rollback-safe migration/backfill notes

Acceptance:

- additive migration has no destructive writes
- backfill is idempotent
- rows without evidence remain unknown

### PR 7: Product surfaces

Owner repo: `coffee-app`

Scope:

- add catalog chips and filters
- extend analytics with base/fermentation/additive/disclosure distributions
- add copy explaining disclosure levels
- update SEO/docs copy where useful

Acceptance:

- public catalog remains fast
- mobile filters remain usable
- unknown vs none is visually distinct

### PR 8: CLI and agent-surface parity

Owner repo: `purveyors-cli`

Scope:

- expose process fields in catalog list/search JSON output
- add filter flags for new API params
- update help/examples
- ensure chat-agent consumers can request structured processing breakdowns

Acceptance:

- CLI output remains backward compatible
- JSON mode includes structured `process` data
- help text makes additive/unknown semantics clear

## Risks and mitigations

### Risk: hallucinated additives

Mitigation: require evidence quotes for additive claims, never infer additives from tasting notes, and use `unspecified` instead of `none` unless the supplier explicitly says none.

### Risk: taxonomy churn

Mitigation: start with TypeScript/Zod canonicalization and additive DB columns; delay hard DB CHECK constraints until after pilots reveal real supplier language.

### Risk: API breaking changes

Mitigation: keep `processing` and `drying_method` as-is; add nested `process` object and new filters additively.

### Risk: product overconfidence

Mitigation: expose disclosure level and confidence; make unknown states visible in UI and analytics.

### Risk: scrape cost explosion

Mitigation: run deterministic extraction first; only call the agent when descriptions contain process-like terms or structured fields are missing/ambiguous. Cache extracted breakdown by content hash so unchanged descriptions do not trigger repeat LLM calls.

### Risk: cross-repo deployment order

Mitigation: ship `coffee-app` schema/API fields before scraper writes them. Scraper can populate only after columns exist.

## Recommended next move

Start with PR 1 in `coffee-app`: ADR plus additive schema migration and generated types. That creates the contract the scraper and product surfaces can safely target.

The highest-leverage early decision is the unknown/none/inferred semantics. Get that right before writing extraction prompts. If that boundary is fuzzy, the product will look sophisticated while quietly lying about supplier disclosure.
