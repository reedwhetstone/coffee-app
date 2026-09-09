# AGENTS.md

This is the canonical contributor and coding-agent guide for the Purveyors web platform repo.

`CLAUDE.md`, `GEMINI.md`, and `.cursorrules` remain lightweight pointers or symlinks to this file.

## Repo purpose

This repo is the Purveyors web platform. It includes:

- the public marketing site
- the public catalog and analytics surfaces
- the authenticated app for inventory, roast, profit, Cherry AI, and subscription workflows
- the Parchment Console for keys and usage
- the internal route layer that powers the first-party product
- the `/docs` tree for product and CLI guidance; the generated API reference lives at `api.purveyors.io/docs`

Coffee-app's Cherry Runtime transport depends on `@purveyors/sdk`; model-facing orchestration and tools execute in Parchment, while `@purveyors/cli` remains a separate first-class API client.

## Stack

- SvelteKit 2
- Svelte 5
- TypeScript
- Tailwind CSS
- Supabase
- Stripe.js for embedded Checkout presentation
- Svelte AI SDK presentation over Parchment-owned OpenRouter orchestration
- `@purveyors/sdk`
- LayerCake (charts and analytics components)

## Contract references

- External integrations use `https://api.purveyors.io/v1/*`; coffee-app `/api/*` routes serve the first-party app, not a broad public compatibility promise. Same-host `/v1/*`, `/api/catalog-api`, and former `/api/tools/*` routes are retired.
- Read [HTTP and CLI contributor contracts](notes/CONTRIBUTOR_CONTRACTS.md) when changing routes, API/CLI docs, catalog/map semantics, auth, entitlements, or related consumers. That reference preserves the detailed domain rules; do not blur external API and platform BFF ownership.
- [ARCHITECTURE](notes/ARCHITECTURE.md) maps implementation, [PRODUCT_VISION](notes/PRODUCT_VISION.md) owns direction, [decisions](notes/decisions/) records decisions, and [DEVLOG](notes/DEVLOG.md) holds priority. Consult relevant sections; proposed decisions are not accepted authority.

## Development and validation

Use `pnpm`; development commands are `pnpm dev`, `pnpm build`, `pnpm preview`, and `pnpm sync`. Check `package.json` for current dependency versions and scripts.

- **Prose/instruction-only changes:** check changed formatting, local references, and consistency with source and canonical instructions; run `git diff --check`. No app build, Svelte checks, or runtime tests are required unless the change also affects executable code, configuration, generated output, or a machine-consumed contract.
- **Source/configuration changes:** run `pnpm lint` and `pnpm check --fail-on-warnings`, plus relevant `pnpm test` cases. Add build or E2E checks when the affected behavior needs that evidence.
- Run `pnpm verify:catalog-http-contract` for catalog HTTP contract changes and `pnpm audit:discoverability` for public discoverability changes. Do not repeat unchanged successful checks just to update a PR description.
- For environment keys, E2E setup, and helpers, see [local validation](notes/LOCAL_VALIDATION.md). Missing setup is `VALIDATION_BLOCKED_ENV`, not a code failure. Do not auto-copy secrets from outside the repo; placeholders can support static checks but never prove runtime behavior.
- Report commands and results as `VALIDATION_PASS`, `VALIDATION_FAIL`, `VALIDATION_BLOCKED_ENV`, `VALIDATION_BLOCKED_SERVICE`, or `VALIDATION_CI_PENDING` as appropriate. State unverified behavior rather than claiming success.

## Billing and account-deletion authority

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

Verify behavior from source. Preserve explicit auth, entitlement, query/filter, rate/row-limit, share-token, and session semantics from the [contract reference](notes/CONTRIBUTOR_CONTRACTS.md). Update the canonical owner and affected consumers rather than copying contracts between pages.

When behavior changes, inspect and update the affected owners and consumers below. A prose-only correction does not require a whole-site sweep:

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

Complete the authorized outcome with routine implementation judgment. Ask only when a missing decision materially affects scope, correctness, or authority; existing authorization does not need reconfirmation.

Work on a branch against `origin/main` and submit a PR; merge authority is separate. Hand off the complete PR without blocking on remote CI unless asked.

A strong PR in this repo should include:

- a clear statement of which product surface changed
- validation output or a note explaining why validation could not run
- updated docs when behavior, routes, or positioning changed
- screenshots for UI changes when useful

For changed public positioning, routes, or API expectations, inspect the relevant consumers, which can include `/api`, `/docs`, `/api-dashboard`, README, and AGENTS. Update only the surfaces affected by the change.
