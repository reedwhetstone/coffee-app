# AGENTS.md

This is the canonical contributor and coding-agent guide for the Purveyors web platform repo.

`CLAUDE.md` and `GEMINI.md` should remain lightweight pointers or symlinks to this file.

## Repo purpose

This repo is the Purveyors web platform. It includes:

- the public marketing site
- the public catalog and analytics surfaces
- the authenticated app for inventory, roast, profit, Cherry AI, and subscription workflows
- the Parchment Console for keys and usage
- the internal route layer that powers the first-party product
- the `/docs` tree for product and CLI guidance; the generated API reference lives at `api.purveyors.io/docs`

Cherry Runtime's server-side tools depend on `@purveyors/sdk`; `@purveyors/cli` is a separate first-class Parchment API client.

## Stack

- SvelteKit 2
- Svelte 5
- TypeScript
- Tailwind CSS
- Supabase
- Stripe.js for embedded Checkout presentation
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
- `ACCOUNT_DELETION_REAUTH_ISSUER`
- `ACCOUNT_DELETION_REAUTH_AUDIENCE`
- `ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS`
- `ACCOUNT_DELETION_REAUTH_ACTIVE_KID`

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
- `/evals`
- `/api`
- `/docs`
- `/blog`
- `/bot`

### Authenticated product routes

- `/account`
- `/beans`
- `/roast`
- `/profit`
- `/chat`
- `/api-dashboard`
- `/subscription`

### API model

Treat the web app and the external Parchment API as two separate HTTP surfaces:

1. **Public external API** (`https://api.purveyors.io/v1/*`)

   - `GET https://api.purveyors.io/` advertises the service, docs, health, and OpenAPI resources; `GET /v1` is not a route
   - `GET https://api.purveyors.io/v1/catalog` is the stable public catalog contract
   - `GET https://api.purveyors.io/v1/catalog/map` is the authorized lightweight map projection over the same catalog visibility and filter scope. It keeps unique-coffee totals separate from placements and viewport counts, and gates canonical place navigation, bounding boxes, and elevation profiles to member or paid access
   - `GET https://api.purveyors.io/v1/catalog/{id}/similar` is a beta catalog matching contract for member sessions or API keys with API Origin or Enterprise plus `catalog:read`
   - `GET https://api.purveyors.io/v1/price-index` is an aggregate `price_index_snapshots` contract for entitled first-party sessions and customer API keys with Parchment Intelligence access
   - Parchment catalog, owner, and entitled data endpoints require a Bearer credential. Public website catalog pages use a server-held demo key through the BFF; deliberately designated Market Index teaser slices remain anonymous upstream
   - Full catalog responses include structured process transparency fields and `process.evidence_available`, but not raw evidence quotes
   - Rate-limit headers (`X-RateLimit-*`) are only included in API-key responses
   - The same-host coffee-app `/v1/*` routes and the `/api/catalog-api` alias have been removed; external integrations use `https://api.purveyors.io/v1/*`

2. **Platform app API** (`/api/*`)
   - `/api/catalog`, `/api/catalog/filters`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/billing/*`, `/api/account-deletion`, `/api/account-deletion/reauthenticate`, `/api/admin/*`, and related helpers
   - Powers the first-party web app, Console, billing, Cherry Runtime, and admin workflows
   - Mixed auth model depending on route: catalog BFF adapters can allow anonymous or session access, most product routes require session auth, and chat/workspace routes require either Mallard Studio membership or Parchment Intelligence access
   - Important for contributors, but not a broad public compatibility promise
   - `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate` are session-authenticated Console control-plane routes, not public API contracts
   - `/api/docs` and `/api-dashboard/docs` are legacy docs entry points that redirect to `https://api.purveyors.io/docs`
   - `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, and `/.well-known/appspecific/com.chrome.devtools.json` are public metadata or compatibility endpoints; document them as discoverability surfaces, not product APIs
   - `/auth/callback` is the web OAuth handoff surface and can mint a short-lived, purpose-bound Ed25519 account-deletion assertion before returning to `/account`; `/auth/cli` is the signed-in browser consent surface for CLI authorization requests. They belong in platform docs only when auth flow behavior matters
   - `/api/tools/*` routes are deprecated; prefer direct session-mode Parchment SDK integration

Do not blur those layers in code comments, docs, or PR descriptions.

### Billing and account-deletion authority

Parchment owns Checkout creation and recovery, the purchase catalog and Stripe
price mapping, trial eligibility, webhook settlement, subscription snapshots and
mutations, entitlement recomputation, and the provider-before-local-before-Auth
account-deletion saga. Coffee-app is the cookie-session BFF, embedded Checkout
and account/subscription UX, and Ed25519 reauthentication signer. It may retain
stable purchase keys and the public Stripe publishable key, but it must not
retain a Stripe secret, webhook destination, provider credential, alternate
billing writer, or local deletion coordinator.

The signer configuration is server-only. `ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS`
contains an Ed25519 private JWK ring and
`ACCOUNT_DELETION_REAUTH_ACTIVE_KID` selects the current signing key;
`ACCOUNT_DELETION_REAUTH_ISSUER` and
`ACCOUNT_DELETION_REAUTH_AUDIENCE` must match Parchment's verifier. Rotate
verifier-first. Account deletion immediately cancels the entire attached
subscription. After a durable Parchment acceptance, use transient browser state
for completion messaging; never create an account-bound accepted or completion
cookie.

## Documentation rules

When changing docs, keep these sources aligned:

- `README.md`
- `AGENTS.md`
- `src/routes/api/+page.svelte`
- the `/docs` tree under `src/routes/docs`
- the `/api-dashboard` console surface, including `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate`
- any legacy docs redirects such as `/api/docs` and `/api-dashboard/docs`
- metadata and handoff routes such as `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, `/.well-known/appspecific/com.chrome.devtools.json`, `/auth/callback`, and `/auth/cli` when platform route coverage changes
- `src/routes/api/+page.server.ts` and `/api` copy when plan naming, limits, or route framing changes

### Docs architecture

- Public docs live under `/docs`
- Authored API guides live under `/docs/api/*`; the canonical generated API reference is `https://api.purveyors.io/docs`
- CLI docs live under `/docs/cli/*`
- `src/lib/docs/content.ts` is the shared source of truth for docs IA and long-form content
- Prefer shared docs data/components over duplicated long-form pages
- Keep public docs accessible without login

### Accuracy rules

- Verify behavior from source before documenting it
- Use `notes/ARCHITECTURE.md` as the current implementation-state map. Product direction lives in `notes/PRODUCT_VISION.md`, decisions in `notes/decisions/`, and priority in `notes/DEVLOG.md`.
- Do not claim an endpoint is public unless it truly is
- Do not describe the platform `/api/catalog` tree as the canonical catalog contract; that is `https://api.purveyors.io/v1/catalog`
- Document `https://api.purveyors.io/v1/catalog/map` as a Parchment route, not a shipped coffee-app BFF. Preserve the legacy `grade` text-filter boundary, numeric MASL overlap semantics, canonical `place_id` identity, non-additive placement counts, explicit unplaced remainder, safe provenance, and principal-specific cache policy. Do not advertise a coffee-app `/api/catalog/map`, CLI map command, or Cherry map tool until its owning slice ships.
- Document `https://api.purveyors.io/v1/catalog/{id}/similar` as beta candidate matching, not canonical identity resolution. Preserve auth requirements, query bounds, 401/403/404/429 behavior, and cautious confidence copy.
- Do not flatten CLI auth into one rule: catalog search, get, and stats require a Parchment API key with `catalog:read`; structured process filters require member access, and catalog similar additionally requires a member-owned key or an API Origin/Enterprise key; inventory, roast, sales, and tasting require the member role and matching scopes; config, context, and manifest are local or onboarding surfaces that do not require auth; `purvey manifest` is the preferred machine-readable contract; `purvey context --json` and `--pretty` are compatibility-parity aliases for callers already using the context entrypoint; and `--csv` is invalid for context or manifest
- Do not invent filter/query behavior that the route does not implement
- Be explicit about auth model, tier limits, row-limit headers, share-token behavior, and session requirements
- If analytics are a product surface but not a public REST surface, say that clearly
- Preserve structured process semantics in docs: null supplier metadata is not explicit none, `has_additives=false` means an exact disclosed-none additive array, and raw processing evidence quotes are not public API fields

## CLI relationship

The web app uses session-mode `@purveyors/sdk` clients in Cherry Runtime's server-side tool adapters. It does not import `@purveyors/cli`.

CLI auth and output rules matter here too:

- `purvey auth login` uses browser OAuth once to mint and store a scoped Parchment API key; it does not retain session access or refresh tokens
- `purvey catalog search`, `get`, and `stats` require a Parchment API key with `catalog:read`; structured process filters require member access, and `purvey catalog similar` additionally requires a member-owned key or an API Origin/Enterprise key
- `purvey inventory`, `roast`, `sales`, and `tasting` require a member-owned API key with the matching scopes
- `purvey config`, `purvey context`, and `purvey manifest` do not require auth
- `purvey context` is the shipped dense agent reference and prints text output by default
- `purvey manifest` is the preferred machine-readable contract, and `purvey context --json` / `--pretty` provide manifest-parity output for compatibility
- structured stdout and stderr semantics are part of the CLI contract for scripts and agents

That means:

- CLI docs matter to this repo
- Cherry tool behavior should stay aligned with CLI behavior
- shared business logic should move toward reusable modules, not duplicated route code

Deprecated `/api/tools/*` routes still exist for compatibility. Prefer direct session-mode SDK integration for new work.

## Svelte and UI guidance

- Use Svelte 5 patterns already established in the repo
- Keep public docs and marketing pages coherent with the public nav
- Favor maintainable shared components over one-off static pages when multiple docs pages need the same layout
- Keep changes tightly scoped to the problem at hand; avoid unrelated product edits in docs or contributor PRs

### Customer-facing copy

- Never expose agent or user dialogue, prompt instructions, implementation rationale, layout narration, or internal decision notes in production copy. Phrases such as “keep this separate below” describe our process, not customer value. Rewrite the underlying idea as a direct customer benefit or omit it.
- Before submitting public UI or marketing changes, read the rendered copy by itself and remove any sentence that sounds like a command to the implementer, a note about page structure, or an explanation of why the team arranged the interface a certain way.

### Customer-facing design

- Keep marketing and public UI revisions within the established Purveyors brand language. Reuse canonical components and treat CoffeeBench (`/evals/coffeebench-v1`) as a strong reference for clean accents: warm neutral surfaces, editorial typography, thin borders, and restrained existing colors.
- Interpret requests for more design flair first as clearer hierarchy, spacing, typography, and information structure. Do not introduce a new decorative motif, visual system, or radical design language without explicit direction.

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
