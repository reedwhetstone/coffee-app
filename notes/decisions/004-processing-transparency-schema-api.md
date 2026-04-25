# ADR-004: Processing transparency schema and API contract

**Status:** Accepted

**Date:** 2026-04-24

## Context

The legacy `processing` field is a useful display and compatibility label, but it collapses base method, fermentation environment, additives, duration, drying, supplier disclosure quality, and provenance into one string. That is not enough for the co-fermentation and transparency use case. A coffee described as anaerobic natural, a hop co-ferment, and a yeast-inoculated experimental lot can all look similar in the old field while carrying different buyer expectations and disclosure risk.

The product also must not overstate metadata. Missing process detail is not the same as explicit none. Product and API surfaces should preserve nulls where data is absent and use provenance fields to show whether a supplier disclosed, implied, or failed to disclose a claim.

## Decision

Keep `coffee_catalog.processing` as the backward-compatible display/search field. Add additive structured columns on `public.coffee_catalog` for queryable process transparency:

- `processing_base_method`
- `fermentation_type`
- `process_additives`
- `process_additive_detail`
- `fermentation_duration_hours`
- `processing_notes`
- `processing_disclosure_level`
- `processing_confidence`
- `processing_evidence`

Expose the structured fields additively in catalog data-layer filters and the canonical `/v1/catalog` response. Full catalog responses keep legacy top-level fields and add a nested `process` summary with normalized process fields, confidence, disclosure level, and `evidence_available`. Dropdown responses keep their reduced projection and do not include the nested process object.

The public API does not expose raw `processing_evidence` quotes by default. Evidence remains a provenance envelope in the database so future authenticated or review surfaces can inspect it safely.

## Consequences

- Existing consumers can continue using `processing` unchanged.
- New filters can target base method, fermentation type, additives, disclosure level, and confidence without a fully normalized taxonomy table.
- Product surfaces can distinguish `null` or not disclosed metadata from explicit `none`, avoiding fake placeholder values.
- The database remains additive and backward-compatible for scraper and UI follow-up PRs.
- Taxonomy values remain mostly application-governed during the pilot; DB constraints are limited to safe numeric bounds and disclosure-level labels.
- Raw evidence needs separate review before public exposure because supplier quotes can carry copyright, privacy, and product-risk concerns.
