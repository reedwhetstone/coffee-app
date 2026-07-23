# ADR-007: Headless API Extraction — coffee-app Becomes a Public Reference Client

**Status:** Accepted; migration in progress
**Date:** 2026-06-28

> Companion ADR. The parchment-api repo carries the mirror decision from the API
> side. This ADR records the destination for coffee-app. Current implementation
> state and remaining direct-Supabase debt are tracked in
> `notes/ARCHITECTURE.md` and the headless-cutover entry in `notes/DEVLOG.md`.

## Current implementation status

The catalog BFF and server-side chat tools use `@purveyors/sdk`, and coffee-app
does not depend on `@purveyors/cli`. The extraction is not complete. Coffee-app
still performs direct Supabase reads and writes for auth, billing, workspaces,
Mallard Studio workflows, and several shared catalog, market, similarity,
tracking, RAG, API-key, and usage paths. Parchment is the sole shared-schema
migration authority even while these callers remain.

## Context

At the time of this decision, coffee-app was both the web UI and the de facto home of the platform's
backend logic: SvelteKit server routes under `/api/*` (40+ handlers) and the
canonical `/v1/*` contract, plus the AI chat/agent surface, billing, and the
shared service layer (`src/lib/server/*`). ADR-002 already established a
canonical external/internal split and a `/v1` contract; this ADR extends that
trajectory to its conclusion.

Purveyors is a data and intelligence product. The product is the API platform
and the proprietary data behind it, not the web interface. The web app exists to
serve less-technical customers and to demonstrate, to technical customers
(roaster tools, hardware, sourcing platforms), how easily the Parchment API
plugs into their own systems. The interface is a model-home, not the moat.

Two business constraints force a repo boundary:

1. **coffee-app is and stays public.** It is a reference/model-home client.
2. **The implementation is proprietary.** Scoring, intelligence, similarity,
   procurement, price indexing, and AI orchestration are half the moat; the
   private Supabase data is the other half. These must live behind a private
   boundary.

A single repo has one visibility setting, so the proprietary API cannot live in
this public repo.

## Decision

Extract the backend into the **private** `parchment-api` repo (a long-running
Node service, Hono framework) as the single source of truth serving all surfaces.
The destination is a thin, public coffee-app reference client that consumes
shared platform behavior through published `@purveyors/sdk` contracts generated
from the API's OpenAPI spec.

Concretely, for this repo:

- **No proprietary logic in coffee-app.** Server-side business logic currently in
  `src/routes/api/*` and `src/lib/server/*` moves behind the private API. What
  remains here is presentation, generic SDK usage, and a thin BFF.
- **BFF auth-forwarding stays.** The SvelteKit server keeps the secure session
  cookie and forwards a Supabase Bearer token to the API. This preserves the
  existing cookie security model (Supabase remains the auth source of truth via
  the unified `principal` model) and is itself exemplary reference code for
  integrators. The browser never holds raw API keys.
- **AI chat/agent becomes a client of a streaming API endpoint.** The chat UI
  consumes the API's streaming `/chat` + `/agent` endpoints rather than running
  agent orchestration in this repo's server routes.
- **Migration is strangler-fig.** Per capability group, repoint coffee-app to the
  SDK and delete the now-duplicated server logic. `/v1` is the seam (already
  contract-shaped per ADR-002); legacy `/api/*` routes proxy/deprecate with
  existing `Sunset` headers. Every step leaves the app working.
- **A CI guard** fails the build if coffee-app server code reintroduces
  non-presentation/non-SDK/non-BFF logic, keeping the public repo clean of
  proprietary surface over time.

Runtime note: the API is a persistent Node server, not edge/Workers, because the
AI-first streaming and multi-step agent loops need persistent execution. This
does not affect coffee-app's Vercel deployment; the web app stays on Vercel and
talks to the API over HTTP.

## Consequences

- coffee-app becomes a clean, public demonstration of the API platform: living
  integration proof and marketing, not the architecture center.
- Proprietary logic and data access leave the public repo and consolidate behind
  the private API; the moat tightens.
- One contract (`@purveyors/sdk`) feeds web, CLI, chatbot, and third parties;
  no duplicated backend access patterns across surfaces ("never repeat truth" at
  the network boundary).
- During migration, coffee-app depends on SDK publishes: contract changes land in
  the API + SDK first, then the consuming coffee-app PR. SDK is semver'd.
- The web app's server shrinks to a BFF + presentation; server-side test surface
  shrinks accordingly.
- Existing `/v1` consumers and `/api/*` legacy callers keep working throughout via
  delegation/proxy and sunset headers; no big-bang breakage.
- Once all callers migrate, legacy `/api/*` routes in this repo are removed.

## References

- ADR-002: External/Internal API Split and Migration to /v1/catalog (the contract
  seam this builds on).
- ADR-006: CLI-owned portable agent tools (the CLI is a peer SDK consumer).
- Cross-repo blueprint: `brain/projects/parchment-api-extraction-spec.md`.
