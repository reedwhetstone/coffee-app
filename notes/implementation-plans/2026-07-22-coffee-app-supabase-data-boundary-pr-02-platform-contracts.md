# PR 02: Parchment market, portfolio, procurement, and usage contracts

## PR goal

Fill verified Parchment/SDK contract gaps required to remove coffee-app's direct
market, watchlist, sourcing-brief, API-usage, and product-authorization reads.

## Why this slice comes now

These web callers currently join shared tables and encode reusable product
behavior. Parchment already has catalog, Market Index, procurement, and API-key
foundations, so additive capability-shaped contracts are the smallest safe move.

## In scope

- Parity matrix against the coffee-app analytics/dashboard/beans/API-dashboard
  callers
- A reusable market overview/changes contract only for data not covered by
  existing catalog and Market Index endpoints
- Owner-scoped portfolio/watchlist list/toggle operations with catalog summaries
- Missing sourcing-brief lifecycle operations proven necessary by callers
- Owner API usage and per-key summary/time-series reads
- An authenticated self/principal resource that returns the canonical subject,
  roles, plan, scopes, and product entitlements needed for coffee-app route UX
- A reviewed billing-to-entitlement mutation or reconciliation contract if the
  current Stripe flow must change product access
- OpenAPI, generated SDK helpers, authorization, limits, and tests

## Out of scope

- Coffee-app changes
- Raw table-shaped endpoints
- Notifications, Radar recurrence, exports, or billing

## Files to change

- `packages/api/src/routes/` and capability services
- OpenAPI schemas
- `packages/sdk/src/client.ts` and generated types
- API/SDK tests and governing PADR if a new resource boundary is introduced

## Acceptance criteria

- One API call or bounded parallel set can reproduce each current web view
  without direct database access or N+1 HTTP requests.
- Owner isolation and entitlement behavior match current production.
- Forwarded Supabase user JWTs and Parchment API keys resolve through the same
  canonical principal model; coffee-app needs no direct role lookup.
- SDK release contains typed helpers and no breaking contract changes.

## Test plan

- Session/API-key auth matrix, owner isolation, pagination, filters, and invalid
  input tests
- Golden parity fixtures from current coffee-app outputs
- OpenAPI/SDK generation checks, lint, typecheck, tests, and build

## Risks

- Mirroring UI payloads would make Parchment presentation-specific. Expose
  reusable market/portfolio/usage resources and keep web-only formatting local.

## Follow-on dependency

Deploy Parchment and publish the SDK before PR 03.
