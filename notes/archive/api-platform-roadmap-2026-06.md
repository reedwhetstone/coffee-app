# Purveyors API Platform Roadmap

**Tags:** #project #purveyors #api #architecture #documentation
**Related:** [[MOC-coffee-platform]]; [[ideas/purveyors-intelligence-first-chat-layer]]
**Created:** 2026-06-20

## Framing

Purveyors should move toward an API-first, headless platform architecture after the current schema migration work lands. The API should become the durable product substrate that serves the web app, CLI, chatbot, GenUI surfaces, and future abstracted clients.

The direction resembles the Amazon-style internal platform strategy: every meaningful product capability should be understandable, documentable, and operable through explicit APIs rather than being trapped inside a single frontend application.

## Desired Architecture

- Separate the backend/API layer from the coffee application UI so the web app becomes one client, not the architecture center.
- Evaluate whether the API should become its own repository or otherwise gain a clearly independent lifecycle from the SvelteKit frontend.
- Treat API contracts, services, auth, docs, and internal capability boundaries as first-class product infrastructure.
- Keep chatbot, CLI, web app, and future surfaces on shared API primitives instead of duplicating backend access patterns.

## Infrastructure Focus

- Revisit OAuth and auth flows for decoupled clients, especially where the current frontend/backend coupling may hide assumptions.
- Build excellent API documentation as infrastructure, not afterthought copy.
- Explore Swagger/OpenAPI generation and other code-backed documentation approaches.
- Organize internal services and platform capabilities into clear API categories with durable reference material.
- Make the codebase itself easier to understand through API boundaries, generated reference docs, and service-level documentation.

## Open Questions

- Should the API move to a separate repo, or should the first step be a stricter package/module boundary inside `coffee-app`?
- What OAuth model best supports web, CLI, chatbot, and future client surfaces without tying auth semantics to the web UI?
- Which docs should be generated from code, and which should remain hand-authored product/developer guidance?
- What minimum API contract should exist before the frontend is treated as an independent consumer?

## Next Actions

1. Finish or stabilize the current schema migration work.
2. Audit existing ADRs and code paths that already assume API-backed abstracted surfaces.
3. Draft a concrete API extraction plan in the owning product repo before implementation.
4. Define documentation standards: OpenAPI/Swagger, examples, service categories, auth flows, and client onboarding.

## Update 2026-06-28: Direction resolved

The open questions below are resolved by the full extraction blueprint: [[parchment-api-extraction-spec]]. Headlines:

- **Repo topology:** private `parchment-api` (proprietary implementation) + public `coffee-app` as a reference/model-home client. Moat line is implementation + private Supabase data, not the contract.
- **Runtime:** long-running Node server (Hono), not Cloudflare Workers, because the AI-first streaming/agent surface needs persistent execution.
- **Contract:** dual OpenAPI + MCP, both generated from shared zod schemas; `@purveyors/sdk` published public; tools-as-endpoints capability registry.
- **Auth:** lift the existing unified `principal.ts` model; Supabase stays source of truth; web app uses a thin BFF for cookie-to-Bearer.
- **Docs:** served from the API at `/docs`, public at `docs.purveyors.io`.
- **Cutover:** strangler-fig per route group; `/v1` is the seam; `coffee-scraper` ingest unchanged.
