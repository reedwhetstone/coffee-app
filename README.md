# Purveyors web platform

Purveyors is the SvelteKit application powering [purveyors.io](https://purveyors.io): green coffee discovery, market analytics, inventory tracking, roast logging, sales tracking, and Cherry AI workflows.

**Live docs:** [purveyors.io/docs](https://purveyors.io/docs) | **API reference:** [api.purveyors.io/docs](https://api.purveyors.io/docs) | **CLI reference:** [purveyors.io/docs/cli/overview](https://purveyors.io/docs/cli/overview)

## What is this repo?

This repo contains:

- the public marketing site and blog
- the public catalog and analytics surfaces (browsable without login)
- the authenticated app: account, inventory, roast, profit, Cherry AI, and subscription workflows
- the Parchment Console for API keys, usage analytics, and billing
- the internal route layer that powers the first-party product
- the `/docs` tree for product and CLI guidance; the generated API reference lives at `api.purveyors.io/docs`

Cherry Runtime's server-side tools consume the Parchment API through `@purveyors/sdk`; the CLI is a separate first-class client of the same contracts.

## Product surfaces

### Public

| Route        | Description                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ |
| `/`          | Marketing landing page                                                                     |
| `/catalog`   | Green coffee catalog with filters and live pricing                                         |
| `/analytics` | Market intelligence: public overview charts plus gated Parchment Intelligence modules      |
| `/evals`     | Cherry Evals: domain benchmarks for green coffee, sensory analysis, sourcing, and roasting |
| `/api`       | API product page: plans, pricing, and quick start                                          |
| `/docs`      | Unified documentation for API and CLI                                                      |
| `/blog`      | Coffee content and platform updates                                                        |
| `/bot`       | PurveyorsBot crawler identity, request policy, and operator contact                        |

### Authenticated

| Route            | Description                                         |
| ---------------- | --------------------------------------------------- |
| `/beans`         | Green coffee inventory management                   |
| `/roast`         | Roast profiles, Artisan imports, and chart analysis |
| `/profit`        | Sales and margin tracking                           |
| `/chat`          | Cherry AI workspace with evidence and action cards  |
| `/api-dashboard` | Parchment Console: API keys, usage, and billing     |
| `/account`       | Account settings and self-service deletion          |
| `/subscription`  | Paid plan management                                |

## API layers

Purveyors ships the web app and the external Parchment API as separate HTTP surfaces:

1. **Public external API** (`https://api.purveyors.io/v1/*`)

   - `GET https://api.purveyors.io/` advertises the service, docs, health, and OpenAPI resources
   - `GET https://api.purveyors.io/v1/catalog` is the stable public contract for external integrations
   - `GET https://api.purveyors.io/v1/catalog/map` returns authorized clusters, canonical place features, explicit placed/unplaced totals, and elevation profiles over the same caller-visible catalog scope
   - `GET https://api.purveyors.io/v1/catalog/{id}/similar` is a beta catalog matching endpoint for member sessions or API keys on any API plan with `catalog:read`
   - `GET https://api.purveyors.io/v1/price-index` exposes aggregate `price_index_snapshots` for entitled first-party sessions and customer API keys with Parchment Intelligence access
   - Parchment catalog, owner, and entitled data endpoints require a Bearer credential. Public website catalog pages use a server-held demo key through the coffee-app BFF; deliberately designated Market Index teaser slices remain anonymous
   - Full catalog responses include structured process transparency fields and `process.evidence_available`, but not raw evidence quotes
   - Green, Origin, and Enterprise API keys share public-data capabilities. Green includes 200 requests per account per UTC calendar month and up to 25 items per read collection response; aggregates and atomic batch receipts keep their documented endpoint bounds, while scopes, owner binding, and Parchment Intelligence entitlements remain independent
   - API-key routes emit account quota and burst headers according to the resolved plan
   - [See API docs](https://api.purveyors.io/docs)

2. **Platform app API** (`/api/*`)
   - Powers the first-party web app, Console, billing, chat, and admin workflows
   - Mixed auth model depending on route: catalog BFF adapters can allow anonymous or session access, most product routes require session auth, and chat/workspace routes require either Mallard Studio membership or Parchment Intelligence access
   - `/api/billing/*`, `/api/account-deletion`, and `/api/account-deletion/reauthenticate` are browser-session-only internal BFF routes. Coffee-app forwards typed requests through `@purveyors/sdk`; Parchment owns Checkout, subscriptions, entitlements, and the provider-before-local-before-Auth deletion saga. They never form part of the external Parchment API
   - `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate` are session-authenticated Console control-plane routes, not public API contracts
   - `/api/docs` and `/api-dashboard/docs` are legacy docs entry points that redirect to `https://api.purveyors.io/docs`
   - `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, and `/.well-known/appspecific/com.chrome.devtools.json` are metadata or compatibility endpoints, not catalog or analytics APIs
   - `/auth/callback` is the web OAuth handoff surface; `/auth/cli` is the signed-in browser consent surface for CLI authorization requests. Neither is a REST resource
   - `/api/tools/*` routes are deprecated compatibility shims; prefer session-mode Parchment SDK integration for new work

Do not document the whole coffee-app `/api/*` tree as a stable public contract. The stable public catalog family is `https://api.purveyors.io/v1/catalog` and its authorized `/map` projection; `https://api.purveyors.io/v1/catalog/{id}/similar` is beta and access-gated; `https://api.purveyors.io/v1/price-index` is aggregate-only and entitlement-gated. The broader coffee-app `/api/*` tree should be described as platform/internal routes with explicit auth and stability labels. There is no public coffee-app `/api/catalog/map` route yet; direct integrations use Parchment and keep Bearer credentials server-side.

## CLI relationship

This repo does not depend on the CLI package. Coffee-app and the CLI independently consume the canonical Parchment API contracts.

CLI auth and output rules are part of the platform contract:

- `purvey auth login` uses browser OAuth once to mint and store a scoped Parchment API key; it does not retain session access or refresh tokens
- `purvey catalog search`, `get`, `stats`, structured public-data filters, and `purvey catalog similar <id>` require a Parchment API key with `catalog:read` and are available across API plans
- `purvey inventory`, `roast`, `sales`, and `tasting` require a member-owned API key with the matching scopes
- `purvey config`, `purvey context`, and `purvey manifest` do not require auth
- `purvey manifest` is the preferred stable machine-readable contract for shells and agents
- `purvey context` is the shipped dense agent reference; `purvey context --json` and `--pretty` emit manifest-parity output for compatibility
- stdout stays structured for automation, while operational and fatal messaging is designed to stay on stderr

Cherry Runtime's server-side tools adapt session-authenticated `@purveyors/sdk` clients to its tool schemas. Shared behavior belongs behind Parchment endpoints so browser, CLI, and agent consumers stay aligned without importing one another's runtime.

## Tech stack

- **Framework:** SvelteKit 2 + Svelte 5 + TypeScript
- **Styling:** Tailwind CSS
- **Data:** Parchment API through `@purveyors/sdk`, plus remaining direct Supabase paths documented in `notes/ARCHITECTURE.md`
- **Auth:** Supabase Auth for browser identity and session lifecycle; Parchment
  for API credential validation, principal resolution, and product authorization
- **Payments:** Stripe.js embedded Checkout presentation; Parchment owns all server-side Stripe authority
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

### Billing and account-deletion boundary

Parchment is the sole authority for Checkout creation and recovery, product and
Stripe price mapping, trial eligibility, Stripe webhook settlement,
subscription reads and mutations, entitlement recomputation, and account
deletion. Coffee-app retains only the same-origin cookie-session BFFs, embedded
Stripe.js UI, stable purchase-key presentation, subscription and account UX,
and the short-lived reauthentication signer.

The account-deletion signer uses four server-only settings:

- `ACCOUNT_DELETION_REAUTH_ISSUER`
- `ACCOUNT_DELETION_REAUTH_AUDIENCE`
- `ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS`
- `ACCOUNT_DELETION_REAUTH_ACTIVE_KID`

`ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS` is an Ed25519 private JWK ring. Publish
only the corresponding public-key ring to Parchment, then rotate verifier-first
before changing the active `kid`. The OAuth callback signs a purpose-bound
assertion with a maximum ten-minute lifetime; the deletion BFF forwards it
unchanged to Parchment.

Account deletion immediately cancels the entire attached subscription before
Parchment deletes local account data and Supabase Auth. A durable first
acceptance or replay signs the browser out. Completion messaging uses transient
browser state only, never an account-bound accepted or completion cookie.

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
- `/api/billing/*` and `/api/admin/*` are session BFF and operational routes, not external product APIs

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
- `ACCOUNT_DELETION_REAUTH_ISSUER`
- `ACCOUNT_DELETION_REAUTH_AUDIENCE`
- `ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS`
- `ACCOUNT_DELETION_REAUTH_ACTIVE_KID`

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
