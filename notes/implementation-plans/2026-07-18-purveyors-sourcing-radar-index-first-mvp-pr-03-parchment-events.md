# Sourcing Radar MVP PR 3: Canonical Product Event Contract

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `parchment-api`
**PR goal:** Provide the minimal Parchment-owned event contract and append-only persistence required to measure the product without making analytics the customer workflow.

## Why this slice exists

The current platform has durable records for tracked lots, brief changes, and chat conversations, but it has no reusable product-event sink for non-durable exposures and clicks. Hiding that backend inside the coffee-app product PR would violate the accepted ownership boundary and recreate split database authority.

This slice makes telemetry a small canonical backend capability before the reference client depends on it. It is deliberately limited to fixed Radar MVP events and contains no dashboard or research workflow.

## Prerequisites

- The database migration ownership transfer is operational through its guarded canary.
- PR 2 has established the canonical PPI principal, entitlement, and owner-scoped brief contract used to authorize event ingestion.

## In scope

- `POST /v1/analytics/events`, a Parchment-owned authenticated ingestion endpoint for the closed non-durable Radar MVP event set: dashboard exposure, Radar open, result open, Ask Parchment handoff, supplier click, and optional sample/quote intent.
- Principal-derived identity, PPI entitlement enforcement, brief ownership checks, fixed event names, bounded identifiers, Radar result-token validation, schema validation, and idempotency/deduplication appropriate to retries.
- Minimal append-only persistence through the canonical Parchment migration ledger for events that are not already represented by durable product records.
- Use existing tracked-lot, brief, and chat records directly for watchlist, refinement, and conversation analytics rather than emitting duplicate product events for those actions.
- Data minimization: no brief criteria, source payloads, chat text, free text, credentials, or customer-supplied metadata.
- For dashboard exposure, Radar open, and result open events, preserve only bounded canonical response metadata: `evidenceStatus` (`fresh|stale|unavailable`), `publicationId` when present, `resultCount`, and `knownLotAgeCount`. These are response facts, not customer-supplied properties.
- OpenAPI and SDK support for the fixed event contract.
- Retention, indexing, observability, and focused authorization/privacy tests sufficient for the limited launch.

## Out of scope

- Coffee-app routes, components, dashboard UX, or browser database writes.
- A general-purpose analytics platform, arbitrary event names, arbitrary properties, session replay, third-party trackers, funnels, dashboards, or experimentation infrastructure.
- Stored Radar result snapshots, recommendation history, notifications, RFQs, supplier messaging, or purchases.
- Replacing existing API usage accounting or durable product records.

## Canonical contract

- Accept only a versioned closed union of Radar MVP event names and their minimal identifiers through `POST /v1/analytics/events`.
- Resolve the principal and entitlement server-side. The caller cannot choose a user or organization identity.
- Verify that any `briefId` belongs to the authenticated principal without revealing cross-owner existence.
- Result-level events (`result_open`, `supplier_click`, and optional sample/quote intent) require the short-lived `radarEventToken` returned on the canonical Radar row. Parchment validates its owner, brief, canonical result, publication, signature, and expiry before persistence; arbitrary catalog/result IDs or a token from another result cannot satisfy the binding. Persist the derived identifiers and outcome metadata, not the raw token.
- Treat repeated delivery of the same client event identifier idempotently within a bounded retry window.
- For dashboard exposure, Radar open, and result open, accept only the allowlisted response metadata fields and bounded values above so later brief refinements or publication changes do not erase what the customer saw.
- Return a small canonical acknowledgement. Do not return analytics rows or create an end-user reporting API in this slice.
- Expose the same typed event union through OpenAPI and `@purveyors/sdk` as `recordProductEvent`.

## Likely files

- Parchment event route/resource and authorization modules
- `supabase/migrations/<timestamp>_radar_product_events.sql` in the Parchment-owned ledger
- focused event contract, authorization, idempotency, privacy, and migration tests
- OpenAPI generation sources and snapshots
- `packages/sdk` client/types/tests
- internal retention and operational documentation

## Acceptance criteria

- An authenticated PPI owner can submit only the fixed Radar events for their own brief.
- Anonymous, insufficiently entitled, malformed, arbitrary-name, cross-owner, oversized, and replay-abuse attempts fail with canonical behavior.
- The server derives identity and rejects customer text or unapproved properties.
- Exposure and open events retain the canonical evidence status, publication identity when present, result count, and known-lot-age count without storing criteria, source payloads, or result rows.
- Result-level analytics cannot be cross-wired: missing, expired, malformed, cross-owner, cross-brief, cross-publication, and cross-result tokens are rejected before the event is stored.
- Non-durable events persist append-only through the Parchment-owned migration path; no coffee-app migration or direct browser write is required.
- Durable product actions are referenced rather than copied with sensitive payloads.
- OpenAPI and SDK expose the exact closed event union consumed by PR 5.
- Retention and operational inspection are documented before limited-launch data is collected.

## Test plan

- Route/resource tests for every allowed event and each denied principal/ownership/result-binding case.
- Schema tests proving arbitrary names, extra properties, text, criteria, source payloads, and unbounded response metadata are rejected while the allowlisted bounded response metadata is preserved.
- Result-token tests cover valid result-open/supplier-click/sample-intent events and missing, expired, malformed, cross-owner, cross-brief, cross-publication, and cross-result tokens.
- Idempotency and bounded retry tests.
- Migration, grant, append-only, retention, and index checks through the canonical database workflow.
- OpenAPI generation and SDK client/type tests.
- Repository typecheck, test, lint, and build.

## Risks and rollback

- **Risk:** telemetry grows into an analytics platform. Keep the event union closed and product-specific; require a new plan for generalized analytics.
- **Risk:** sensitive sourcing intent leaks into events. Reject arbitrary properties and persist identifiers only.
- **Risk:** a client fabricates a supplier/result event for a coffee it never saw. Require the Parchment-minted Radar result token and validate its binding before persistence; do not accept a bare catalog ID as proof.
- **Risk:** retries inflate activity. Require idempotency keys and test duplicate delivery.
- **Rollback:** disable event ingestion and stop the coffee-app calls. Radar remains useful; durable tracked-lot, brief, and chat actions still provide partial behavioral evidence.

## Exact follow-on dependency

PR 5 may wire passive exposure/click analytics only after this contract and SDK are deployed and a PPI-only test principal can submit an owned fixed event without direct database access.
