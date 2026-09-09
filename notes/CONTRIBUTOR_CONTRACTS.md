# HTTP and CLI contributor contracts

Read this reference when changing routes, API/CLI documentation, catalog semantics, or related consumers. Verify current behavior from source before changing these contracts.

## Route model

### Public product routes

- `/`
- `/catalog`
- `/analytics`
- `/evals`
- `/api`
- `/docs`
- `/blog`
- `/fieldnotes` (Purveyors Fieldnotes)
- `/market-wire` (compatibility route for Fieldnotes and historical Market Brief links)
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
   - `GET https://api.purveyors.io/v1/catalog/map` is the authorized lightweight map projection over the same catalog visibility and filter scope. It keeps unique-coffee totals separate from placements and viewport counts, and exposes canonical place navigation, bounding boxes, and elevation profiles to member sessions or customer API keys on any API plan. Green map queries inspect at most 25 catalog rows
   - `GET https://api.purveyors.io/v1/catalog/{id}/similar` is a beta catalog matching contract for member sessions or API keys on any API plan with `catalog:read`
   - `GET https://api.purveyors.io/v1/price-index` is an aggregate `price_index_snapshots` contract for entitled first-party sessions and customer API keys with Parchment Intelligence access
   - Parchment catalog, owner, and entitled data endpoints require a Bearer credential. Public website catalog pages use a server-held demo key through the BFF; deliberately designated Market Index teaser slices remain anonymous upstream
   - Full catalog responses include structured process transparency fields and `process.evidence_available`, but not raw evidence quotes
   - Green, Origin, and Enterprise API keys share the public-data capability family. Green is limited to 200 requests per account per UTC calendar month and up to 25 items per collection response; aggregates use documented endpoint-specific bounds
   - Scopes and owner binding control private resources independently of API plan, and Parchment Intelligence remains a separate entitlement
   - Rate-limit headers (`X-RateLimit-*`) are only included in API-key responses and describe the allowance shared by every key on the account
   - The same-host coffee-app `/v1/*` routes and the `/api/catalog-api` alias have been removed; external integrations use `https://api.purveyors.io/v1/*`

2. **Platform app API** (`/api/*`)
   - `/api/catalog`, `/api/catalog/filters`, `/api/beans`, `/api/roast-profiles`, `/api/profit`, `/api/chat`, `/api/workspaces`, `/api/billing/*`, `/api/email-subscriptions/*`, `/api/account-deletion`, `/api/account-deletion/reauthenticate`, `/api/admin/*`, and related helpers
   - Powers the first-party web app, Console, billing, Cherry Runtime, and admin workflows
   - Mixed auth model depending on route: catalog BFF adapters can allow anonymous or session access, most product routes require session auth, and chat/workspace routes require either Mallard Studio membership or Parchment Intelligence access
   - Important for contributors, but not a broad public compatibility promise
   - `/api-dashboard/keys/generate` and `/api-dashboard/keys/deactivate` are session-authenticated Console control-plane routes, not public API contracts
   - `/api/docs` and `/api-dashboard/docs` are legacy docs entry points that redirect to `https://api.purveyors.io/docs`
   - `/llms.txt`, `/sitemap.xml`, `/blog/feed.xml`, and `/.well-known/appspecific/com.chrome.devtools.json` are public metadata or compatibility endpoints; document them as discoverability surfaces, not product APIs
   - `/auth/callback` is the web OAuth handoff surface and can mint a short-lived, purpose-bound Ed25519 account-deletion assertion before returning to `/account`; `/auth/cli` is the signed-in browser consent surface for CLI authorization requests. They belong in platform docs only when auth flow behavior matters
   - Former `/api/tools/*` compatibility routes are retired; use direct session-mode Parchment SDK integration

Do not blur those layers in code comments, docs, or PR descriptions.

### Accuracy rules

- Do not claim an endpoint is public unless it truly is
- Do not describe the platform `/api/catalog` tree as the canonical catalog contract; that is `https://api.purveyors.io/v1/catalog`
- Document `https://api.purveyors.io/v1/catalog/map` as the canonical Parchment contract. Coffee-app's `/api/catalog/map` is the first-party BFF behind the production MapLibre catalog experience, not a public integration surface; the catalog list remains the default and recovery path. Preserve the legacy `grade` text-filter boundary, numeric MASL overlap semantics, canonical `place_id` identity, non-additive placement counts, explicit unplaced remainder, safe provenance, and principal-specific cache policy. Do not advertise a CLI map command or Cherry map tool until its owning slice ships.
- Document `https://api.purveyors.io/v1/catalog/{id}/similar` as beta candidate matching, not canonical identity resolution. Preserve auth requirements, query bounds, 401/403/404/429 behavior, and cautious confidence copy.
- Do not invent filter/query behavior that the route does not implement
- Be explicit about auth model, tier limits, row-limit headers, share-token behavior, and session requirements
- If analytics are a product surface but not a public REST surface, say that clearly
- Preserve structured process semantics in docs: null supplier metadata is not explicit none, `has_additives=false` means an exact disclosed-none additive array, and raw processing evidence quotes are not public API fields

## CLI relationship

The web app uses a session-mode `@purveyors/sdk` client as an unbuffered Cherry Runtime BFF. Model-facing tools execute inside Parchment. Coffee-app does not import `@purveyors/cli`.

CLI auth and output rules matter here too:

- `purvey auth login` uses browser OAuth once to mint and store a scoped Parchment API key; it does not retain session access or refresh tokens
- `purvey catalog search`, `get`, `stats`, structured public-data filters, and `similar` require a Parchment API key with `catalog:read` and are available across API plans
- `purvey inventory`, `roast`, `sales`, and `tasting` require a member-owned API key with the matching scopes
- `purvey config`, `purvey context`, and `purvey manifest` do not require auth
- `purvey context` is the shipped dense agent reference and prints text output by default
- `purvey manifest` is the preferred machine-readable contract, and `purvey context --json` / `--pretty` provide manifest-parity output for compatibility
- structured stdout and stderr semantics are part of the CLI contract for scripts and agents

That means:

- CLI docs matter to this repo
- Cherry tool behavior should stay aligned with CLI behavior
- shared business logic should move toward reusable modules, not duplicated route code

The former `/api/tools/*` compatibility routes are retired. Use direct session-mode SDK integration.
