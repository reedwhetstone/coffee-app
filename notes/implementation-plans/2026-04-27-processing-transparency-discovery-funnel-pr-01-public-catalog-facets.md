# PR 01: Public Catalog Process-Transparency Facets

**Date:** 2026-04-27
**Repo:** `coffee-app`
**Program:** Processing Transparency Discovery Funnel
**Slice status:** Independently mergeable

## PR goal

Expose the already-shipped `/v1/catalog` processing transparency contract in the public catalog UI through shareable filters and a natural-language CoffeeCard processing analysis subcomponent.

## Why this slice comes now

- PR #289 added structured process fields and filters to the canonical catalog contract.
- The public catalog still mostly shows the old `processing` label, so the product value is invisible to buyers.
- This is the smallest user-facing slice that turns ADR-004 into public product value without new schema work.

## In scope

- Add catalog URL-state support for:
  - `processing_base_method`
  - `fermentation_type`
  - `process_additive`
  - `processing_disclosure_level`
  - `processing_confidence_min`
- Add compact advanced process filters to `/catalog`.
- Ensure shareable URLs preserve those filters.
- Render structured process metadata on CoffeeCard when `coffee.process` fields are present, anchored under the standard processing detail as buyer-readable analysis.
- Preserve legacy `processing` display and filter behavior.
- Add focused tests for URL-state, catalog route behavior, and store/filter handling.

## Out of scope

- Scraper extraction changes.
- Database migrations.
- Raw processing evidence exposure.
- CLI option support.
- AI ranking or semantic search changes.
- Data transparency ranking or score columns.
- Paid entitlement changes.

## Files to change

Likely files:

- `src/lib/catalog/urlState.ts`
- `src/lib/stores/filterStore.ts`
- `src/routes/catalog/+page.svelte`
- `src/lib/components/CoffeeCard.svelte`
- `src/routes/catalog/page.server.test.ts`
- `src/lib/stores/filterStore.test.ts`
- URL-state tests if already present, or a focused new test file near `src/lib/catalog/urlState.ts`

## Acceptance criteria

- New process filters parse from the URL on initial page load.
- New process filters serialize back to shareable URLs.
- Catalog requests use canonical `/v1/catalog` query param names.
- Filter controls can be set, cleared, and combined with existing country/source/process filters.
- CoffeeCard shows process transparency analysis only when present, using plain language for disclosure quality and confidence rather than prominent numeric confidence.
- Missing structured metadata does not render misleading `none`, `unknown`, or fake zero-confidence claims.
- API/CLI surfaces remain clean raw data surfaces; web analysis copy does not imply API opinionation.
- Anonymous preview limit and signup CTA still work.
- Existing catalog tests continue to pass.

## Test plan

- `pnpm check --fail-on-warnings`
- Focused URL-state parse/serialize tests for all new params.
- Existing catalog server/page tests plus at least one query-param preservation case.
- Store/filter tests proving `processing_confidence_min` and string process filters are sent correctly.
- Manual smoke if browser validation is available:
  - `/catalog?fermentation_type=Anaerobic&processing_disclosure_level=high_detail`
  - confirm controls hydrate, cards render cleanly, and clearing filters updates URL.

## Risks

- The catalog filter row could become cramped. Prefer an advanced/collapsible process section.
- Confidence display can imply false precision. Use natural-language analysis and avoid prominent decimal scores.
- Sparse structured data could make badges rare. Render opportunistically and avoid placeholders.

## Exact follow-on dependency

No follow-on dependency is required for this PR to be mergeable. If it lands cleanly, PR 02 should add CLI parity for the same process filters and output fields.
