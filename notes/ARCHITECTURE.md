# Coffee-app architecture and migration boundary

**Status:** Current implementation truth
**Last verified:** 2026-08-14

This document describes what coffee-app does today. `notes/PRODUCT_VISION.md`
defines product direction, ADRs preserve decisions, and `notes/DEVLOG.md` owns
priority. When an older plan or ADR describes a future extraction as already
complete, this document is the implementation-state correction.

## Runtime boundaries

- **Parchment API owns shared database schema, public API contracts, and shared
  business behavior.** Its repository is the sole migration authority for the
  shared Supabase project.
- **`@purveyors/sdk` is the generated typed HTTP client.** Coffee-app creates
  server-only SDK clients and, depending on the route, forwards the caller's
  session credential, a server-held public/demo API key, or no credential at
  all. Public website catalog reads use the demo key. Anonymous Market Index
  teaser slices use the default session-mode client without a session
  credential and call only their deliberately anonymous upstream
  signals-summary, retail-stats, and process-metadata routes. The SDK does not
  call or embed the CLI.
- **`@purveyors/cli` is an independent API client and terminal product.** It
  depends on the SDK and Parchment contracts. Coffee-app does not depend on or
  import CLI functions.
- **Coffee-app owns the web experience.** That includes SvelteKit pages, browser
  session handling, BFF credential brokering, chat tool schemas and rendering,
  billing UI, and app-specific presentation behavior. Supabase Auth creates and
  refreshes the browser session; it does not make coffee-app the authority for
  product roles, plans, scopes, or entitlements.

## Authentication and authorization boundary

Two distinct auth responsibilities are intentionally composed:

1. **Supabase Auth is the browser identity and session provider.** Coffee-app
   initiates Google OAuth, stores and refreshes the secure browser session,
   resolves the signed-in user, handles sign-out, and forwards the resulting
   user JWT from its server-side BFF. This is identity/session plumbing, not
   direct product-data access.
2. **Parchment authenticates API credentials and authorizes product behavior.**
   Parchment validates forwarded user JWTs and Parchment API keys, resolves the
   canonical principal, and enforces roles, plans, scopes, ownership, and product
   entitlements at the data source.

Coffee-app keeps only the Supabase browser session client, forwards its JWT to
Parchment, and consumes `GET /v1/me` through `@purveyors/sdk` for canonical
request-principal, role, plan, scope, and entitlement decisions. The projection
is cached on request locals. Invalid credentials resolve anonymously; an
upstream principal-resolution failure is not downgraded to viewer access.
Server routes consume only `locals.principal` for request authentication and
authorization. `locals.safeGetIdentity()` remains narrowly scoped to Supabase
browser identity hydration; legacy `locals.session`, `locals.user`,
`locals.role`, and `safeGetSession()` aliases are intentionally absent.

The browser receives only a sanitized `PageAuthView` containing signed-in state,
user ID/email, primary app role, and Parchment Intelligence access. Supabase
access tokens, refresh tokens, expiry metadata, and provider user/session
objects remain server-side and are never serialized into SvelteKit page data.

The canonical external API reference is
<https://api.purveyors.io/docs>. Product and CLI guidance lives at
<https://purveyors.io/docs>.

## Account deletion boundary

Parchment owns the durable account-deletion saga. Coffee-app requires a current
cookie session, same-origin request, exact confirmation, and recent Google
reauthentication. Its OAuth callback signs a purpose-bound, at-most-ten-minute
Ed25519 assertion, and the deletion BFF forwards that assertion unchanged to
Parchment. A durable `202` first acceptance or `200` replay is terminal for the
browser: it signs out locally while Parchment cancels the entire attached
subscription, settles provider state, deletes account-owned database records,
and deletes Supabase Auth last. Retries, reconciliation, and operator evidence
belong to Parchment, not to a browser capability.

Coffee-app retains the private signing-key ring; Parchment receives only the
matching public-key ring. Rotation is verifier-first. A successful acceptance
clears the assertion and uses transient browser state for completion messaging.
There is no account-bound accepted, retry, receipt, or completion cookie.

## Billing authority boundary

Parchment owns Checkout creation and recovery, the purchase catalog and Stripe
price mapping, owner-wide trial eligibility, Stripe webhook settlement,
canonical subscription snapshots and whole-subscription mutations, entitlement
recomputation, and provider correlation. Coffee-app is the cookie-session BFF
and UX consumer of those contracts. It retains stable purchase keys and product
copy, transient request and admission IDs, Stripe.js embedded Checkout, and the
public Stripe publishable key. It does not retain a Stripe server credential,
webhook handler, provider destination, direct billing-table writer, local
entitlement recomputation path, or provider reconciliation authority.

Parchment's private admission IDs and its owner-bound `subscriptionId` management
handle cross the coffee-app browser boundary. The subscription handle is the
sole provider management identifier permitted there because the accepted PATCH
contract requires it to select the complete canonical subscription. Stripe
Customer, Checkout Session, subscription-item, and price identifiers do not
enter browser page data. Provider objects must not copy the owner UUID into
Stripe metadata or `client_reference_id`. Stripe may retain immutable historical
transaction references under its own legal and platform retention rules; the
Parchment evidence surface counts those legacy references instead of
misrepresenting them as erased.

No external Market Read mailing provider is live. Before one is enabled, its
subscriber discovery, erasure or suppression, retry semantics, and aggregate
evidence must be added to Parchment's provider phase. Deleting only the local
subscription row is not a sufficient future integration contract.

## Public data flow

Parchment's production catalog, owner, and entitled data endpoints require a
Bearer credential. In particular, `GET https://api.purveyors.io/v1/catalog`
returns `401` without one. Deliberately designated Market Index teaser slices
remain anonymous; they are a narrow route contract, not a general anonymous
data lane. The Parchment service descriptor is
`GET https://api.purveyors.io/`; there is no `GET /v1` descriptor.

Public website pages remain browsable without a user login because coffee-app's
server-side BFF uses `PARCHMENT_PUBLIC_DEMO_API_KEY` for approved public/demo
reads. That credential never reaches the browser. This is not anonymous upstream
API access.

The old same-host `https://purveyors.io/v1/*` routes and
`/api/catalog-api` are retired. External integrations call
`https://api.purveyors.io/v1/*` directly. Coffee-app's `/api/catalog` family is a
first-party BFF compatibility layer, not a public integration contract.

## Direct Supabase reality

Coffee-app has not completed the direct-Supabase extraction described by
ADR-007. Direct calls still exist in several categories.

### App-local and integration concerns

These calls are expected to remain local unless a later decision moves them:

- Supabase Auth OAuth initiation, browser session creation and refresh,
  signed-in user resolution, sign-out, and server-side JWT forwarding
- web-only workspace and message persistence
- user memory and UI-specific state
- billing, Checkout, subscription, account-deletion, and admin presentation
  state consumed through Parchment SDK contracts

Even in these areas, shared schema changes still belong to Parchment's migration
authority.

### Shared platform behavior that remains migration debt

These direct paths cross the intended Parchment API boundary and need explicit
replacement or retirement:

- catalog and market reads from `coffee_catalog`, `market_daily_summary`, and
  `supplier_daily_stats`
- bean-identity candidate and review operations over shared identity tables
- sourcing brief summaries against shared catalog rows
- legacy catalog RAG reads and `match_coffee_chunks`
- roast, sales, and tasting data helpers that still write Supabase directly even
  though equivalent account-linked Parchment contracts now exist

Inventory share creation and cross-principal redemption now use Parchment's
share-grant contract through thin BFF adapters. Coffee-app no longer reads
`shared_links`, the share owner's `user_roles`, or cross-owner inventory,
catalog, and roast rows directly.

The existence of a Parchment endpoint does not prove coffee-app has migrated to
it. The canonical backlog tracks this as the headless-cutover debt audit. Each
path needs a source-level caller inventory, a replacement contract, and a
mergeable deletion or migration slice before it can be called complete.

Tracked-lot portfolio reads and writes are no longer included in this debt list;
coffee-app now consumes the Parchment-owned portfolio contract through the SDK.

Authenticated tasting reads are also no longer migration debt. The chat tool and
legacy compatibility route consume the Parchment tasting contract through the
SDK, and the obsolete direct-Supabase tasting helper has been removed. Owner
cupping-note and rating writes now travel through the Parchment inventory mutation
contract through the SDK, so the web preserves its complete notes payload and
overall rating without a direct Supabase update.

Catalog-backed and manual inventory creation from the beans form now use atomic
Parchment batch contracts through the SDK. The legacy scalar inventory writer and
its direct-Supabase helper have been removed. The separately planned confirmed
chat-action RPC remains migration debt and is not part of the beans-form cutover.

Parchment Console API-usage pages also consume the session-only
`ParchmentClient.apiUsage.get` contract. Owner traffic totals remain aggregate,
while monthly quota state is derived only from exact per-key counts because plan
limits apply independently to each API key. Coffee-app retains only the
presentation mapping for these analytics.

## Cherry Runtime and tool flow

Coffee-app owns Cherry Runtime's user-facing orchestration. Its chat route builds a session-mode `ParchmentClient` from
`@purveyors/sdk` and passes it into app-owned tool adapters. The adapters own LLM
schemas, permission checks, proposal and confirmation flows, compact model
output, and UI artifacts. Parchment owns shared data access and reusable business
behavior behind HTTP endpoints.

Entitlements select the runtime role: Parchment Intelligence-only access uses the
Cherry Green Agent, Mallard Studio-only access uses the Cherry Roast Agent, and
combined access uses the Cherry Synthesis Agent. These are execution roles, not
personas or model identities. The current parent-model preset remains an internal
runtime dependency until a deployed Cherry model alias is available.

The CLI reaches those same endpoint families as a peer consumer. The shared
layer is the API contract and generated SDK, not CLI source code. Historical
plans in which coffee-app imported `@purveyors/cli/*` describe a former
architecture and are not current guidance.

Cherry Runtime's `price_index_read` adapter consumes `ParchmentClient.priceIndex.list`
through the request's session-mode client and maps the API response into its
app-owned tool result. It no longer queries shared price-index storage directly.

The analytics page's historical price chart consumes
`ParchmentClient.priceIndex.history` through the request's session-mode client.
Anonymous requests use the contract's optional-auth 90-day window; authenticated
Parchment Intelligence sessions receive the entitled 365-day window. Coffee-app
paginates the typed response and retains only presentation mapping into its
existing chart shape; it no longer reads `price_index_snapshots` directly.

Cherry Runtime's `find_similar_beans` adapter likewise consumes
`ParchmentClient.catalog.similar`. Bean matching remains available only where
Parchment grants `canUseBeanMatching`; PPI access by itself does not widen that
capability or the catalog row projection. The former service-role Supabase RPC
implementation and duplicated similarity classifier have been removed from
coffee-app.

## Near-term protocol direction

REST/OpenAPI plus the generated SDK are the active integration strategy. MCP is
not a near-term target and is not implemented. MCP proposals remain under
`notes/archive/` for historical research only.
