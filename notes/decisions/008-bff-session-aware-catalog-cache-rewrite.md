# ADR-008: BFF Session-Aware Catalog Cache-Header Rewrite (PADR-0015 Exception)

**Status:** Accepted
**Date:** 2026-07-05

> Companion note to **parchment-api PADR-0015** (the BFF verbatim-relay rule).
> PADR-0015 lives in the private parchment-api repo; this ADR records the one
> sanctioned coffee-app-side exception to its verbatim-relay rule. Implementation
> plan: `notes/implementation-plans/2026-07-05-bff-cache-header-rewrite-lane-b.md`.

## Context

PADR-0015 established that the coffee-app BFF (`/api/catalog*` proxy routes)
relays upstream Parchment response headers **verbatim** — the BFF is a thin
credential-attaching pass-through, not a place for business logic.

Parchment (PR5 Lane A) emits the authoritative catalog cache policy: anonymous
reads get `public, s-maxage=60, stale-while-revalidate=300` with
`Vary: Authorization`; authenticated reads get `private, no-store`. That contract
is correct **at the API**, where callers authenticate with a Bearer token.

The browser hop into the BFF primarily authenticates via **cookies**, so
Parchment's `Vary: Authorization` is not enough at this layer. The BFF also
accepts Bearer/API-key callers on catalog routes, so both credential channels
matter here: `Cookie` protects member sessions and `Authorization` protects
header-authenticated API callers. If the BFF relayed a `public, s-maxage` header
verbatim, or only varied on one local credential input, a shared cache in front of
coffee-app (Vercel) could store an anonymous catalog projection and then serve it
to an authenticated caller. Parchment has no shared cache in front of it (bare
Render Node service), so the BFF is the only place this shared cache can live,
and therefore the only place the leak can be closed.

## Decision

The BFF **re-derives** `Cache-Control` from its own session view instead of
relaying the upstream value for catalog reads. Single source of truth:
`src/lib/server/cacheHeaders.ts`, consumed by the current catalog BFF routes
(`/api/catalog`, `/api/catalog/filters`, and
`/api/catalog/origin-price-stats`).

- **Anonymous caller** → `public, s-maxage=60, stale-while-revalidate=300` plus
  `Vary: Cookie, Authorization` (so a shared cache keys on every credential
  input accepted by the BFF and cannot serve a public entry to an authenticated
  caller).
- **Any authenticated caller** (cookie session or API key) → `private, no-store`.
- **Every error / degraded response** → `private, no-store` (never shared-cacheable).

This is header translation only. No other business logic is added to the BFF; it
remains a credential-attaching relay in every other respect. This is the **one
sanctioned exception** to PADR-0015 verbatim relay.

## Consequences

**Positive**

- Closes the shared-cache member-data-leak on the cookie-authenticated hop.
- Perceptible catalog caching for anonymous traffic is preserved intact.
- Single-source-of-truth helper keeps the rule from drifting per-route; a
  member-leak regression gate (`cacheHeaders.test.ts`,
  `src/routes/api/catalog/*.test.ts`) fails closed if any route regresses.

**Negative / tradeoffs**

- One documented divergence from the "BFF relays verbatim" invariant. Mitigated
  by isolating it to Cache-Control in a single helper and this ADR.
- Authenticated callers get no shared-cache benefit by design (correct: their
  projection is member-scoped).

**Risks**

- Fail-open would be the leak, so the helper fails **closed**: anything other than
  an explicit anonymous caller is treated as private.
