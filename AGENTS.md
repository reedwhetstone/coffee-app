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

Its server-side agent tools depend on `@purveyors/sdk`; `@purveyors/cli` is a separate first-class Parchment API client.

## Stack

- SvelteKit 2
- Svelte 5
- TypeScript
- Tailwind CSS
- Supabase
- Stripe
- OpenRouter via Vercel AI SDK
- `@purveyors/sdk`
- LayerCake (charts and analytics components)

## Commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm sync
pnpm lint
pnpm check --fail-on-warnings
pnpm test
pnpm verify:catalog-http-contract
pnpm audit:discoverability
```

Required validation for repo changes unless explicitly waived:

```bash
pnpm lint
pnpm check --fail-on-warnings
```

## Local validation env contract

Fresh worktrees often need repo-local env setup before static validation succeeds. If required env vars are missing, report that as `VALIDATION_BLOCKED_ENV`, not `VALIDATION_FAIL`.

Validation command classes:

- `pnpm lint`
- `pnpm check --fail-on-warnings`
- `pnpm test`
- `pnpm test:e2e`

For static validation (`pnpm check --fail-on-warnings`), require:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

For E2E (`pnpm test:e2e`), also require:

- `E2E_TEST_EMAIL`
- `E2E_TEST_USER_ID`
- `PLAYWRIGHT_BASE_URL` (optional, defaults to localhost)

Repo-local helpers:

```bash
pnpm worktree:bootstrap   # copy example env files and print required keys
pnpm env:check            # verify static validation env values
pnpm env:check:e2e        # verify E2E-specific env values
```

Rules:

- Placeholder values may unblock static validation, but they do not prove runtime or E2E behavior.
- Do not auto-copy secrets from outside the repo into a worktree.
- Do not describe this helper as a fix for detached-worktree module-resolution or stale temp-path install bugs. That is a separate reliability issue.

Reporting guidance:

- `VALIDATION_PASS`
- `VALIDATION_FAIL`
- `VALIDATION_BLOCKED_ENV`
- `VALIDATION_BLOCKED_SERVICE`
- `VALIDATION_CI_PENDING`

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

Treat the web app and the external Parchment API as two separate HTTP surfaces:

1. **Public external API** (`https://api.purveyors.io/v1/*`)

   - `GET https://api.purveyors.io/v1` advertises the public namespace, active resources, and legacy migration hints
   - `GET https://api.purveyors.io/v1/catalog` is the stable public catalog contract
   - `GET https://api.purveyors.io/v1/catalog/{id}/similar` is a beta catalog matching contract for member sessions or API keys with API Origin or Enterprise plus `catalog:read`
   - `GET https://api.purveyors.io/v1/price-index` is an aggregate `price_index_snapshots` contract for API keys with Parchment Intelligence access
   - Auth varies by route: catalog supports Bearer API key or anonymous access; similarity and price-index require entitlement-backed auth
   - Full catalog responses include structured process transparency fields and `process.evidence_available`, but not raw evidence quotes
   - Rate-limit headers (`X-RateLimit-*`) are only included in API-key responses
   - The same-host coffee-app `/v1/*` routes and the `/api/catalog-api` alias have been removed; external integrations use `https://api.purveyors.io/v1/*`

2. **Platform app API** (`/api/*`)
   - `/api/catalog`, `/api/catalog/filters`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/stripe/*`, `/api/admin/*`, and related helpers
   - Powers the first-party web app, Console, billing, chat, and admin workflows
   - Mixed auth model depending on route: catalog BFF adapters can allow anonymous or session access, most product routes require session auth, and chat/workspace routes require either Mallard Studio membership or Parchment Intelligence access
   - Important for contributors, but not a broad public compatibility promise
   - `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate` are session-authenticated Console control-plane routes, not public API contracts
   - `/api/docs` and `/api-dashboard/docs` are legacy docs entry points that redirect to `https://api.purveyors.io/docs`
   - `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, and `/.well-known/appspecific/com.chrome.devtools.json` are public metadata or compatibility endpoints; document them as discoverability surfaces, not product APIs
   - `/auth/callback` and `/auth/cli-callback` are OAuth handoff surfaces; they belong in platform docs only when auth flow behavior matters
   - `/api/tools/*` routes are deprecated; prefer direct session-mode Parchment SDK integration

Do not blur those layers in code comments, docs, or PR descriptions.

## Documentation rules

When changing docs, keep these sources aligned:

- `README.md`
- `AGENTS.md`
- `src/routes/api/+page.svelte`
- the `/docs` tree under `src/routes/docs`
- the `/api-dashboard` console surface, including `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate`
- any legacy docs redirects such as `/api/docs` and `/api-dashboard/docs`
- metadata and handoff routes such as `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, `/.well-known/appspecific/com.chrome.devtools.json`, `/auth/callback`, and `/auth/cli-callback` when platform route coverage changes
- `src/routes/api/+page.server.ts` and `/api` copy when plan naming, limits, or route framing changes

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
- Do not describe the platform `/api/catalog` tree as the canonical catalog contract; that is `https://api.purveyors.io/v1/catalog`
- Document `https://api.purveyors.io/v1/catalog/{id}/similar` as beta candidate matching, not canonical identity resolution. Preserve auth requirements, query bounds, 401/403/404/429 behavior, and cautious confidence copy.
- Do not flatten CLI auth into one rule: catalog commands require an authenticated viewer session; inventory, roast, sales, and tasting require the member role; config, context, and manifest are local or onboarding surfaces that do not require auth; `purvey manifest` is the preferred machine-readable contract; `purvey context --json` and `--pretty` are compatibility-parity aliases for callers already using the context entrypoint; and `--csv` is invalid for context or manifest
- Do not invent filter/query behavior that the route does not implement
- Be explicit about auth model, tier limits, row-limit headers, share-token behavior, and session requirements
- If analytics are a product surface but not a public REST surface, say that clearly
- Preserve structured process semantics in docs: null supplier metadata is not explicit none, `has_additives=false` means an exact disclosed-none additive array, and raw processing evidence quotes are not public API fields

## CLI relationship

The web app uses session-mode `@purveyors/sdk` clients in `src/lib/services/tools.ts`.

CLI auth and output rules matter here too:

- `purvey catalog *` requires an authenticated viewer session
- `purvey inventory`, `roast`, `sales`, and `tasting` require the member role
- `purvey config`, `purvey context`, and `purvey manifest` do not require auth
- `purvey context` is the shipped dense agent reference and prints text output by default
- `purvey manifest` is the preferred machine-readable contract, and `purvey context --json` / `--pretty` provide manifest-parity output for compatibility
- structured stdout and stderr semantics are part of the CLI contract for scripts and agents

That means:

- CLI docs matter to this repo
- chat-tool behavior should stay aligned with CLI behavior
- shared business logic should move toward reusable modules, not duplicated route code

Deprecated `/api/tools/*` routes still exist for compatibility. Prefer direct session-mode SDK integration for new work.

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

If the change touches public positioning, docs, or API expectations, review the whole information architecture, not just the line you edited. That usually means checking `/api`, `/docs`, `/api-dashboard`, README, and AGENTS together.
