# Purveyors.io

> Green coffee sourcing, roast tracking, and AI-powered discovery for home and professional roasters.

[![Lint](https://github.com/reedwhetstone/coffee-app/actions/workflows/lint.yml/badge.svg)](https://github.com/reedwhetstone/coffee-app/actions/workflows/lint.yml)
[![Playwright Tests](https://github.com/reedwhetstone/coffee-app/actions/workflows/playwright.yml/badge.svg)](https://github.com/reedwhetstone/coffee-app/actions/workflows/playwright.yml)
[![License: Sustainable Use](https://img.shields.io/badge/license-Sustainable%20Use-blue)](LICENSE.md)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2%20%2B%20Svelte%205-FF3E00?logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel)](https://vercel.com)

---

## What is Purveyors?

Purveyors.io is a coffee intelligence platform that bridges green coffee sourcing, roast management, and business analytics into a single tool. It aggregates normalized green coffee data from multiple suppliers into a searchable catalog; provides professional roast tracking with Artisan `.alog` import support; and layers a streaming AI chat interface that understands your inventory and roasting history. The platform scales from a home roaster tracking bags in a spare room to a small commercial operation managing sourcing, roast consistency, and profitability across hundreds of sessions.

---

## Screenshots

<!-- TODO: Add screenshots once captured
![Catalog page](docs/screenshots/catalog.png)
![Roast chart](docs/screenshots/roast-chart.png)
![AI chat workspace](docs/screenshots/chat.png)
![Profit dashboard](docs/screenshots/profit.png)
-->

---

## Key Features

### Marketplace and Catalog

- Multi-supplier green coffee catalog with normalized pricing, origin, processing method, and cupping scores
- Wholesale and retail tier pricing (`price_tiers` JSONB: per-lb price breaks by minimum quantity)
- Filter by origin, process, flavor notes, certifications, and price range
- Supplier cupping notes with tasting radar chart visualization

### Green Coffee Inventory

- Track purchased green coffee with cost, quantity, and stocked status
- Automatic stocked-status updates as inventory is consumed through roasts
- Wholesale markers and filtering across inventory, roast, and sales views

### Roast Tracking

- Log roast sessions with batch weight, charge weight, drop temp, and outcome notes
- Import roast curves from Artisan `.alog` files (CSV-based roast logger format)
- D3.js-powered roast chart with temperature, fan, and heat overlays
- Roast phase shading for drying, Maillard, and development stages
- Per-roast weight-loss percentage tracking

### Sales and Profit Analytics

- Record coffee sales against specific roasts and bean purchases
- KPI dashboard: revenue, cost, profit, and margin per bean and per roast
- Profit page charts with drill-down by time period and product

### AI Chat (GenUI)

- Streaming AI chat via [OpenRouter](https://openrouter.ai) and the [Vercel AI SDK](https://sdk.vercel.ai)
- Persistent workspace-based conversation history with automatic summarization to manage context length
- Tool-calling loop: the AI queries the catalog, inventory, and roast profiles to answer questions in context
- Structured UI blocks rendered inside the chat: coffee cards, tasting radars, roast charts, inventory tables, and action cards
- RAG (retrieval-augmented generation) using vector embeddings for semantic catalog search
- Slash commands for workflow shortcuts inside chat

### Blog

- Technical and industry writing on coffee sourcing, roasting data, and AI
- 10+ published posts written in MDsveX (`.svx`) with full Svelte component support inside post content
- RSS feed, tag-based navigation, and SEO-friendly slug routes

### API Platform

- External REST API for the coffee catalog with tier-based rate limiting and row limits
- API key management dashboard: generate, deactivate, and monitor usage
- Internal and external API layers share the same endpoint logic with different auth paths

---

## Tech Stack

| Layer           | Technology                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Framework       | [SvelteKit 2](https://kit.svelte.dev) with [Svelte 5](https://svelte.dev) runes API                    |
| Database + Auth | [Supabase](https://supabase.com) (PostgreSQL, SSR session auth, service role key)                      |
| Payments        | [Stripe](https://stripe.com) (subscriptions, webhooks, customer management)                            |
| AI              | [OpenRouter](https://openrouter.ai) via [Vercel AI SDK 6](https://sdk.vercel.ai) (`streamText`, tools) |
| Charts          | [LayerCake](https://layercake.graphics) + [D3.js](https://d3js.org)                                    |
| Styling         | [Tailwind CSS 3](https://tailwindcss.com) with Typography, Forms, and Container Queries plugins        |
| Blog            | [MDsveX](https://mdsvex.pngwn.io) (`.svx` Markdown with inline Svelte components)                      |
| Deployment      | [Vercel](https://vercel.com) (Node.js 22, `iad1` region, 5-minute chat streaming timeout)              |
| Unit Tests      | [Vitest](https://vitest.dev) + `@testing-library/svelte` + `happy-dom`                                 |
| E2E Tests       | [Playwright](https://playwright.dev)                                                                   |
| Validation      | [Zod](https://zod.dev)                                                                                 |
| Package Manager | [pnpm](https://pnpm.io) 10+                                                                            |

---

## Architecture Overview

```
Browser
  └── SvelteKit (server + client, Node.js 22)
        ├── hooks.server.ts          # Supabase SSR token refresh, API key middleware
        ├── +layout.server.ts        # Auth session propagated to all routes
        │
        ├── /catalog                 # Green coffee marketplace (public + auth)
        ├── /beans                   # Inventory management (auth required)
        ├── /roast                   # Roast tracking + Artisan import (auth required)
        ├── /profit                  # Sales and profit analytics (auth required)
        ├── /chat                    # GenUI AI workspace (auth required)
        ├── /blog                    # MDsveX blog (public)
        ├── /api-dashboard           # API key management (auth required)
        ├── /subscription            # Stripe subscription management
        │
        └── /api/*                   # Server-side API routes
              ├── /api/catalog        # Internal catalog queries (session auth)
              ├── /api/catalog-api    # External REST API (API key auth, tier limits)
              ├── /api/chat           # Streaming AI: OpenRouter via Vercel AI SDK
              ├── /api/tools/*        # GenUI tool-call handlers (catalog, inventory, roasts)
              ├── /api/workspaces/*   # Chat workspace CRUD and summarization
              ├── /api/stripe/*       # Checkout, webhooks, subscription lifecycle
              └── /api/artisan-import # Artisan .alog CSV processor
```

### Auth Model

Supabase SSR manages sessions via `@supabase/ssr`. `hooks.server.ts` refreshes tokens on every server request and attaches the session to `event.locals`. A four-tier role model (viewer, roaster, api-member, enterprise) is stored in Supabase user metadata and updated via Stripe webhooks on subscription events. The external catalog API uses a separate `bcrypt`-hashed API key system with per-tier rate limits.

### AI Chat Architecture

The `/api/chat` endpoint uses `streamText` from the Vercel AI SDK with a multi-step tool-calling loop. Tools defined server-side include reads against the coffee catalog, green coffee inventory, roast profiles, and bean tasting data. When the AI calls a tool, the result feeds back into the next streaming turn. Alongside text, the AI returns structured `UIBlock` tokens that the front-end parses and renders as interactive Svelte components (coffee cards, tasting radars, roast charts, action cards). Conversation workspaces persist in Supabase; the `/api/workspaces/[id]/summarize` endpoint compresses older turns to keep context manageable.

### Blog Architecture

MDsveX preprocesses `.svx` files in `src/content/blog/` at build time. Each file is a Markdown document with YAML frontmatter and optional inline Svelte components. The server-side blog loader at `src/lib/server/blog.ts` globs all posts, parses frontmatter, and filters `draft: true` entries in production. Static rendering means posts have zero server-side cost per request.

---

## Getting Started

### Prerequisites

- **Node.js** 22.x
- **pnpm** 10+
- A [Supabase](https://supabase.com) project (free tier works for development)
- An [OpenRouter](https://openrouter.ai) API key (required for the `/chat` route)
- A [Stripe](https://stripe.com) account (optional; required for the subscription flow)

### 1. Clone and install

```bash
git clone https://github.com/reedwhetstone/coffee-app.git
cd coffee-app
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root. All variables prefixed with `PUBLIC_` are safe for the browser; everything else is server-only.

```env
# Supabase (public -- exposed to browser)
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase (private -- server only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (private -- required for AI chat)
OPENROUTER_API_KEY=sk-or-...

# Stripe (private -- required for subscriptions)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The service role key is used for admin operations: Stripe webhook role updates and E2E test magic-link auth. Stripe and OpenRouter keys are optional in development if you disable those features.

### 3. Start the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:5173`.

---

## Testing

### Unit Tests

Unit tests use Vitest with `@testing-library/svelte` and `happy-dom` for DOM simulation.

```bash
pnpm test           # run once and exit
pnpm test:unit      # watch mode
```

### E2E Tests

End-to-end tests use Playwright. They run against a real Supabase backend (production by default in CI; configure `PLAYWRIGHT_BASE_URL` for local dev). Copy the example env file and fill in your test account credentials:

```bash
cp .env.test.example .env.test
# Edit .env.test: add E2E_TEST_EMAIL, E2E_TEST_USER_ID, SUPABASE_SERVICE_ROLE_KEY
```

```bash
pnpm test:e2e              # headless run
pnpm test:e2e:ui           # Playwright interactive UI mode
pnpm test:e2e:report       # open last HTML report
pnpm test:e2e:auth         # run auth setup fixture only
```

**CI behavior:** The Playwright workflow runs on every push and on PRs targeting `main`. Failed runs post an alert to a Discord webhook (configure via the `DISCORD_CODEBASE_WEBHOOK_URL` repository secret). All E2E tests are non-destructive; they use a dedicated test user account and never write synthetic data to production.

---

## Project Structure

```
coffee-app/
├── src/
│   ├── routes/                   # SvelteKit file-based routing
│   │   ├── (home)/               # Landing page (grouped layout route)
│   │   ├── catalog/              # Green coffee marketplace
│   │   ├── beans/                # Green coffee inventory management
│   │   ├── roast/                # Roast session tracking and chart
│   │   ├── profit/               # Sales and profit analytics
│   │   ├── chat/                 # GenUI AI workspace
│   │   ├── blog/                 # Blog listing, post, tag, and RSS routes
│   │   ├── api/
│   │   │   ├── catalog/          # Internal catalog API (session auth)
│   │   │   ├── catalog-api/      # External REST catalog API (API key auth)
│   │   │   ├── chat/             # Streaming AI endpoint (POST, SSE)
│   │   │   ├── tools/            # GenUI tool-call handlers
│   │   │   ├── workspaces/       # Chat workspace persistence and summarization
│   │   │   ├── stripe/           # Payment endpoints and webhook handler
│   │   │   └── artisan-import/   # Artisan .alog CSV importer
│   │   ├── api-dashboard/        # API key management UI
│   │   ├── subscription/         # Stripe subscription flow
│   │   └── admin/                # Admin utilities
│   ├── lib/
│   │   ├── components/
│   │   │   ├── genui/
│   │   │   │   ├── blocks/       # Full interactive GenUI blocks
│   │   │   │   │   ├── ActionCardBlock.svelte
│   │   │   │   │   ├── CoffeeCardsBlock.svelte
│   │   │   │   │   ├── DataTableBlock.svelte
│   │   │   │   │   ├── InventoryTableBlock.svelte
│   │   │   │   │   ├── RoastChartBlock.svelte
│   │   │   │   │   ├── RoastProfilesBlock.svelte
│   │   │   │   │   └── TastingRadarBlock.svelte
│   │   │   │   └── previews/     # Compact inline block previews for chat
│   │   │   ├── roast/            # Roast page and D3 chart components
│   │   │   ├── chat/             # Chat sidebar and message renderer
│   │   │   ├── canvas/           # Canvas pane (persistent GenUI workspace)
│   │   │   ├── blog/             # Blog post layout components
│   │   │   ├── layout/           # App shell, sidebar navigation
│   │   │   ├── marketing/        # Landing page sections
│   │   │   └── ui/               # Shared primitives (FormShell, buttons, modals)
│   │   ├── server/               # Server-only helpers (auth, blog loader, data utils)
│   │   ├── services/             # Business logic (Stripe, RAG, tools, suggestions)
│   │   │   ├── ragService.ts     # Vector embedding search via OpenRouter
│   │   │   ├── tools.ts          # GenUI tool definitions (catalog, inventory, roasts)
│   │   │   ├── stripe.ts         # Stripe client
│   │   │   └── stripe-webhook.ts # Webhook handler and role-update logic
│   │   ├── stores/               # Svelte stores for client-side state
│   │   ├── types/                # TypeScript type definitions
│   │   │   ├── coffee.types.ts
│   │   │   ├── genui.ts          # UIBlock and tool response types
│   │   │   ├── database.types.ts # Supabase-generated schema types
│   │   │   └── blog.types.ts
│   │   └── utils/                # Shared utility functions
│   ├── content/
│   │   └── blog/                 # MDsveX blog posts (.svx files)
│   └── hooks.server.ts           # Supabase session + API key auth middleware
├── tests/
│   └── e2e/                      # Playwright test specs and auth fixtures
├── notes/                        # Internal dev notes (DEVLOG, API strategy, UI spec)
├── .github/
│   └── workflows/
│       ├── lint.yml              # Prettier + ESLint on every push
│       └── playwright.yml        # E2E tests on push + PR to main
├── svelte.config.js              # MDsveX preprocessor + Vercel adapter config
├── tailwind.config.ts
└── vite.config.ts                # Vite + Vitest configuration
```

---

## API

Two API layers exist with intentionally separate authentication paths.

**Internal API** (`/api/*`): Consumed by the SvelteKit front-end. Authenticated via Supabase session cookies set by `hooks.server.ts`. Not rate-limited.

**External catalog API** (`/api/catalog-api/`): Public REST endpoint for third-party and developer access. Authenticated with hashed API keys. Tier-based limits:

| Tier       | Rows per request | Monthly calls |
| ---------- | ---------------- | ------------- |
| Viewer     | 25               | 200           |
| Member     | Unlimited        | 10,000        |
| Enterprise | Unlimited        | Unlimited     |

API keys are generated and managed at `/api-dashboard/`. Usage is logged per key with full analytics. API documentation lives at `/api/docs/`.

The longer-term goal is an API-first architecture where internal server load functions become thin consumers of the same versioned endpoints sold externally. See `notes/API_notes/API-strategy.md` for the migration plan.

---

## Blog

Blog posts live in `src/content/blog/` as `.svx` files (MDsveX format). A post is a Markdown file with YAML frontmatter that can embed Svelte components inline.

```svx
---
title: Building a Coffee Data Pipeline
date: 2025-01-15
tags: [data, engineering, coffee]
draft: false
---

Standard Markdown content here. You can embed Svelte components directly.
```

The blog server utility at `src/lib/server/blog.ts` globs all `.svx` files at build time, parses frontmatter, and excludes `draft: true` entries in production builds.

Routes:

| Route             | Purpose               |
| ----------------- | --------------------- |
| `/blog`           | Post listing          |
| `/blog/[slug]`    | Individual post       |
| `/blog/tag/[tag]` | Posts filtered by tag |
| `/blog/feed.xml`  | RSS feed              |

---

## Contributing

Purveyors.io is a personal project released under the Sustainable Use License. External contributions are welcome; the project is not community-governed.

**Workflow:**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Write tests for new behavior where applicable
4. Ensure `pnpm lint` and `pnpm test` pass before opening a PR
5. Open a pull request against `main` with a clear description of what changed and why

**Code conventions:**

- TypeScript strict mode throughout
- Svelte 5 runes API (`$state`, `$derived`, `$effect`) -- no legacy Options API
- Prettier auto-format (`pnpm format`), enforced in CI via `lint.yml`
- One purpose per PR; keep diffs reviewable

---

## License

Purveyors.io is [fair-code](https://faircode.io) distributed under the [**Sustainable Use License v1.0**](LICENSE.md).

Free for personal use, non-commercial use, and internal business use. You may not distribute it as a commercial product or hosted service. See [LICENSE.md](LICENSE.md) for the complete terms.

---

## Acknowledgments

Key libraries that make this project possible:

- [SvelteKit](https://kit.svelte.dev) -- full-stack web framework
- [Supabase](https://supabase.com) -- PostgreSQL database, auth, and realtime
- [Vercel AI SDK](https://sdk.vercel.ai) -- streaming AI and tool-calling infrastructure
- [LayerCake](https://layercake.graphics) -- composable Svelte charting framework
- [D3.js](https://d3js.org) -- data visualization primitives
- [MDsveX](https://mdsvex.pngwn.io) -- Markdown + Svelte blog preprocessor
- [Tailwind CSS](https://tailwindcss.com) -- utility-first styling
- [Stripe](https://stripe.com) -- subscription billing and payment processing
- [Playwright](https://playwright.dev) -- end-to-end browser testing
- [Zod](https://zod.dev) -- runtime schema validation
- [PapaParse](https://www.papaparse.com) -- CSV parsing for Artisan `.alog` imports
