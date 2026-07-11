# PR 02: Member Similar Coffee API

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Expose canonical bean matching through a member/API-gated route instead of direct client or CLI RPC calls.

## Why this slice comes now

ADR-005 says matching and comparison are leverage, not anonymous proof. A route-level contract lets web, CLI, API users, and agents share access checks, defaults, limits, logging, and response shape.

## In-scope

- Add `canUseBeanMatching` or equivalent capability to `resolveCatalogAccessCapabilities`.
- Add `GET /v1/catalog/[id]/similar`.
- Enforce member session or paid API tier.
- Validate `threshold`, `limit`, `stocked_only`, and optional `mode`.
- Cap limit and threshold defaults by capability.
- Return canonical envelope with target coffee summary, matches, scoring, price fields, 1 lb baseline price deltas, proof-safe explanation, beta/confidence copy, and access metadata.
- Optionally return a safe locked-state teaser count for non-members without exposing supplier, price, or match details.
- Add API usage logging for API-key callers.
- Add route tests for auth, entitlement, validation, and success.

## Out-of-scope

- CLI migration to the endpoint.
- Web UI.
- Identity schema.
- Threshold calibration harness.
- Raw evidence quotes.

## Files to change

- `src/lib/server/catalogAccess.ts`
- `src/lib/server/catalogSimilarity.ts`
- `src/routes/v1/catalog/[id]/similar/+server.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts` or equivalent
- `src/lib/types/api.types.ts` if the response is part of shared API typing
- API docs only if a docs surface exists for `/v1/*` route inventory

## Acceptance criteria

- Anonymous callers receive `401`.
- Authenticated non-member viewers receive `403`.
- Member session callers receive matches.
- Paid API callers receive matches with rate headers and usage logging.
- Response includes `price_per_lb`, `price_tiers`, 1 lb price delta, dimension scores, beta confidence, and match category.
- Non-member teaser responses, if included, expose only count/locked state.
- Invalid params fail closed with clear `400` errors.

## Test plan

- Route tests for `401`, `403`, `400`, and `200` states.
- Unit tests for capability resolution.
- Unit tests for query param normalization and limit caps.
- `pnpm check` and targeted vitest.

## Risks

- Route naming could collide with future REST conventions. Keep it under `/v1/catalog/:id/similar` because the user starts from a catalog row.
- API plan mapping may need product decision. Default to member-equivalent paid API tiers, not viewer.

## Exact follow-on dependency

PR 03 updates CLI and agent tools to consume this canonical route or shared service semantics.
