# Coffee-app architecture and migration boundary

**Status:** Current implementation truth
**Last verified:** 2026-07-22

This document describes what coffee-app does today. `notes/PRODUCT_VISION.md`
defines product direction, ADRs preserve decisions, and `notes/DEVLOG.md` owns
priority. When an older plan or ADR describes a future extraction as already
complete, this document is the implementation-state correction.

## Runtime boundaries

- **Parchment API owns shared database schema, public API contracts, and shared
  business behavior.** Its repository is the sole migration authority for the
  shared Supabase project.
- **`@purveyors/sdk` is the generated typed HTTP client.** Coffee-app creates
  server-only SDK clients, attaches either the caller's session credential or a
  server-held public/demo API key, and calls Parchment endpoints. The SDK does
  not call or embed the CLI.
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

The current coffee-app implementation still duplicates parts of the second
responsibility through admin-client JWT validation, local API-key validation,
and direct `user_roles` or entitlement reads. Those paths are migration debt,
not part of the retained Supabase Auth boundary. The target BFF keeps only the
Supabase browser session client, forwards its JWT to Parchment, and consumes a
Parchment self/principal contract for route UX and presentation decisions.

The canonical external API reference is
<https://api.purveyors.io/docs>. Product and CLI guidance lives at
<https://purveyors.io/docs>.

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
- Stripe checkout, webhook, subscription reconciliation, and local billing UI
  state while coffee-app remains the billing front end; product-entitlement
  resolution and mutation still belong behind Parchment

Even in these areas, shared schema changes still belong to Parchment's migration
authority.

### Shared platform behavior that remains migration debt

These direct paths cross the intended Parchment API boundary and need explicit
replacement or retirement:

- catalog and market reads from `coffee_catalog`, `price_index_snapshots`,
  `market_daily_summary`, and `supplier_daily_stats`
- local similarity and matching RPCs over catalog data
- bean-identity candidate and review operations over shared identity tables
- sourcing brief summaries and tracked-lot joins against shared catalog rows
- legacy catalog RAG reads and `match_coffee_chunks`
- local API-key and usage-table access where the Parchment control plane should
  be authoritative
- admin-client JWT validation, direct `user_roles`/entitlement reads, and local
  principal construction that duplicate Parchment API authentication and
  authorization
- inventory, roast, sales, and tasting data helpers that still write Supabase
  directly even though equivalent account-linked Parchment contracts now exist

The existence of a Parchment endpoint does not prove coffee-app has migrated to
it. The canonical backlog tracks this as the headless-cutover debt audit. Each
path needs a source-level caller inventory, a replacement contract, and a
mergeable deletion or migration slice before it can be called complete.

## Chat and agent flow

Coffee-app's chat route builds a session-mode `ParchmentClient` from
`@purveyors/sdk` and passes it into app-owned tool adapters. The adapters own LLM
schemas, permission checks, proposal and confirmation flows, compact model
output, and UI artifacts. Parchment owns shared data access and reusable business
behavior behind HTTP endpoints.

The CLI reaches those same endpoint families as a peer consumer. The shared
layer is the API contract and generated SDK, not CLI source code. Historical
plans in which coffee-app imported `@purveyors/cli/*` describe a former
architecture and are not current guidance.

## Near-term protocol direction

REST/OpenAPI plus the generated SDK are the active integration strategy. MCP is
not a near-term target and is not implemented. MCP proposals remain under
`notes/archive/` for historical research only.
