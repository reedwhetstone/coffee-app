# PR 04: Coffee-app inventory and tasting SDK cutover

## PR goal

Replace direct inventory and tasting reads/writes with existing Parchment SDK
contracts.

## Why this slice comes now

Parchment already ships owner-scoped inventory and tasting operations. The debt
is primarily consumer lag, so no new architecture should be invented.

## In scope

- Beans inventory CRUD and inventory lookup/list
- Inventory tool routes and chat tool adapters not already on the SDK
- Tasting reads and owner rating writes
- Catalog enrichment through Parchment catalog resources
- Response adapters preserving existing Svelte component shapes
- Delete replaced `green_coffee_inv`, `coffee_catalog`, and tasting helper access

## Out of scope

- Roast-derived summary gaps handled by PRs 05-06
- Profit, batch roast operations, chat confirmed-action transaction

## Files to change

- `src/lib/data/inventory.ts` and `src/lib/data/tasting.ts`
- beans, inventory-tool, tasting, share/update-stocked callers as applicable
- route/component tests and boundary manifest

## Acceptance criteria

- Inventory and tasting web flows use `createParchmentServerClient(..., {
mode: 'session' })`.
- Writes preserve ownership, idempotency/conflict behavior, and current UX.
- No direct inventory/tasting/catalog join remains in this capability group.

## Test plan

- CRUD, owner isolation, validation, 404/409, and tasting replacement cases
- Existing beans and chat-tool compatibility fixtures
- coffee-app check, focused tests, lint/format, and build

## Risks

- Legacy inventory deletion cascades more aggressively than Parchment's safe 409
  contract. Preserve the safer API behavior and update the UI to explain
  dependent records rather than recreating force-cascade behavior.

## Follow-on dependency

PR 06 removes roast/sales dependencies that can still block inventory deletion.
