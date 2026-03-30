# PR B Execution Plan: Catalog Hard Cutover to `/v1/catalog`

**Goal:** Make catalog the first canonical API resource used by both the app and external callers.

## Scope
- Introduce `/v1/catalog`
- Define stable response contract for canonical catalog access
- Cut existing internal/external catalog flows over to shared contract/service
- Remove semantic divergence between `/api/catalog` and `/api/catalog-api`
- Decide whether first-party app calls `/v1/catalog` directly or through a same-origin thin adapter that shares the same handler/service logic

## Candidate files
- `src/routes/api/catalog/+server.ts`
- `src/routes/api/catalog-api/+server.ts`
- new `/v1/catalog/+server.ts`
- catalog service/data modules under `src/lib/data` or `src/lib/server`
- any app loaders/components consuming catalog APIs

## Out of scope
- Analytics API unification
- Role simplification
- Docs rewrite

## Acceptance criteria
- Canonical `/v1/catalog` exists
- Internal and external catalog flows use the same shared logic/contract
- Auth mode affects authorization/limits, not contract semantics
- Legacy routes are either removed or rewritten in line with the hard-cutover decision
- `pnpm check` passes
- targeted validation passes
- `verify-pr` runs before merge recommendation
