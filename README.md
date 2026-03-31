# Purveyors web platform

Purveyors is a SvelteKit application for green coffee discovery, market analytics, inventory tracking, roast logging, sales tracking, and AI-assisted workflows.

This repo contains the web app, the public catalog and analytics surfaces, the Parchment Console, and the internal route layer that powers the first-party product. It also depends on `@purveyors/cli`, which is treated as a first-class interface to the same domain model.

## Current product surface

### Public surfaces

- `/` marketing site and authenticated home dashboard
- `/catalog` public green coffee catalog with filters and live pricing context
- `/analytics` public market intelligence, with deeper views for authenticated users and premium analytics access
- `/api` API product page
- `/docs` unified documentation for API and CLI workflows
- `/blog` public content

### Authenticated app surfaces

- `/beans` green coffee inventory
- `/roast` roast profiles, charting, Artisan imports, and roast analysis helpers
- `/profit` sales and margin tracking
- `/chat` AI workspace with canvas-style tool results and action cards
- `/api-dashboard` Parchment Console for API keys, usage analytics, and docs access
- `/subscription` paid plan management

### API layers

Purveyors ships two API layers:

1. **Public external API**

   - `GET /v1/catalog`
   - Auth: Bearer API key
   - Purpose: normalized public catalog feed for external integrations

2. **Internal app API**
   - `/api/catalog`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/stripe/*`, and related helpers
   - Auth: Supabase web sessions, role checks, and ownership checks
   - Purpose: first-party web app behavior

Do not document the whole `/api/*` tree as a stable public contract. The public contract today is the catalog feed plus the Parchment Console and docs that support it.

## Documentation entry points

- Public docs home: `/docs`
- API docs: `/docs/api/overview`
- CLI docs: `/docs/cli/overview`
- Parchment Console: `/api-dashboard`
- API product page: `/api`

## CLI relationship

This repo depends on `@purveyors/cli` and reuses its domain logic in the app.

Notably, `src/lib/services/tools.ts` imports CLI modules directly for chat tooling:

- `@purveyors/cli/catalog`
- `@purveyors/cli/inventory`
- `@purveyors/cli/roast`
- `@purveyors/cli/sales`
- `@purveyors/cli/tasting`

That shared contract matters. Improvements in the CLI can improve browser workflows and AI workflows at the same time.

## Tech stack

- **Framework:** SvelteKit 5 + TypeScript
- **Styling:** Tailwind CSS
- **Data:** Supabase
- **Auth:** Supabase Auth
- **Payments:** Stripe
- **AI:** OpenRouter via Vercel AI SDK
- **Charts:** LayerCake and custom analytics components
- **Terminal interface:** `@purveyors/cli`

## Local development

```bash
pnpm install
pnpm dev
```

### Core commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm sync
pnpm lint
pnpm check
pnpm test
```

## Repo map

```text
src/routes/                 SvelteKit routes and API handlers
src/lib/components/         Shared UI, analytics, layout, and chat components
src/lib/data/               Shared data-layer helpers
src/lib/server/             Auth, API auth, Supabase, and server-only utilities
src/lib/services/           Chat tools, schema helpers, and cross-cutting services
src/lib/docs/               Docs navigation and content source for /docs
static/                     Public assets
supabase/                   Supabase-related config and helpers
```

## Architecture notes

### Public catalog and analytics are core product surfaces

The repo is no longer just a logged-in roast tracker. Public catalog discovery and live analytics are central parts of the platform story. Keep README, API copy, and docs aligned with that reality.

### Internal routes should stay honest about scope

Many `/api/*` routes are important, but they are app routes, not public API promises. When documenting them, clearly label them as internal or session-auth.

### Prefer shared domain logic over duplicate behavior

The catalog, inventory, roast, sales, and tasting workflows now span web app, CLI, and chat tooling. When the same workflow shows up in more than one interface, move the business logic into reusable modules instead of repeating it in route handlers.

## Validation

Before opening a PR, run:

```bash
pnpm lint
pnpm check --fail-on-warnings
```

## Contributing

For contributor and agent guidance, start with [`AGENTS.md`](./AGENTS.md). `CLAUDE.md` and `GEMINI.md` point to the same canonical guide.
