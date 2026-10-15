# Catalog region filter parity

## Outcome

Region uses the same searchable, scrollable multi-select component as Country. Each selected region has its own removable chip; clearing the list leaves other filters intact. Shared URLs and initial server rendering preserve every selection. Old single-region URLs continue to work.

The option response includes every upstream region rather than the former top-150 suggestions. Region counts exclude the current region selection while retaining other filters, so users can add another region without losing the alternatives.

## Delivery dependency

Parchment previously accepted only one region. The companion API change must deploy before this UI: repeated `region` parameters match any selected region, with existing substring matching preserved. No release flag or manual activation is introduced.

## Validation

- `VALIDATION_PASS`: `pnpm lint`.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings`, with placeholder environment values for static checks only.
- `VALIDATION_PASS`: `pnpm test src/lib/components/catalog/filters/CatalogFilterPanel.svelte.test.ts src/lib/server/catalogFilterOptions.test.ts src/lib/catalog/filterOptionsView.test.ts src/lib/catalog/urlState.test.ts src/lib/catalog/filterModel.test.ts src/routes/catalog/page.server.test.ts src/lib/stores/filterStore.test.ts src/lib/catalog/parchmentQuery.test.ts`, 182 tests across 8 files. The 51 server-rendering tests were rerun after adding a TypeScript narrowing guard to the new test.
- `VALIDATION_PASS`: `pnpm verify:catalog-http-contract https://api.purveyors.io`, baseline live authentication and catalog response contract. This is not proof of the undeployed multi-region API change.
- `VALIDATION_PASS`: isolated Chromium rendering of the real filter panel with fixture counts at desktop 1200×1000 and mobile 390×844. Country and Region each have a 206px inner scroll area. Verified list scrolling, searching, simultaneous Huila/Cauca selection, clear-all-selected, and no horizontal overflow. Screenshots were visually inspected.

## Screenshots

These show fixture data, not a production deployment.

[Desktop](assets/catalog-region-filter/catalog-region-desktop.png) · [Mobile](assets/catalog-region-filter/catalog-region-mobile.png)
