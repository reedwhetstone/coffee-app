# PR A Execution Plan: Principal Foundation and `/v1` Scaffolding

**Goal:** Introduce the shared auth normalization layer and canonical API scaffolding without yet rewriting the whole product.

## Scope
- Add `resolvePrincipal()` / normalized principal helpers
- Support session auth + API key auth in one shared resolver
- Define canonical principal shape
- Create `/v1` route structure scaffolding
- Add shared authorization helpers based on explicit roles/scopes/plans
- Add CSRF/origin policy for cookie-authenticated mutation routes if needed in shared helpers

## Candidate files
- `src/lib/server/auth.ts`
- `src/lib/server/apiAuth.ts`
- new shared principal module, likely `src/lib/server/principal.ts`
- `src/hooks.server.ts`
- new `/v1/*` route scaffolding files
- tests around auth helpers if practical

## Out of scope
- Catalog contract cutover
- Role table/schema migration
- Docs consolidation
- Dashboard rename

## Acceptance criteria
- One normalized principal model exists in code
- Session and API-key auth can both be resolved through the shared path
- Handlers can consume principal helpers without duplicating auth branching
- `pnpm check` passes
- `verify-pr` runs before merge recommendation

## Notes
- Prefer additive introduction over half-migrated handler chaos
- Keep the PR narrow enough that the review is about auth foundation, not product surfaces
