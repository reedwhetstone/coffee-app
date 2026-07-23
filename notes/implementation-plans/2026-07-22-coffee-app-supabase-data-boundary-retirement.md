# Coffee-app shared-data Supabase boundary retirement

**Status:** Proposed implementation program
**Date:** 2026-07-22
**Owners:** coffee-app consumer surface; Parchment API contract and shared behavior
**Governing direction:** `notes/PRODUCT_VISION.md`, ADR-007, and `notes/ARCHITECTURE.md`

## Program

Retire every direct coffee-app Supabase read, write, and RPC that implements
shared Purveyors product behavior. Replace those paths with Parchment HTTP
contracts consumed through `@purveyors/sdk`, then enforce the boundary in CI.

This is not a "remove Supabase from package.json" program. Supabase Auth remains
the browser identity and session provider. Parchment already owns API
authentication and product authorization: it validates forwarded user JWTs and
Parchment API keys, resolves the canonical principal, and enforces product
roles, plans, scopes, ownership, and entitlements. Coffee-app may also retain
explicitly app-local persistence until a separate decision moves it:

- Supabase Auth OAuth initiation, session creation and refresh, signed-in user
  resolution, sign-out, and server-side JWT forwarding
- web chat `workspaces`, `workspace_messages`, canvas state, and `user_memory`
- Stripe checkout/webhook/reconciliation data while coffee-app remains the
  billing front end
- app-local UI state with no reusable cross-surface business behavior

Parchment remains the sole migration authority for the shared database even for
retained coffee-app callers.

## Why now

The API-first extraction has shipped enough contract surface that the remaining
coffee-app implementation is misleading. Chat tools already use the SDK, while
page routes and compatibility handlers still bypass it. The repository currently
contains direct access to 26 database tables and 12 named RPCs across
runtime and test files. Some are intentional web concerns, but the shared-data
subset duplicates authorization, business rules, joins, and output shaping that
Parchment already owns or should own.

This creates four production risks:

1. Web, CLI, and external API behavior can diverge.
2. Coffee-app can depend on schema changes before the Parchment contract is
   deployed.
3. Shared proprietary logic remains in the public reference-client repository.
4. A successful API implementation can be mistaken for a completed cutover even
   when the live web caller still reads Supabase.

## Strategy Alignment Audit

- **Canonical direction:** This completes ADR-007's reference-client boundary:
  Parchment owns shared behavior, the SDK owns typed transport, and coffee-app
  owns web presentation and BFF credential custody.
- **Product principle supported:** API-first behavior, one source of product
  truth, and a defensible private data/intelligence layer.
- **Cross-surface effect:** Web, CLI, API consumers, and chat tools converge on
  the same contracts and authorization rules.
- **Public value legibility:** The public web app becomes credible integration
  proof instead of a privileged alternate implementation.
- **Moonshot check:** No moonshot is needed. This is required foundation for
  already-ratified API-first product direction.
- **Scope check:** The program excludes MCP, a chat UX rewrite, Stripe relocation,
  workspace/memory relocation, and eliminating Supabase Auth.

## Current debt inventory

### Shared data that must leave coffee-app

1. **Catalog, market, and similarity**

   - Direct `coffee_catalog`, `price_index_snapshots`,
     `market_daily_summary`, and `supplier_daily_stats` reads
   - Local `find_similar_beans_aggregated*` RPC fallbacks
   - Local `get_supplier_price_ranges` and agent price-index reads
   - Primary callers: analytics, chat context, tracked-lot enrichment, legacy
     beans/tool routes, `catalogSimilarity.ts`, and `agentPriceIndex.ts`

2. **Portfolio and procurement**

   - Direct `tracked_lots` reads/writes and catalog joins
   - Direct `sourcing_briefs` summaries in dashboard/chat
   - Parchment already owns brief list/create/get/matches; it lacks the complete
     portfolio/watchlist contract and some brief lifecycle/parity operations

3. **Mallard Studio owner data**

   - Direct `green_coffee_inv`, `roast_profiles`, `roast_temperatures`,
     `roast_events`, `artisan_import_log`, and `sales` access
   - Direct catalog joins in inventory/tasting flows
   - `update_green_coffee_from_catalog`, chart-data, chart-metadata, milestone,
     stocked-status, batch-delete, and profit behavior
   - Parchment already ships owner-scoped inventory, roast, Artisan import,
     sales, and tasting reads/writes, but some web parity gaps remain

4. **API control plane and product authorization**

   - Direct `api_keys`, `api_usage`, `get_api_usage_summary`, rate-limit, and
     local API-key validation paths
   - Admin-client JWT validation, direct `user_roles`/entitlement reads, and
     coffee-app principal construction that duplicates Parchment
   - Key management pages already use the SDK; usage dashboards and legacy
     compatibility authorization still bypass Parchment

5. **Bean identity**

   - Direct `bean_identities`, `bean_identity_links`, and
     `bean_identity_events` access
   - Direct `create_bean_identity_candidate` and `review_bean_identity_link`
     RPC calls
   - This is shared proprietary identity logic and belongs behind reviewed
     Parchment admin/service contracts

6. **Chat actions and legacy RAG**
   - Direct `execute_chat_action` RPC for confirmed writes
   - Direct `match_coffee_chunks`, catalog joins, and embedding-backed
     `/api/tools/coffee-chunks`
   - Confirmed writes must call Parchment owner-scoped mutation contracts with
     idempotency. The legacy catalog-chunk RAG route should be deleted if no live
     caller remains; it must not be preserved merely to avoid deleting code.

### Explicitly retained, not silently ignored

The following direct Supabase categories are tracked as allowed web-local
boundaries, not counted as completed extraction debt:

- Supabase Auth OAuth/session operations, request-local session clients, and JWT
  forwarding. This allowlist does not include admin-client token validation,
  product-principal construction, role lookup, or entitlement resolution.
- `workspaces`, `workspace_messages`, and `user_memory`
- `billing_subscriptions`, `stripe_customers`, `stripe_session_processing`,
  and billing audit state used by the current billing front end. Product-role
  and entitlement reads/writes are not retained merely because billing remains
  web-local.

Their schemas still move only through Parchment-owned migrations. A future
decision to move chat orchestration or billing behind Parchment should create a
separate program with its own product and deployment risks.

## Target behavior

At program completion:

- Coffee-app shared-data callers instantiate a server-only Parchment client and
  use SDK helpers or the typed raw client.
- The browser never receives a Parchment demo key or raw API key.
- Parchment enforces row ownership, entitlement, scope, rate limits,
  idempotency, and shared business rules.
- Coffee-app uses Supabase Auth only to establish and refresh the browser
  identity session, then uses Parchment's authenticated principal response for
  product route UX and presentation.
- Coffee-app BFF routes are limited to token custody, request/response adaptation,
  cache/header policy, presentation shaping, and web-specific orchestration.
- No shared-data Supabase table or RPC appears in active coffee-app runtime code.
- A CI boundary check prevents reintroduction and carries a small named allowlist
  for retained auth/workspace/billing paths.

## Contract and deployment rules

1. Parchment API implementation, OpenAPI contract, generated SDK, and tests land
   before the corresponding coffee-app consumer PR.
2. A Parchment release must be published and production-deployed before a web
   consumer depends on it.
3. Consumer cutovers preserve current web response shapes at the BFF boundary
   unless an explicit UI contract change is part of that slice.
4. Every consumer PR deletes the replaced query/RPC code and shrinks the CI
   allowlist. A proxy that leaves duplicate business logic behind is incomplete.
5. Writes use Parchment idempotency and optimistic concurrency rather than
   recreating database transaction semantics in coffee-app.
6. Production rollout uses capability canaries and error-rate observation. Do
   not dual-write.

## Ordered PR sequence

### PR 01: Boundary ledger and CI guard

Repo: coffee-app. Add a machine-checked inventory of allowed Supabase callers,
classify each by owner, and fail CI on any new unclassified table/RPC/import.
This establishes an honest baseline without changing runtime behavior.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-01-guard.md`

### PR 02: Market, portfolio, and API-usage contracts

Repo: parchment-api. Fill only verified contract gaps needed by the web:
canonical analytics/market overview data, owner-scoped portfolio/watchlist
operations, sourcing-brief lifecycle parity, and owner API-usage summaries.
Add an authenticated self/principal projection for the web's route and
presentation needs. Extend OpenAPI and the SDK in the same PR or release train.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-02-platform-contracts.md`

### PR 03: Market, portfolio, procurement, and usage consumer cutover

Repo: coffee-app. Repoint analytics, dashboard, beans/catalog tracking, chat
sourcing context, price-index readers, and API-usage pages to the released SDK.
Replace local API-key validation, admin-client JWT validation, direct
role/entitlement reads, and local product-principal construction with the
Parchment principal contract. Delete direct
catalog/market/tracked-lot/brief/api-key/usage query logic.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-03-platform-consumers.md`

### PR 04: Inventory and tasting consumer cutover

Repo: coffee-app. Use the already-shipped owner inventory and tasting contracts
for beans, inventory tools, tasting routes, and catalog enrichment. Preserve
web response shapes and remove direct inventory/tasting table access.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-04-inventory-tasting.md`

### PR 05: Roast and profit parity contracts

Repo: parchment-api. Add only missing reusable behavior proven by the web caller
inventory: batch-safe roast operations if still required, chart/milestone
projection, derived stocked-state handling, and canonical profit summary.
Avoid exposing raw helper RPCs or presentation-specific payloads.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-05-roast-profit-contracts.md`

### PR 06: Roast, sales, and profit consumer cutover

Repo: coffee-app. Repoint roast pages/routes, chart data, milestone handling,
sales, and profit to the released SDK. Delete local CRUD, cascading deletes,
chart RPC, stock-derived update, and profit implementations.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-06-roast-sales-profit.md`

### PR 07: Bean identity and confirmed-action contracts

Repo: parchment-api. Add reviewed service/admin bean-identity operations and a
canonical idempotent confirmed-action contract, reusing owner-scoped inventory,
roast, sales, and tasting services internally.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-07-identity-actions-contracts.md`

### PR 08: Bean identity and chat-action consumer cutover

Repo: coffee-app. Replace direct identity tables/RPCs and
`execute_chat_action`. Keep LLM schemas, confirmation UI, and action cards in
coffee-app; send confirmed business mutations to Parchment.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-08-identity-actions-consumers.md`

### PR 09: Retire legacy catalog RAG

Repo: coffee-app. Prove whether `/api/tools/coffee-chunks` has a live caller. If
not, delete it, `ragService.ts`, and `match_coffee_chunks` access. If a live
caller exists, stop and require the separately planned Parchment knowledge-search
contract rather than porting the legacy table-shaped route.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-09-rag-retirement.md`

### PR 10: Final boundary contraction

Repo: coffee-app. Remove dead shared database types, all product-authorization
admin-client use, legacy API auth helpers, compatibility routes, and allowlist
entries. Retain only the minimal Supabase Auth browser-session integration.
Update architecture docs with the exact boundary and run the production canary
matrix.

Plan:
`2026-07-22-coffee-app-supabase-data-boundary-pr-10-final-contraction.md`

## Dependencies and stop points

- PR 01 can ship immediately and is useful even if no later cutover lands.
- PR 02 must deploy and publish its SDK before PR 03.
- PR 04 uses existing released contracts, but starts only after PR 01 so the
  allowlist proves the deletion.
- PR 05 must deploy and publish before PR 06.
- PR 07 must deploy and publish before PR 08.
- PR 09 is deletion-first. Discovery of a real caller changes its disposition to
  blocked on the Market Wire knowledge contract; it does not authorize a new
  ad-hoc RAG API.
- PR 10 begins only when PRs 03, 04, 06, 08, and 09 have removed their
  shared-data callers.

Each API PR is independently useful to SDK/CLI clients. Each coffee-app consumer
PR is mergeable against an already-deployed contract and leaves the app working
if later slices never land.

## API and data impact

- New Parchment contracts are capability-shaped, not table-shaped.
- No coffee-app migration files are added. Any schema or RPC change is authored
  and applied through parchment-api.
- Existing external contracts remain backward compatible unless separately
  versioned.
- API writes preserve owner checks, exact write scopes, idempotency, audit
  records, and optimistic concurrency.
- Final removal of obsolete database functions/tables is a later Parchment
  schema-cleanup decision after production usage proves zero callers.

## Acceptance criteria

- CI reports zero unclassified Supabase access.
- Active coffee-app runtime has no direct access to shared catalog, market,
  portfolio, procurement, inventory, roast, tasting, sales, API-control-plane,
  bean-identity, or legacy RAG tables/RPCs.
- Web catalog, analytics, dashboard, beans, roast, profit, API dashboard, and
  chat confirmation canaries pass for public, viewer, Intelligence, member, and
  admin principals as applicable.
- CLI and direct SDK canaries remain unchanged because Parchment contracts are
  additive and canonical.
- Supabase Auth session operations, workspaces/memory, and billing persistence
  callers are explicitly named in the retained allowlist and architecture doc;
  product-role and entitlement resolution are absent, and there is no claim of
  zero Supabase usage.
- Database migrations and shared schema artifacts exist only in parchment-api.

## Test plan

Every Parchment contract PR:

- route/service authorization tests for session and scoped API-key principals
- owner isolation, 401/403/404, pagination, validation, idempotency, and conflict
  tests
- OpenAPI generation diff and SDK client tests
- package lint, typecheck, unit/integration tests, and build

Every coffee-app consumer PR:

- adapter/route tests asserting SDK calls, credential mode, status mapping, and
  response-shape compatibility
- negative tests proving the replaced Supabase client is not invoked
- affected page/component tests
- `pnpm check`, focused Vitest suites, lint/format, and build
- production canaries after the upstream Parchment deployment

Final contraction:

- repository scan for banned shared table/RPC names
- boundary guard with only auth/workspace/billing allowlist entries
- no `createAdminClient()` use outside the named retained categories
- public-demo key and session-token custody tests

## Risks and rollback

- **Shape drift:** Keep presentation adapters in coffee-app and assert golden
  route/page fixtures.
- **Independent deploy order:** Land and deploy Parchment first; do not merge a
  consumer against an unpublished SDK.
- **Hidden callers:** PR 01's ledger and PR 09's usage proof prevent deleting a
  path based only on imports.
- **Latency:** Prefer server-side Parchment composite resources for genuinely
  reusable decision views; do not replace one database query with dozens of
  sequential HTTP calls.
- **Write regressions:** Use idempotent Parchment mutations and conflict-aware UI
  behavior. Never dual-write as a rollback strategy.
- **Rollback:** Revert the coffee-app consumer PR while leaving additive API
  contracts deployed. Schema cleanup waits until after the observation window.

## Open questions for Reed

1. Treat workspaces/user memory and Stripe/billing as intentionally web-local
   for this program, or authorize separate follow-on extraction programs?
2. Should tracked lots retain the current UI name while the canonical API uses
   `portfolio`, or should the product language move to Watchlist everywhere?
3. Is the legacy `/api/tools/coffee-chunks` route known to have any external
   consumer? The recommended default is deletion after repository and production
   telemetry checks.
