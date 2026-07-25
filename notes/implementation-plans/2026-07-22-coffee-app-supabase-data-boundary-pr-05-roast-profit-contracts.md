# PR 05: Parchment roast and profit parity contracts

## PR goal

Add the reusable Parchment behavior still missing for coffee-app roast, chart,
milestone, stocked-state, and profit parity.

## Why this slice comes now

Core CRUD and Artisan contracts already exist. The remaining web code should not
be copied into SDK adapters or decomposed into many chatty HTTP calls.

## In scope

- Verify whether existing roast detail with temps/events replaces chart RPCs
- Canonical chart/milestone projection only if the raw detail contract is
  insufficient across clients
- Batch-safe roast operation only if the product still exposes batch deletion
- Transactional derived stocked-state updates behind inventory/roast/sales
  mutations
- Canonical profit summary over owner inventory and sales
- OpenAPI, SDK helpers, authorization, idempotency/conflict tests

## Out of scope

- Web UI changes
- Generic BI endpoints
- New roasting features

## Files to change

- Parchment roast, inventory, sales, and analytics services/routes
- database functions/migrations only through parchment-api if required
- OpenAPI, SDK client/types, tests, and PADR updates

## Acceptance criteria

- Every live coffee-app roast/profit operation has one canonical Parchment path.
- Multi-row writes/deletes are atomic and owner-scoped.
- Profit semantics have one tested definition.
- SDK release is additive and production-deployed.

## Test plan

- Owner isolation, batch atomicity, chart/milestone parity, derived stock state,
  profit fixtures, idempotency, and conflict tests
- OpenAPI/SDK diff, lint, typecheck, tests, and build

## Risks

- Porting stale helpers would canonize accidental behavior. First verify live UI
  use and expected semantics; delete unused operations instead of exposing them.

## Follow-on dependency

Deploy Parchment and publish the SDK before PR 06.
