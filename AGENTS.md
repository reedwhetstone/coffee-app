# AGENTS.md

This is the canonical contributor and coding-agent guide for the Purveyors web platform repo.

`CLAUDE.md` and `GEMINI.md` should remain symlinks to this file.

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

   - `GET /api/catalog-api`
   - Bearer API key auth
   - Stable public contract

2. **Internal app API**
   - `/api/catalog`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/stripe/*`, and related helpers
   - Session auth, role checks, ownership checks
   - Important for contributors, but not a broad public compatibility promise

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
- Prefer shared docs data/components over duplicated long-form pages
- Keep public docs accessible without login

### Accuracy rules

- Verify behavior from source before documenting it
- Do not claim an endpoint is public unless it truly is
- Do not invent filter/query behavior that the route does not implement
- Be explicit about auth model, tier limits, and session requirements
- If analytics are a product surface but not a public REST surface, say that clearly

## CLI relationship

The web app imports `@purveyors/cli` modules directly in `src/lib/services/tools.ts`.

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
