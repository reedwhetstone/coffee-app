# Sourcing Radar MVP PR 2: Canonical PPI Intent Contract

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `parchment-api`
**PR goal:** Make owner-scoped PPI sourcing intent a canonical, API-enforced contract with SDK parity.

## Why this slice comes now

Radar cannot be a real product if a paying customer needs an operator to seed its core input. The existing Parchment procurement resource already supports list, create, get, and matches for its current principal classes, but it does not expose the complete PPI-session lifecycle the product needs and must not delegate authorization to coffee-app.

This PR makes sourcing intent a canonical Parchment capability. Parchment owns identity, entitlement, validation, ownership, mutation behavior, and the published SDK contract. Coffee-app remains a thin BFF/reference client and adds the customer setup experience only after this server contract ships.

## Prerequisite

Accept and operationalize the separate database migration ownership transfer plan in `parchment-api/docs/plans/2026-07-18-database-migration-ownership-transfer.md` through its guarded canary. All new sourcing-brief RLS, grant, role-hardening, and function changes then land in the Parchment-owned migration ledger. Do not add another coffee-app migration merely to keep this product sequence moving.

The contract and tests may be developed before the transfer finishes, but the PR must not merge until its migration path has one canonical owner and a verified production apply workflow.

## In scope

- Extend the canonical procurement brief resource so an authenticated `ppiAccess` session owner can create, list, get, update, activate, and deactivate their own constrained sourcing briefs, and read the existing matches subresource for an owned brief.
- Preserve current member/admin session and supported owner-bound API-key behavior deliberately. Do not widen API-key writes implicitly or let wildcard scopes gain new mutation authority.
- Reuse the existing versioned, closed-set criteria schema and validation. Do not add new criteria merely to make setup feel richer.
- Derive `user_id` from the authenticated principal. Callers cannot submit or override ownership.
- Enforce ownership, PPI entitlement, validation, and mutation semantics in Parchment before any write reaches Supabase.
- Add the required Parchment-owned migration changes so direct Supabase REST cannot bypass the reviewed contract: harden `sourcing_briefs` writes, revoke client mutation of the authoritative role/entitlement source, and retain RLS as defense-in-depth for the session lane.
- Add two-step negative coverage proving a PPI-only session cannot promote itself and then bypass brief authorization.
- Regenerate OpenAPI and `@purveyors/sdk` methods/types for the complete lifecycle.
- Focused route, resource, authorization, migration-contract, OpenAPI, and SDK tests.

## Out of scope

- Coffee-app routes, components, forms, dashboard cards, or presentation.
- Radar evidence, ranking, or result presentation.
- Concierge participant seeding as the normal workflow.
- Natural-language criteria invention by an LLM.
- New sourcing criteria, cadence, notifications, recommendation runs, team ownership, RFQs, purchasing, or supplier messaging.
- Pricing, checkout, public access, CLI convenience commands, or a general write-scope redesign.
- The migration ownership transfer itself; that remains a separate prerequisite program.

## Canonical contract

The existing resource becomes the single lifecycle contract:

- `GET /v1/procurement/briefs?status=active|inactive|all` lists the principal's briefs under the resolved entitlement. Preserve the current active-only default for backward compatibility; self-service clients use an explicit status when managing lifecycle state.
- `POST /v1/procurement/briefs` creates a validated brief for the principal-derived owner.
- `GET /v1/procurement/briefs/{id}` returns an owned brief without revealing cross-owner existence.
- `GET /v1/procurement/briefs/{id}/matches` is readable by an authenticated `ppiAccess` session owner for that owner's brief, while preserving the existing member/admin session and supported owner-bound API-key behavior for other callers.
- `PATCH /v1/procurement/briefs/{id}` updates supported name, criteria, and active-state fields with optimistic conflict behavior where required by the existing resource model.
- `DELETE /v1/procurement/briefs/{id}` is not introduced for the MVP. Deactivation preserves history and remains the customer-facing removal path.

The generated SDK exposes equivalent list, create, get, matches, update, activate, and deactivate methods. Coffee-app and future machine consumers use those methods instead of writing `sourcing_briefs` directly.

## Authorization and database invariants

- The API is the primary authorization authority for every consumer.
- Session identity and entitlement come from the canonical Parchment principal model.
- A client cannot choose `user_id`, promote its own role, mutate another user's brief, or bypass criteria validation through Supabase REST.
- The authoritative capability source is not client-writable.
- RLS remains defense-in-depth on the caller-JWT session lane; service-role use, if any, remains confined to reviewed Parchment write modules.
- Non-owned and missing IDs have the same non-enumerable response behavior.
- No service-role credential reaches the browser, coffee-app runtime, SDK caller, or response payload.
- Every accepted mutation has an auditable principal, owner, route, and entity identity under the canonical Parchment write model.

## Likely files

- `packages/api/src/procurement/briefs.ts`
- `packages/api/src/routes/procurement.ts`
- `packages/api/src/auth/authorize.ts` and the canonical entitlement resolver where required
- focused procurement and authorization tests under `packages/api/test/`
- `supabase/migrations/<timestamp>_secure_ppi_sourcing_brief_intent.sql`
- OpenAPI/schema generation sources
- `packages/sdk/src/client.ts`, generated schema/types, and SDK tests
- API and SDK documentation generated from the canonical contract

## Acceptance criteria

- A PPI-only authenticated session can create, list, get, update, activate, and deactivate its own valid sourcing brief without Mallard membership or operator intervention.
- A PPI-only authenticated session can read the canonical matches for its own brief through `GET /v1/procurement/briefs/{id}/matches` and the generated SDK; cross-owner and insufficient-entitlement reads remain denied without enumeration.
- Deactivated briefs remain discoverable after reload through the explicit inactive/all list filter and can be reactivated without a remembered object ID.
- Identity is principal-derived and cross-owner access is denied without resource enumeration.
- Unsupported criteria and unsupported mutation fields fail closed and never silently no-op.
- A PPI-only session cannot promote itself through `user_roles` or bypass the reviewed brief mutation contract through direct Supabase REST.
- Existing intended member/admin and API-key behavior remains supported and tested; no existing key gains new write authority implicitly.
- Anonymous, public-demo, and insufficiently entitled principals receive the canonical structured denial behavior.
- OpenAPI and SDK expose the complete lifecycle with no coffee-app-only method or response shape.
- No presentation, Radar result, notification, recommendation history, or external side effect is added.

## Test plan

- Resource and route tests for active-default, inactive, and all-status listing; create, get, matches, update, activate, deactivate; reload/reactivation; invalid criteria, invalid fields, ownership, entitlement, and non-enumeration.
- Two-step negative test: attempted role promotion is denied, then direct brief mutation remains denied.
- Direct Supabase REST/RLS negative coverage for PPI-only, anonymous, cross-owner, and insufficiently entitled sessions.
- Regression coverage for intended member/admin and existing API-key behavior.
- OpenAPI snapshot/generation and SDK client tests for every method and response, including the PPI-readable matches method.
- Migration history, disposable-schema, and grant/policy checks from the accepted database migration release path.
- Repository typecheck, test, lint, and build.

## Risks and rollback

- **Risk:** the endpoint grows into a procurement requirements builder. Keep only the existing supported criteria.
- **Risk:** entitlement changes grant broader procurement access than Radar requires. Add a specific resolved capability or route-level PPI grant through the canonical entitlement model; do not infer access from UI state.
- **Risk:** security hardening breaks legitimate member/API behavior. Cover every intended principal class before migration rollout.
- **Risk:** a direct database path survives beside the API. Deny raw client writes and add structural tests that keep future consumers on the SDK contract.
- **Rollback:** disable PPI intent mutations at the API and remove the coffee-app entry point before shipping a forward corrective migration. Do not restore client-writable role escalation or broad direct brief writes.

## Exact follow-on dependency

PR 3 begins after the canonical contract and SDK are published, the migration is applied through the Parchment-owned workflow, and a PPI-only test session can create an owned active brief and retrieve it without direct database access.
