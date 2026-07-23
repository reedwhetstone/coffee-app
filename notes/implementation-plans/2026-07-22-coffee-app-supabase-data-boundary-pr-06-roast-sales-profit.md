# PR 06: Coffee-app roast, sales, and profit SDK cutover

## PR goal

Move all active roast, chart, milestone, sales, and profit behavior to the
released Parchment contracts.

## Why this slice comes now

PR 05 closes the verified parity gaps. This is the final Mallard shared-data
consumer cutover.

## In scope

- Roast list/detail/create/update/delete/import/clear and required batch behavior
- Roast chart and milestone data
- Sales list/create/update/delete
- Profit summaries
- Derived stocked-state behavior supplied by Parchment
- Delete local CRUD, cascade, chart RPC, milestone persistence, and profit logic

## Out of scope

- Visual redesign
- New roast analytics
- Billing or workspace persistence

## Files to change

- `src/lib/data/roast.ts`, `src/lib/data/sales.ts`
- `src/lib/services/milestoneCalculationService.ts`
- roast/profit/chart/update-stocked routes and page loaders
- adapters, tests, and boundary manifest

## Acceptance criteria

- No direct roast, event, temperature, Artisan log, sales, or derived-stock
  access remains.
- Existing roast, Artisan, sales, and profit workflows pass against SDK mocks and
  production canaries.
- Legacy local transaction/cascade logic is deleted.

## Test plan

- CRUD/import/clear/chart/batch/profit parity fixtures
- 401/403/404/409 and retry behavior
- page/component tests, coffee-app check, lint/format, and build

## Risks

- Large route-shape coupling. Keep one explicit adapter layer and golden fixtures;
  do not retain duplicate persistence helpers as fallback.

## Follow-on dependency

PR 08 can reuse canonical owner mutations for confirmed chat actions.
