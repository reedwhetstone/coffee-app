# BFF Session-Aware Cache Header Rewrite (PR5 — Lane B, coffee-app)

**Status:** In progress
**Date:** 2026-07-05
**Parent plan:** `notes/implementation-plans/2026-07-04-catalog-shell-performance-headless-plan.md` (PR #428)
**Companion:** parchment-api Lane A — cache policy contract (`feat/catalog-cache-policy`)
**Branch:** `feat/bff-cache-header-rewrite` off `origin/main`

## Why this is the centerpiece

Lane A makes Parchment emit a correct cache contract, but Parchment has no cache in front of it
(bare Render Node service). The only place a shared cache can live is in front of coffee-app
(Vercel). PADR-0015's relay rule says the BFF relays upstream headers **verbatim** — which means a
`public, s-maxage` from Parchment would be relayed through a hop that authenticates via **cookies**,
where `Vary: Authorization` is meaningless. A shared cache in front of coffee-app could then serve the
cached anonymous projection to a logged-in member. This lane closes that leak and is where the
perceptible caching actually happens.

## Deliverable

### B1. Session-aware cache-header rewrite in the BFF proxy routes
Routes: `src/routes/api/catalog/+server.ts`, `src/routes/api/catalog/filters/+server.ts`,
`src/routes/api/catalog/origin-price-stats/+server.ts`, `src/routes/api/catalog-api/+server.ts`.

- If a **session cookie is present** on the incoming request → force
  `Cache-Control: private, no-store`, overriding the verbatim upstream relay.
- If **no session cookie** → pass through the upstream `public, s-maxage=60, stale-while-revalidate=300`.
- This is the one sanctioned exception to PADR-0015 verbatim relay. Document it in the PR body and add
  a one-line note to PADR-0015 so the BFF is not seen as drifting back into business logic.
- Prefer a shared helper (e.g. `src/lib/server/cacheHeaders.ts`) consumed by all four routes so the
  rule has a single source of truth.

### B2. Tests (the member-leak regression gate)
- Cookie-present request → response carries `private, no-store` regardless of the upstream header.
- Anonymous request (no session cookie) → relayed `public, s-maxage` header intact.
- Co-locate with existing `src/routes/api/catalog/catalog.test.ts` / `catalog-api.test.ts` patterns.

## Contract from Lane A (pin these exact strings)
- Public arm: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Private arm: `Cache-Control: private, no-store`
- Freshness envelope: `meta.freshness = { generatedAt, cacheStatus, ttlSeconds }` (relayed as-is).

## Validation
```bash
pnpm check --fail-on-warnings && pnpm lint && pnpm test -- --run src/routes/api/catalog && pnpm build
```

## Out of scope
- Any new business logic in the BFF beyond credential attachment + header rewrite.
- Actual Vercel cache configuration tuning (belongs to PR6 measurement).
