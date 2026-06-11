# ADR-006: CLI-Owned Portable Agent Tools, App-Owned Agent Scaffolding

**Status:** Accepted
**Date:** 2026-06-11

## Context

Purveyors has three related but distinct surfaces:

1. **API resources** — canonical `/v1/*` data contracts, authentication, rate limits, and backend query semantics.
2. **Portable agent tools** — reusable tool contracts that agents can call from multiple environments: the CLI, OpenClaw, coffee-app chat, local computer workflows, and future agent/tool surfaces.
3. **Web app scaffolding and presentation** — SvelteKit auth/session context, chat orchestration, model-output slimming, canvas/card rendering, confirmation flows, cache policy, and product UX.

Coffee-app previously carried local implementations for catalog intelligence tools in `src/lib/services/marketTools.ts`, including facets, supplier aggregates, and ranking. That made the web app a second source of truth for agent tool behavior. It also weakened the CLI strategy: if a tool only works inside coffee-app, it cannot be reused cleanly by terminal users, OpenClaw agents, local automation, or future external agent surfaces.

`@purveyors/cli` is the better owner for generic agent tools because it is already the portable interface over Purveyors data and APIs. Coffee-app should consume CLI library functions and adapt them to its chat runtime, not reimplement the tool semantics.

## Decision

`@purveyors/cli` owns portable agent tools. Coffee-app owns agent scaffolding and presentation.

For catalog intelligence, this means:

- `catalog_facets` delegates facet enumeration and scope metadata to `@purveyors/cli/catalog`.
- `supplier_list` delegates supplier aggregate semantics and filters to `@purveyors/cli/catalog`.
- `catalog_rank` delegates deterministic ranking objectives and sample semantics to `@purveyors/cli/catalog`.

Coffee-app may keep thin adapters where its chat runtime needs a different shape:

- snake_case LLM-facing input names mapped to CLI camelCase contracts
- Zod schemas and tool descriptions tuned for chat ergonomics
- process-wide or request-local cache policy
- model-output compaction via `toModelOutput`
- canvas/card payload preservation
- user/session/access context injection
- action-card proposal and confirmation flows

Coffee-app must not reimplement generic tool behavior when that behavior can be expressed as a portable CLI tool. If coffee-app needs a reusable agent operation that the CLI does not expose yet, the preferred move is to add it to `@purveyors/cli`, release the CLI, then consume it from coffee-app.

## Consequences

- CLI releases become the source of truth for reusable agent tool behavior.
- Coffee-app dependency bumps intentionally bring agent-tool improvements into chat without duplicating algorithms.
- OpenClaw and local computer workflows can use the same tool contracts as coffee-app chat.
- Coffee-app remains free to own the agent experience: routing, permissions, presentation, confirmation, and UI-specific compatibility.
- Future PRs touching agent tools should explicitly classify each change as either portable tool behavior (CLI-owned) or app scaffolding/presentation (coffee-app-owned).
- Write tools should follow the same split over time: operation semantics belong in the CLI; coffee-app owns proposal cards, confirmation, and UI-specific safety rails.
