# ADR-006: CLI-Owned Catalog Intelligence for Chat Tools

**Status:** Accepted
**Date:** 2026-06-11

## Context

Coffee-app chat tools had local implementations for generic catalog facets and ranking in `src/lib/services/marketTools.ts`. Those implementations duplicated logic that now exists in `@purveyors/cli` as of `v0.20.0`:

- `listCatalogFacets()` / `purvey catalog facets <field>`
- `rankCatalog()` / `purvey catalog rank`

Duplicating these algorithms inside coffee-app makes the app and CLI drift over time. It also violates the product direction that the CLI is a first-class agentic surface: CLI improvements should automatically improve app-side agent workflows when the behavior is generic and reusable.

At the same time, not everything in coffee-app chat tooling belongs in the CLI. The app still owns SvelteKit integration, chat-facing schemas, presentation transforms, app-specific caching, and tools that are intentionally tailored to the product UI or user flow.

## Decision

Generic catalog intelligence behavior is owned by `@purveyors/cli`.

Coffee-app consumes CLI library functions for reusable catalog intelligence and keeps only thin adapters where the chat surface needs different names or output shapes. Specifically:

- `catalog_facets` maps the chat-facing `stocked_only` input to the CLI `stockedOnly` contract and returns CLI-derived facet data plus explicit scope metadata.
- `catalog_rank` maps chat-facing snake_case filters to the CLI ranking contract and returns ranked catalog rows for existing chat/card presentation.
- `supplier_list` remains app-owned for now because it is an app-specific chat summary surface, not the same generic CLI catalog ranking/facet contract.

The app must not reimplement generic facet counting, objective ranking, Purveyor Score ordering, value ranking, fresh-arrival ordering, rare-origin ordering, or sample-scope semantics when those are available from the CLI package.

## Consequences

- CLI releases become the source of truth for generic catalog intelligence behavior used by chat agents.
- Coffee-app dependency bumps to `@purveyors/cli` can change chat tool behavior intentionally through one shared package instead of duplicated local algorithms.
- Coffee-app still owns the user-facing chat contract: Zod schemas for LLM ergonomics, snake_case field names, tool descriptions, model-output compaction, presentation blocks, and any UI-specific compatibility shape.
- App-owned tools may remain local when they aggregate or present data in a way that is specific to coffee-app user flows.
- Future reusable catalog intelligence should be added to `@purveyors/cli` first, then consumed by coffee-app through an adapter.
- Future coffee-app PRs touching catalog intelligence should state whether the change belongs to CLI-owned generic behavior or app-owned presentation/orchestration behavior.
