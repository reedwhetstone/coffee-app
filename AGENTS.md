# AGENTS.md

This is the canonical contributor and coding-agent guide for the Purveyors web platform repo.

`CLAUDE.md` and `GEMINI.md` should remain lightweight pointers or symlinks to this file.

## Repo purpose

This repo is the Purveyors web platform. It includes:

- the public marketing site
- the public catalog and analytics surfaces
- the authenticated app for inventory, roast, profit, chat, and subscription workflows
- the Parchment Console for keys and usage
- the internal route layer that powers the first-party product
- the unified `/docs` tree for API and CLI documentation

It also depends on `@purveyors/cli`, which is a first-class interface to the same coffee domain.

## Stack

- SvelteKit 5
- TypeScript
- Tailwind CSS
- Supabase
- Stripe
- OpenRouter via Vercel AI SDK
- `@purveyors/cli`
- LayerCake (charts and analytics components)

## Commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm sync
pnpm lint
pnpm check
pnpm test
```

Required validation for repo changes unless explicitly waived:

```bash
pnpm lint
pnpm check --fail-on-warnings
```

## Route model

### Public product routes

- `/`
- `/catalog`
- `/analytics`
- `/api`
- `/docs`
- `/blog`

### Authenticated product routes

- `/beans`
- `/roast`
- `/profit`
- `/chat`
- `/api-dashboard`
- `/subscription`

### API model

Treat the API as two layers:

1. **Public external API**

   - `GET /v1` advertises the public namespace
   - `GET /v1/catalog`
   - Auth: API key, web session, or anonymous (public-only subset unless a privileged session enables wholesale visibility)
   - Rate-limit headers (`X-RateLimit-*`) are only included in API-key responses
   - Stable public contract

2. **Platform app API**
   - `/api/catalog`, `/api/catalog/filters`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/stripe/*`, `/api/admin/*`, and related helpers
   - Mixed auth model depending on route: some catalog adapters allow anonymous or API-key access, most product routes require session auth, and chat/workspace routes require the member role
   - Important for contributors, but not a broad public compatibility promise
   - `/api/catalog-api` is a deprecated legacy URL with `Deprecation: true` and `Sunset: Dec 31 2026` headers; migrate to `/v1/catalog`
   - `/api/tools/*` routes are deprecated; prefer direct CLI-library integration

Do not blur those layers in code comments, docs, or PR descriptions.

## Documentation rules

When changing docs, keep these sources aligned:

- `README.md`
- `AGENTS.md`
- `src/routes/api/+page.svelte`
- the `/docs` tree under `src/routes/docs`
- the `/api-dashboard` console surface and any legacy docs redirects

### Docs architecture

- Public docs live under `/docs`
- API docs live under `/docs/api/*`
- CLI docs live under `/docs/cli/*`
- `src/lib/docs/content.ts` is the shared source of truth for docs IA and long-form content
- Prefer shared docs data/components over duplicated long-form pages
- Keep public docs accessible without login

### Accuracy rules

- Verify behavior from source before documenting it
- Do not claim an endpoint is public unless it truly is
- Do not describe `/api/catalog` or `/api/catalog-api` as the canonical contract; that is `/v1/catalog`
- Do not flatten CLI auth into one rule: catalog commands require an authenticated viewer session; inventory, roast, sales, and tasting require the member role; config is local-only and does not require auth; context is documentation/manifest output, not a live authenticated data command; `purvey context` prints text by default, `--json` and `--pretty` emit the machine-readable manifest contract, and `--csv` is invalid
- Do not invent filter/query behavior that the route does not implement
- Be explicit about auth model, tier limits, row-limit headers, share-token behavior, and session requirements
- If analytics are a product surface but not a public REST surface, say that clearly

## CLI relationship

The web app imports `@purveyors/cli` modules directly in `src/lib/services/tools.ts`.

CLI auth and output rules matter here too:

- `purvey catalog *` requires an authenticated viewer session
- `purvey inventory`, `roast`, `sales`, and `tasting` require the member role
- `purvey config` is local-only and does not require auth
- `purvey context` prints dense text by default, while `purvey manifest` emits the machine-readable contract directly
- structured stdout and stderr semantics are part of the CLI contract for scripts and agents

That means:

- CLI docs matter to this repo
- chat-tool behavior should stay aligned with CLI behavior
- shared business logic should move toward reusable modules, not duplicated route code

Deprecated `/api/tools/*` routes still exist for compatibility. Prefer direct CLI-library integration for new work.

## Svelte and UI guidance

- Use Svelte 5 patterns already established in the repo
- Keep public docs and marketing pages coherent with the public nav
- Favor maintainable shared components over one-off static pages when multiple docs pages need the same layout
- Keep changes tightly scoped to the problem at hand; avoid unrelated product edits in docs or contributor PRs

## Auth and data safety

- Preserve role checks and ownership checks on member data routes
- Do not weaken API-key validation, rate limiting, or Parchment Console key-management flows in doc-focused changes
- Do not expose secrets, raw API keys, or private user data in docs, examples, screenshots, or tests

## Good contribution patterns

- Keep route handlers thin when possible; move reusable logic into `src/lib/data`, `src/lib/server`, or `src/lib/services`
- Prefer one source of truth for shared field definitions and workflow behavior
- Cross-link product surfaces when they describe the same domain concept, especially API, CLI, chat, and analytics
- If a route is internal-only, say so in comments and docs

## PR expectations

A strong PR in this repo should include:

- a clear statement of which product surface changed
- validation output or a note explaining why validation could not run
- updated docs when behavior, routes, or positioning changed
- screenshots for UI changes when useful

If the change touches public positioning, docs, or API expectations, review the whole information architecture, not just the line you edited.
