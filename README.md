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

1. **Public external API** (`/v1/*`)

   - `GET /v1` advertises the public namespace, resource map, and legacy migration hints
   - `GET /v1/catalog` is the stable public contract for external integrations
   - Auth: Bearer API key, web session, or anonymous
   - Rate-limit headers are only emitted on API-key requests
   - [See API docs](https://purveyors.io/docs/api/overview)

2. **Platform app API** (`/api/*`)
   - Powers the first-party web app, Console, billing, chat, and admin workflows
   - Mixed auth model depending on route: some catalog adapters allow anonymous or API-key access, most product routes require session auth, and chat/workspace routes require the member role
   - `/api/catalog-api` is a deprecated API-key-only alias to `/v1/catalog` with `Deprecation`, `Link`, and `Sunset: Dec 31 2026` headers
   - `/api/tools/*` routes are deprecated compatibility shims; prefer shared CLI-library integration for new work

Do not document the whole `/api/*` tree as a stable public contract. The public contract is the catalog feed at `/v1/catalog`; the broader `/api/*` tree should be described as platform/internal routes with explicit auth and stability labels.

## CLI relationship

This repo depends on `@purveyors/cli` and imports its domain logic in the app.

CLI auth and output rules are part of the platform contract:

- `purvey catalog *` requires an authenticated viewer session
- `purvey inventory`, `roast`, `sales`, and `tasting` require the member role
- `purvey config` is local-only and does not require auth
- `purvey context` is documentation/manifest output, not a live authenticated data command
- `purvey context` prints dense reference text by default; `--json` and `--pretty` emit the same machine-readable manifest contract as `purvey manifest`; `--csv` is invalid
- `purvey manifest` is the preferred machine-readable contract
- stdout stays structured for automation, while operational and fatal messaging is designed to stay on stderr

`src/lib/services/tools.ts` imports CLI modules directly for chat tool execution:

- `@purveyors/cli/catalog`
- `@purveyors/cli/inventory`
- `@purveyors/cli/roast`
- `@purveyors/cli/sales`
- `@purveyors/cli/tasting`

Improvements to the CLI automatically improve browser and AI chat workflows. The CLI is treated as a first-class platform, not a thin wrapper.

## Tech stack

- **Framework:** SvelteKit 2 + Svelte 5 + TypeScript
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

### Worktree-friendly local validation

`pnpm check` and `pnpm test` expect repo-local environment files when you run the app from a fresh worktree. Before validating in a new checkout:

```bash
cp .env.example .env
cp .env.test.example .env.test
```

Then fill in the required Supabase and test-account values. The Playwright and Vitest setup load `.env` and `.env.test` from the current repo root, so copying these files into each worktree avoids missing-export and wrong-path failures.

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

The repo is no longer just a logged-in roast tracker. Public catalog discovery and live analytics are central parts of the platform story. Keep README, `/api`, `/docs`, `/api-dashboard`, and product copy aligned with that reality.

### Internal routes should stay honest about scope

Many `/api/*` routes are important, but they are platform routes, not broad public API promises. When documenting them, call out the exact auth model and stability level. Examples:

- `/api/catalog` is a legacy app adapter, not the canonical public contract
- `/api/catalog/filters` is a public-facing UI helper, not an integration endpoint
- `/api/beans` GET supports share-token reads, while writes require session auth
- `/api/chat` and `/api/workspaces` require a member session
- `/api/stripe/*` and `/api/admin/*` are operational routes, not external product APIs

### Prefer shared domain logic over duplicate behavior

The catalog, inventory, roast, sales, and tasting workflows span web app, CLI, and chat tooling. When the same workflow shows up in more than one interface, move the business logic into reusable modules instead of repeating it in route handlers.

## Validation

Before opening a PR, run:

```bash
pnpm lint
pnpm check --fail-on-warnings
```

### Local validation env contract

Fresh worktrees can fail local validation before any code issue is proven. In this repo, treat missing required env values as `VALIDATION_BLOCKED_ENV`, not `VALIDATION_FAIL`.

Validation command classes:

- `pnpm lint`
- `pnpm check --fail-on-warnings`
- `pnpm test`
- `pnpm test:e2e`

For static validation (`pnpm check --fail-on-warnings`), provide these repo-local env vars because the app imports SvelteKit static env modules:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

For E2E (`pnpm test:e2e`), also provide:

- `E2E_TEST_EMAIL`
- `E2E_TEST_USER_ID`
- `PLAYWRIGHT_BASE_URL` (optional, defaults to localhost)

Helpful commands:

```bash
pnpm worktree:bootstrap
pnpm env:check
pnpm env:check:e2e
```

Notes:

- Placeholder values may be enough to unblock static validation, but they do not guarantee runtime behavior or E2E fidelity.
- The bootstrap helper only explains and copies repo example files. It does not pull secrets from outside the repo.
- This improves env-contract clarity only. Detached-worktree module-resolution or stale temp-path install failures are a separate issue.

When reporting validation status, use one of:

- `VALIDATION_PASS`
- `VALIDATION_FAIL`
- `VALIDATION_BLOCKED_ENV`
- `VALIDATION_BLOCKED_SERVICE`
- `VALIDATION_CI_PENDING`

## Contributing

For contributor and agent guidance, start with [`AGENTS.md`](./AGENTS.md). `CLAUDE.md` and `GEMINI.md` point to the same canonical guide.
