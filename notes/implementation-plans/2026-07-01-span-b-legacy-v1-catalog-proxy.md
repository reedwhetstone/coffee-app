# Span B — Legacy coffee-app `/v1` (and `/api` catalog) Proxy/Deprecate

Status: active as of 2026-07-01
Owner: coffee-app
Depends on: Span A complete (PR #409 catalog page cutover; parchment-api PR #26/#27 contract; PR #28 P3 cleanup).

## Context

ADR-007 makes coffee-app a thin public reference client of the private Parchment
API. Span A cut the `/catalog` **page** over to `client.catalog.list()` via the
BFF/SDK. But coffee-app still carries a full duplicate of catalog query logic in
`src/lib/server/catalogResource.ts`, and that duplicate is still the live
implementation behind four external routes:

- `GET /v1/catalog` (`src/routes/v1/catalog/+server.ts`)
- `GET /v1/catalog/proof-coverage` (`src/routes/v1/catalog/proof-coverage/+server.ts`)
- `GET /api/catalog-api` (`src/routes/api/catalog-api/+server.ts`) — API-key feed, already carries Deprecation/Sunset headers
- `GET /api/catalog` (`src/routes/api/catalog/+server.ts`) — legacy app catalog

This is the "repeat truth at the network boundary" ADR-007 exists to remove:
the same catalog listing/filter/projection logic now lives in **both**
parchment-api and coffee-app. Parchment already has full parity
(`catalogListRoute`, `catalogProofCoverageRoute`), landed in Span A.

Span B repoints these routes to **proxy** Parchment (forwarding the caller's own
credential) and deletes the now-dead coffee-app catalog logic, while keeping the
routes alive with Deprecation/Sunset headers so external consumers and the CLI
keep working during the migration window.

## Later follow-ups captured during B1

These findings are real, but they are intentionally deferred so the migration can
continue in small mergeable slices.

### Catalog picker pagination/projection ergonomics

B1 patched `/api/catalog` to preserve the legacy full-list behavior by requesting
up to `MAX_CATALOG_PAGE_LIMIT` rows when old unparameterized callers omit
pagination. That is an acceptable parity shim, but it should not become the
long-term app pattern.

The beans inventory picker does not really need a paginated full catalog row
response; it needs a lightweight searchable catalog option projection. The better
follow-up is to promote the existing coffee-app dropdown/data-shape idea into
Parchment and the SDK, for example:

- API: add a first-class catalog option projection (`fields=dropdown` or a
  dedicated lookup route) with `id`, display name, source/roaster, and any small
  fields required for the picker.
- SDK: expose a typed helper such as `catalog.options(query)` or a page/iterator
  helper for consumers that genuinely need pagination.
- coffee-app: repoint the beans picker away from unparameterized `/api/catalog`
  and toward that projection.

Keep page/limit for list views for now. Cursor/keyset pagination can be added
later if bulk agent/SDK iteration needs stable traversal over a changing catalog.

### Chat quality triage

The Span A/B catalog-route migration has not reached chat. `/api/chat` still
builds tools from `$lib/services/tools` and reads catalog data through the
coffee-app data/tool layer directly, not through the proxied `/v1/catalog` or
`/api/catalog` routes changed in B1. If chat feels weak, treat it as a separate
legacy quality issue rather than migration fallout.

Useful future triage angles:

- tool selection misses (`coffee_catalog_search` vs `find_similar_beans` vs price
  index/procurement tools)
- stale or overly broad prompt/tool descriptions
- result-shaping problems inside `$lib/services/tools/catalogTools.ts`
- latency/fallback issues in the chat route itself

## Credential model (already solved)

`createParchmentServerClient(event, { mode: 'session' })` forwards the incoming
`Authorization` header token (bearer JWT **or** API key) to Parchment with the
same precedence as the auth hook (Authorization header wins over cookie). That is
exactly what these external routes need: forward the caller's presented
credential straight through. No new credential plumbing required for the proxy;
Parchment enforces authorization against the unified principal model.

`/api/catalog-api` is API-key-gated via `requireApiKeyAccess`. The proxy keeps
that gate in front (fail fast locally on missing/invalid key) and forwards the
same key onward, preserving current 401/403 behavior.

## Slices

### B1 — Catalog listing group proxy + duplicate-logic deletion ← first PR

Repo: coffee-app. This is the coherent, independently-mergeable unit: it removes
the catalog duplication entirely rather than half-migrating it.

Deliverables:

- Repoint all four catalog-listing routes to proxy Parchment via
  `createParchmentServerClient(event, { mode: 'session' })`:
  - `/v1/catalog` → `client.catalog.list(query)`
  - `/v1/catalog/proof-coverage` → `client.catalog.proofCoverage()`
  - `/api/catalog-api` → `client.catalog.list(query)` behind the existing
    API-key gate, preserving Deprecation/Sunset headers
  - `/api/catalog` → `client.catalog.list(query)` (legacy-app projection wrapper
    kept only if it is presentation-shaping, not proprietary logic)
- Forward query params through to the SDK; do not re-implement filtering/sort/
  projection locally.
- Add/confirm Deprecation + `Link: rel="successor-version"` + `Sunset` headers on
  the `/v1/catalog*` routes pointing at the canonical Parchment surface
  (`https://api.purveyors.io/v1/catalog`). `/api/catalog-api` already has them.
- Delete the now-unused catalog listing/proof-coverage functions from
  `catalogResource.ts` (`buildCanonicalCatalogResponse`,
  `buildCatalogProofCoverageResponse`, `buildLegacyAppCatalogResponse`, and any
  helpers that become dead). Keep `catalogResourceItem` mapping used by the page.
- Update/trim the route tests to assert proxy behavior (SDK called with the right
  query, caller credential forwarded, headers present) instead of local-query
  assertions.

Out of scope for B1 (explicit): `/v1/catalog/[id]/similar` (separate file,
member/paid gating + soft-timeout live-test handling), price-index, procurement.

Acceptance:

- `/v1/catalog`, `/v1/catalog/proof-coverage`, `/api/catalog-api`, `/api/catalog`
  return equivalent shapes, now sourced from Parchment.
- Caller credential (bearer/API key) is forwarded; anonymous/public behavior
  matches current gating (public fields for anon, member fields for session).
- `/api/catalog-api` still 401/403s without a valid API key.
- Deprecation/Sunset headers present on `/v1/catalog*`.
- No catalog listing query logic remains in `coffee-app` except proxy/presentation.
- `pnpm check` + affected route tests pass (or precisely env-labeled).

### B2 — `/v1/catalog/[id]/similar` proxy

Repo: coffee-app. Separate slice due to similarity gating + live-test soft-timeout
handling. Repoint to `client.catalog.similar(id, query)`, preserve member/paid
gating and timeout semantics, delete duplicate similarity server logic where safe.

### B3 — Price-index proxy

Repo: coffee-app. `/v1/price-index` → `client.priceIndex.list(query)`; delete
duplicate `priceIndexResource` logic where safe. (CLI repoint handled separately
per cutover plan C3.)

### B4 — Procurement briefs proxy

Repo: coffee-app. `/v1/procurement/briefs` + `[id]` + `matches` →
`client.procurement.briefs.*`; delete duplicate `sourcingBriefs` server logic
where safe. Note `sourcingBriefs.ts` currently imports `catalogResourceItem`;
confirm that mapping survives B1 (it does — only the response builders are
deleted, not the item mapper).

## Sequencing

B1 first (kills the biggest duplication and is fully parity-backed). B2–B4 follow
one route group per PR, each independently shippable and leaving all surfaces
working. This slots under the existing `docs/cutover-implementation-plan.md`
(parchment-api) Span C2 tail + C4 legacy tightening; this doc is the coffee-app
consumer-side execution detail.
