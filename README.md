# Purveyors web platform

Purveyors is the SvelteKit application powering [purveyors.io](https://purveyors.io): green coffee discovery, market analytics, inventory tracking, roast logging, sales tracking, and AI-assisted workflows.

**Live docs:** [purveyors.io/docs](https://purveyors.io/docs) | **API reference:** [purveyors.io/docs/api/overview](https://purveyors.io/docs/api/overview) | **CLI reference:** [purveyors.io/docs/cli/overview](https://purveyors.io/docs/cli/overview)

## What is this repo?

This repo contains:

- the public marketing site and blog
- the public catalog and analytics surfaces (browsable without login)
- the authenticated app: inventory, roast, profit, chat, and subscription workflows
- the Parchment Console for API keys, usage analytics, and billing
- the internal route layer that powers the first-party product
- the unified `/docs` tree for API and CLI documentation

It also depends on `@purveyors/cli`, which is a first-class interface to the same coffee domain model.

## Product surfaces

### Public

| Route        | Description                                                         |
| ------------ | ------------------------------------------------------------------- |
| `/`          | Marketing landing page                                              |
| `/catalog`   | Green coffee catalog with filters and live pricing                  |
| `/analytics` | Market intelligence: pricing trends, origin coverage, supplier data |
| `/api`       | API product page: plans, pricing, and quick start                   |
| `/docs`      | Unified documentation for API and CLI                               |
| `/blog`      | Coffee content and platform updates                                 |

### Authenticated

| Route            | Description                                         |
| ---------------- | --------------------------------------------------- |
| `/beans`         | Green coffee inventory management                   |
| `/roast`         | Roast profiles, Artisan imports, and chart analysis |
| `/profit`        | Sales and margin tracking                           |
| `/chat`          | AI workspace with tool results and action cards     |
| `/api-dashboard` | Parchment Console: API keys, usage, and billing     |
| `/subscription`  | Paid plan management                                |

## API layers

Purveyors ships two API layers:

1. **Public external API** (`/v1/catalog`)

   - Auth: Bearer API key, web session, or anonymous
   - Stable public contract for external integrations
   - [See API docs](https://purveyors.io/docs/api/overview)

2. **Internal app API** (`/api/*`)
   - Auth: Supabase web sessions, role checks, ownership checks
   - Powers the web app; not a broad public compatibility promise
   - `/api/catalog-api` is a deprecated legacy alias with Sunset: Dec 31 2026

Do not document the whole `/api/*` tree as a stable public contract. The public contract is the catalog feed at `/v1/catalog`, plus the Parchment Console and docs that support it.

## CLI relationship

This repo depends on `@purveyors/cli` and imports its domain logic in the app.

`src/lib/services/tools.ts` imports CLI modules directly for chat tool execution:

- `@purveyors/cli/catalog`
- `@purveyors/cli/inventory`
- `@purveyors/cli/roast`
- `@purveyors/cli/sales`
- `@purveyors/cli/tasting`

Improvements to the CLI automatically improve browser and AI chat workflows. The CLI is treated as a first-class platform, not a thin wrapper.

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
pnpm dev        # start dev server
pnpm build      # production build
pnpm preview    # preview production build
pnpm sync       # regenerate SvelteKit types
pnpm lint       # lint + format check
pnpm check      # TypeScript check (--fail-on-warnings in CI)
pnpm test       # run tests
```

## Repo map

```text
src/routes/                 SvelteKit routes and API handlers
src/lib/components/         Shared UI, analytics, layout, docs, and chat components
src/lib/data/               Shared data-layer helpers
src/lib/server/             Auth, API auth, Supabase, and server-only utilities
src/lib/services/           Chat tools, schema helpers, and cross-cutting services
src/lib/docs/               Docs navigation and content (source of truth for /docs)
static/                     Public assets
supabase/                   Supabase-related config and helpers
```

## Architecture notes

### Public catalog and analytics are core product surfaces

The repo is no longer just a logged-in roast tracker. Public catalog discovery and live analytics are central parts of the platform story. Keep README, API copy, and docs aligned with that reality.

### Internal routes should stay honest about scope

Many `/api/*` routes are important, but they are app routes, not public API promises. When documenting them, clearly label them as internal or session-auth.

### Prefer shared domain logic over duplicate behavior

The catalog, inventory, roast, sales, and tasting workflows span web app, CLI, and chat tooling. When the same workflow shows up in more than one interface, move the business logic into reusable modules instead of repeating it in route handlers.

## Validation

Before opening a PR, run:

```bash
pnpm lint
pnpm check --fail-on-warnings
```

## Contributing

For contributor and agent guidance, start with [`AGENTS.md`](./AGENTS.md). `CLAUDE.md` and `GEMINI.md` point to the same canonical guide.
