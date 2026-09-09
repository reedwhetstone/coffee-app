# Coffee-app architecture and migration boundary

**Status:** Current implementation truth
**Last verified:** 2026-09-09

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
  session handling, BFF credential brokering, AI SDK client transport and
  structured rendering, billing UI, and app-specific presentation behavior.
  Supabase Auth creates and
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

The production catalog map follows the same boundary. The MapLibre experience
uses the first-party `/api/catalog/map` BFF, which attaches the public/demo or
session credential server-side and relays the typed Parchment
`GET /v1/catalog/map` point projection without local entitlement or statistics
logic. MapLibre clusters the lightweight authorized points in its web worker so
screen-size changes and zooms do not require a new API projection. Authenticated
responses are private/no-store; the configured public/demo projection alone is
share-cacheable and varies on browser credential context. The ordinary catalog
list remains the default view and failure recovery path. No environment flag
controls the map rollout.

## Supabase and product-data boundary

The direct-Supabase extraction described by ADR-007 is complete. Coffee-app has
no production table or RPC caller, generated shared-database type, service-role
runtime, or schema-generation workflow. All catalog, market, inventory, roast,
sales, tasting, sharing, billing, account, conversation, memory, and AI
orchestration behavior crosses a Parchment contract through `@purveyors/sdk`.

Supabase remains only the browser identity and session provider: OAuth
initiation, cookie-backed session creation and refresh, signed-in identity
resolution, sign-out, and forwarding the session JWT from a same-origin BFF.
The service-role credential is test-only for the dedicated Playwright account;
it is not a Coffee-app runtime dependency. Shared schema and migrations remain
exclusively Parchment-owned.

Terminal source guards reject product `.from()` and `.rpc()` calls,
database-derived shared types, provider credentials and SDKs, local model/tool
orchestration, and retired backend surfaces. New product behavior must enter
through an accepted Parchment contract rather than rebuilding a web-local
backend.

## Cherry Runtime and tool flow

Parchment owns Cherry Runtime's model-facing orchestration: agent-role selection,
prompts, model/provider selection, tool schemas and execution, request budgets,
and the incremental AI SDK stream. Tool execution uses owner-bound Parchment
capabilities in-process, without routing back through coffee-app or Parchment's
public HTTP API.

Coffee-app remains the browser session and presentation boundary. Its `/api/chat`
route admits a trusted entitled session, forwards the request through
`ParchmentClient.conversation.chat.stream`, and returns the upstream response
without buffering. The Svelte AI SDK client continues to consume the same-origin
UI-message stream and render structured tool parts, evidence blocks, proposal
cards, cancellation, retry, and confirmation UX. Browser credentials never call
Parchment or the provider directly.

Entitlements select the runtime role: Parchment Intelligence-only access uses the
Cherry Green Agent, Mallard Studio-only access uses the Cherry Roast Agent, and
combined access uses the Cherry Synthesis Agent. These are execution roles, not
personas or model identities. The current parent-model preset remains an internal
runtime dependency until a deployed Cherry model alias is available.

The CLI reaches those same endpoint families as a peer consumer. The shared
layer is the API contract and generated SDK, not CLI source code. Historical
plans in which coffee-app imported `@purveyors/cli/*` describe a former
architecture and are not current guidance.

Cherry Runtime's `price_index_read` tool consumes the canonical price-index
capability inside Parchment. It no longer queries shared price-index storage from
coffee-app or makes a self-HTTP request during the tool loop.

The analytics page's historical price chart consumes
`ParchmentClient.priceIndex.history` through the request's session-mode client.
Anonymous requests use the contract's optional-auth 90-day window; authenticated
Parchment Intelligence sessions receive the entitled 365-day window. Coffee-app
paginates the typed response and retains only presentation mapping into its
existing chart shape; it no longer reads `price_index_snapshots` directly.

Cherry Runtime's `find_similar_beans` tool likewise uses Parchment's canonical
similarity capability in-process. Bean matching remains available only where
Parchment grants `canUseBeanMatching`; PPI access by itself does not widen that
capability or the catalog row projection. The former service-role Supabase RPC
implementation and duplicated similarity classifier remain retired from
coffee-app.

## Near-term protocol direction

REST/OpenAPI plus the generated SDK are the active integration strategy. MCP is
not a near-term target and is not implemented. MCP proposals remain under
`notes/archive/` for historical research only.
