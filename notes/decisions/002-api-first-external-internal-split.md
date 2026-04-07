# ADR-002: External/Internal API Split and Migration to /v1/catalog

**Status:** Accepted
**Date:** 2026-01-15 (approximate)

## Context

Purveyors.io serves two distinct consumers of catalog data:

1. **Internal app** — SvelteKit server load functions fetching data for authenticated
   page renders (roaster's personal dashboard, inventory, analytics).
2. **External API customers** — third-party developers and the CLI using Bearer-token
   authenticated API access with tier-based rate limits and row caps.

The original design split these into separate route handlers:
- `/api/catalog/` — internal, session-authenticated
- `/api/catalog-api/` — external, API-key-authenticated, with tier enforcement

This worked initially but created duplicated query logic and made it hard to guarantee
that external and internal consumers saw the same data shape and business rules.

## Decision

Migrate both consumers to a single canonical resource: `GET /v1/catalog`.

The canonical handler (`src/lib/server/catalogResource.ts`) handles both cases by
inspecting the incoming event's authentication context. `/api/catalog-api/` is kept
alive as a **delegating alias** that calls the canonical handler and adds
`Deprecation: true` and `Sunset: 2026-12-31` headers so existing integrations
continue working while callers migrate.

A 308 redirect was tested but rejected: `adapter-vercel` silently converts 3xx
redirects to HTTP 200 with empty bodies for same-origin fetch calls. Delegation
(calling the handler directly) is the only reliable approach under this adapter.

## Consequences

- One place to change query logic, field selection, and auth rules.
- External callers using `/api/catalog-api/` still get data; no immediate breakage.
- Sunset header gives integrations a clear migration deadline (end of 2026).
- Future: once all known callers have migrated, `/api/catalog-api/` can be deleted.
- Any new catalog-adjacent endpoints should be built under `/v1/` from the start.
