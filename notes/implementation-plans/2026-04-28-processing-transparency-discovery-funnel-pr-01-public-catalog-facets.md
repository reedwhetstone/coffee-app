# PR 01: Public Catalog Process-Transparency Facets

**Date:** 2026-04-28
**Repo:** `coffee-app`
**Program:** Processing Transparency Discovery Funnel
**Slice status:** Independently mergeable

## PR goal

Expose the already-shipped `/v1/catalog` processing transparency contract in the public catalog UI through shareable filters and CoffeeCard process analysis.

## Why this slice comes now

The backend/API contract exists, but the public catalog still exposes only legacy process filtering and card display. This is the smallest buyer-visible slice that turns ADR-004 into product value without new schema work.

## In-scope

- URL-state support for `processing_base_method`, `fermentation_type`, `process_additive`, `processing_disclosure_level`, and `processing_confidence_min`.
- Compact advanced process filters on `/catalog`.
- Canonical `/v1/catalog` query param usage.
- CoffeeCard process analysis when nested `coffee.process` data exists.
- Legacy processing display and filter compatibility.
- Focused tests for URL-state, filter plumbing, and structured metadata rendering.

## Out-of-scope

- Database migrations.
- Scraper extraction changes.
- Raw evidence exposure.
- CLI option support.
- AI ranking or semantic search changes.
- Transparency scoring.
- Paid entitlement changes.

## Files to change

- `src/lib/catalog/urlState.ts`
- `src/lib/stores/filterStore.ts`
- `src/routes/catalog/+page.svelte`
- `src/lib/components/CoffeeCard.svelte`
- `src/routes/catalog/page.server.test.ts`
- Existing URL-state and filter-store test files, or focused new tests near those modules

## Acceptance criteria

- New process filters hydrate from URL params.
- New process filters serialize into shareable URLs.
- Catalog requests use canonical `/v1/catalog` query names.
- Controls set, combine, and clear cleanly with existing filters.
- CoffeeCard renders process analysis only when structured fields are present.
- Missing structured fields do not render fake `none`, `unknown`, or low-confidence claims.
- Anonymous preview and signup CTA continue to work.
- Existing catalog behavior and tests remain green.

## Test plan

- `pnpm check --fail-on-warnings`
- URL-state parse/serialize tests for new params.
- Catalog route or server tests for canonical process query params.
- Filter-store tests for set/clear/share-link behavior.
- Manual browser smoke for `/catalog?fermentation_type=Anaerobic&processing_disclosure_level=high_detail` if browser validation is available.

## Risks

- Filter density could hurt the public catalog first impression. Use compact advanced controls.
- Confidence can imply false precision. Prefer labels and explanatory copy over prominent decimals.
- Sparse metadata could make the feature feel inconsistent. Render opportunistically and keep the legacy fallback clean.

## Exact follow-on dependency

None. PR 01 is mergeable even if CLI parity never ships. Recommended follow-on is PR 02, CLI structured process filters.
