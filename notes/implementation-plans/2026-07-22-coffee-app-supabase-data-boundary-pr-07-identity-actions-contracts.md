# PR 07: Parchment bean-identity and confirmed-action contracts

## PR goal

Move canonical bean-identity behavior and confirmed multi-step chat writes behind
reviewed Parchment service contracts.

## Why this slice comes now

These are shared proprietary mutation rules. They should not remain as direct
RPC orchestration in the public web repository after the core owner mutations
are canonical.

## In scope

- Service/admin identity candidate, state, event, accept/reject/supersede
  operations with actor and audit semantics
- A typed, idempotent confirmed-action endpoint or small action family that
  delegates to canonical owner inventory/roast/sales/tasting services
- Entitlement and ownership rechecks inside Parchment
- OpenAPI/SDK types for first-party use and exhaustive mutation tests

## Out of scope

- LLM tool selection or action-card UI
- Autonomous writes without confirmation
- Public bean-identity administration

## Files to change

- Parchment identity/action services and routes
- database migrations/functions only if the existing RPC contract cannot be
  safely wrapped
- OpenAPI, SDK types/helpers, tests, and PADR

## Acceptance criteria

- Identity and confirmed-action writes are atomic, idempotent, authorized, and
  audited.
- No client can bypass owner/entitlement checks by crafting an action payload.
- Contracts expose business actions, not raw table mutation.

## Test plan

- Actor/admin authorization, state transitions, replay, concurrency, owner
  isolation, invalid action, and partial-failure rollback tests
- OpenAPI/SDK generation, lint, typecheck, tests, and build

## Risks

- A generic action executor can become an unsafe RPC tunnel. Use a closed
  discriminated action union and per-action validation/authorization.

## Follow-on dependency

Deploy Parchment and publish the SDK before PR 08.
