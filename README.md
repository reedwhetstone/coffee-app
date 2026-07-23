# Purveyors web platform

Purveyors is the SvelteKit application powering [purveyors.io](https://purveyors.io): green coffee discovery, market analytics, inventory tracking, roast logging, sales tracking, and AI-assisted workflows.

**Live docs:** [purveyors.io/docs](https://purveyors.io/docs) | **API reference:** [api.purveyors.io/docs](https://api.purveyors.io/docs) | **CLI reference:** [purveyors.io/docs/cli/overview](https://purveyors.io/docs/cli/overview)

## What is this repo?

This repo contains:

- the public marketing site and blog
- the public catalog and analytics surfaces (browsable without login)
- the authenticated app: inventory, roast, profit, chat, and subscription workflows
- the Parchment Console for API keys, usage analytics, and billing
- the internal route layer that powers the first-party product
- the `/docs` tree for product and CLI guidance; the generated API reference lives at `api.purveyors.io/docs`

Its server-side agent tools consume the Parchment API through `@purveyors/sdk`; the CLI is a separate first-class client of the same contracts.

## Product surfaces

### Public

| Route        | Description                                                                           |
| ------------ | ------------------------------------------------------------------------------------- |
| `/`          | Marketing landing page                                                                |
| `/catalog`   | Green coffee catalog with filters and live pricing                                    |
| `/analytics` | Market intelligence: public overview charts plus gated Parchment Intelligence modules |
| `/api`       | API product page: plans, pricing, and quick start                                     |
| `/docs`      | Unified documentation for API and CLI                                                 |
| `/blog`      | Coffee content and platform updates                                                   |

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

Purveyors ships the web app and the external Parchment API as separate HTTP surfaces:

1. **Public external API** (`https://api.purveyors.io/v1/*`)

   - `GET https://api.purveyors.io/` advertises the service, docs, health, and OpenAPI resources
   - `GET https://api.purveyors.io/v1/catalog` is the stable public contract for external integrations
   - `GET https://api.purveyors.io/v1/catalog/{id}/similar` is a beta catalog matching endpoint for member sessions or API keys with API Origin or Enterprise plus `catalog:read`
   - `GET https://api.purveyors.io/v1/price-index` exposes aggregate `price_index_snapshots` for API keys with Parchment Intelligence access
   - Parchment catalog, owner, and entitled data endpoints require a Bearer credential. Public website catalog pages use a server-held demo key through the coffee-app BFF; deliberately designated Market Index teaser slices remain anonymous
   - Full catalog responses include structured process transparency fields and `process.evidence_available`, but not raw evidence quotes
   - API-key routes emit rate-limit headers according to the resolved plan
   - [See API docs](https://api.purveyors.io/docs)

2. **Platform app API** (`/api/*`)
   - Powers the first-party web app, Console, billing, chat, and admin workflows
   - Mixed auth model depending on route: catalog BFF adapters can allow anonymous or session access, most product routes require session auth, and chat/workspace routes require either Mallard Studio membership or Parchment Intelligence access
   - `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate` are session-authenticated Console control-plane routes, not public API contracts
   - `/api/docs` and `/api-dashboard/docs` are legacy docs entry points that redirect to `https://api.purveyors.io/docs`
   - `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, and `/.well-known/appspecific/com.chrome.devtools.json` are metadata or compatibility endpoints, not catalog or analytics APIs
   - `/auth/callback` is the web OAuth handoff surface; `/auth/cli` is the signed-in browser consent surface for CLI authorization requests. Neither is a REST resource
   - `/api/tools/*` routes are deprecated compatibility shims; prefer session-mode Parchment SDK integration for new work

Do not document the whole coffee-app `/api/*` tree as a stable public contract. The stable public catalog feed is `https://api.purveyors.io/v1/catalog`; `https://api.purveyors.io/v1/catalog/{id}/similar` is beta and access-gated; `https://api.purveyors.io/v1/price-index` is aggregate-only and entitlement-gated. The broader coffee-app `/api/*` tree should be described as platform/internal routes with explicit auth and stability labels.

## CLI relationship

This repo does not depend on the CLI package. Coffee-app and the CLI independently consume the canonical Parchment API contracts.

CLI auth and output rules are part of the platform contract:

- `purvey auth login` uses browser OAuth once to mint and store a scoped Parchment API key; it does not retain session access or refresh tokens
- `purvey catalog search`, `get`, and `stats` require a Parchment API key with `catalog:read`; structured process filters require member access, and `purvey catalog similar <id>` additionally requires a member-owned key or an API Origin/Enterprise key
- `purvey inventory`, `roast`, `sales`, and `tasting` require a member-owned API key with the matching scopes
- `purvey config`, `purvey context`, and `purvey manifest` do not require auth
- `purvey manifest` is the preferred stable machine-readable contract for shells and agents
- `purvey context` is the shipped dense agent reference; `purvey context --json` and `--pretty` emit manifest-parity output for compatibility
- stdout stays structured for automation, while operational and fatal messaging is designed to stay on stderr

Coffee-app's server-side chat tools adapt session-authenticated `@purveyors/sdk` clients to chat schemas. Shared behavior belongs behind Parchment endpoints so browser, CLI, and agent consumers stay aligned without importing one another's runtime.

## Tech stack

- **Framework:** SvelteKit 2 + Svelte 5 + TypeScript
- **Styling:** Tailwind CSS
- **Data:** Parchment API through `@purveyors/sdk`, plus remaining direct Supabase paths documented in `notes/ARCHITECTURE.md`
- **Auth:** Supabase Auth
- **Payments:** Stripe
- **AI:** OpenRouter via Vercel AI SDK; Qwen3 embeddings via OpenRouter
- **Charts:** LayerCake, D3.js, and custom analytics components
- **Terminal interface:** `@purveyors/cli`

## Local development

```bash
pnpm install
pnpm dev
```

### Core commands

```bash
pnpm dev                           # start dev server
pnpm build                         # production build
pnpm preview                       # preview production build
pnpm sync                          # regenerate SvelteKit types
pnpm lint                          # lint + format check
pnpm check --fail-on-warnings      # Svelte + TypeScript check
pnpm test                          # run unit tests
pnpm verify:catalog-http-contract  # verify the public catalog HTTP contract
pnpm audit:discoverability         # audit public SEO and discoverability metadata
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
- `/api/chat` and `/api/workspaces` require a session with Mallard Studio membership or Parchment Intelligence access
- `/api/stripe/*` and `/api/admin/*` are operational routes, not external product APIs

### Prefer shared domain logic over duplicate behavior

The catalog, inventory, roast, sales, and tasting workflows span web app, CLI, and chat tooling. When the same workflow shows up in more than one interface, move the business logic into reusable modules instead of repeating it in route handlers.

### The SDK is the shared client boundary

Coffee-app does not import CLI functions. The SDK is generated from Parchment's OpenAPI contract and provides typed HTTP clients for both coffee-app and the CLI. It does not depend on the CLI. See [`notes/ARCHITECTURE.md`](notes/ARCHITECTURE.md) for the verified current boundary and the remaining direct-Supabase migration debt.

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
pnpm worktree:bootstrap   # copy example env files into a fresh worktree and print required keys
pnpm env:check            # verify static validation env values
pnpm env:check:e2e        # verify E2E-specific env values
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
