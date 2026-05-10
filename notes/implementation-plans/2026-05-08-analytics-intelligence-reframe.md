# Analytics Intelligence Reframe Program

**Date:** 2026-05-08  
**Updated:** 2026-05-10  
**Mode:** multi-stage implementation plan  
**Status:** Consolidated implementation plan; PRs not started

## Consolidated source inputs

This plan consolidates:

- Reed's May 8 refactor thesis: Purveyors is analytics and intelligence first; Mallard Studio should not obscure the core product strategy.
- The initial codebase red-team: preserve the data rails that make intelligence valuable, but demote CRUD theater into analysis-native ingestion and personalization context.
- The May 8 implementation plan: sequence the work as small, mergeable frontend-first PRs instead of a risky deletion/replatforming pass.
- Reed's May 9 chat-layer correction: chat, CLI-backed actions, and GenUI belong to the intelligence layer first; Mallard Studio is a focused add-on over the same shared substrate.
- The May 9 analytics UI/UX references: analytics should become a command center where market read, filters, evidence, and next actions converge.
- The May 9 red-team report: avoid fake capture theater, naming sprawl, generic AI boxes, anonymous power-tool leakage, and insight claims without provenance.
- Reed's May 10 strategic correction: roasters remain primary users, but the core product category is green coffee supply-chain intelligence, not another roasting tool.
- Reed's May 10 product tier and entitlement model: three independent access tiers (viewer base, intelligence, roasting) mapped to existing infrastructure; reports as in-app intelligence content.

## Executive implementation thesis

Purveyors should present one clear hierarchy:

1. **Core product:** green coffee supply-chain intelligence for roasters, green buyers, coffee businesses, developers, API users, and agents.
2. **Primary surfaces:** analytics, catalog, chat/ask, CLI/API, reports, and decision workflows.
3. **Roasting complement:** Mallard Studio roasting tools, where roast history, tasting, inventory, and margin context layer onto the intelligence substrate for roasting-focused users.

The first implementation wave is intentionally frontend-first and no-backend. It should make the product thesis legible without deleting routes, changing schemas, faking persistence, or overclaiming what analytics can prove. Each PR must be independently mergeable if the rest of the program never ships.

## Locked decisions

- Purveyors is green coffee supply-chain intelligence first.
- Roasters remain primary users, but the product integrates with their existing infrastructure instead of competing as a generic roasting suite.
- Mallard Studio remains the only Studio name. Do not introduce Personal Studio, Roaster Studio, My Studio, or another Studio brand.
- Mallard Studio is a roasting context layer and workflow pack, not the umbrella product.
- Chat/Ask, GenUI, CLI-backed actions, and API-backed workflows are core intelligence capabilities, not Mallard-only features.
- Green coffee inventory (adding, searching, tracking sourcing candidates) is an Intelligence-tier feature, not a Roasting-tier exclusive. Roasting tables (roast logs, profiles, tasting in roasting context) are Roasting-tier only.
- Current inventory means owned-stock context. Researched, tracked, watched, compared, and shortlisted coffees require a future saved-object model.
- No non-persistent UI may claim saved/watch/shortlist/export success. Unsupported actions must route honestly, hand off to scoped chat honestly, be disabled previews, or be omitted.
- Viewer tier is a meaningful product floor, not a placeholder. It gates catalog and analytics access behind login intentionally. Anonymous access is deliberately limited.
- Do not leak power-user workflows into anonymous access. Viewer tier gets a comprehensive product taste; anonymous gets a minimal proof surface only.
- Navigation section IDs: `'intelligence' | 'roasting' | 'developer' | 'admin'`. The current `'core' | 'secondary'` grouping is replaced by this taxonomy in PR 01.
- Chat gate changes from `checkRole(role, 'member')` to `ppiAccess || checkRole(role, 'member')`. Intelligence and Roasting users both get chat; tool access within chat differs by tier.

## Entitlement model — mapping to existing infrastructure

No schema changes required for the core tier model. All three product tiers map to columns already in `user_roles`.

### Tier mapping

| Product tier | Maps to | Existing gate | What changes |
|---|---|---|---|
| **Viewer** (free base) | `role: viewer` | default | nothing — this is the free floor |
| **Intelligence** (analytics + reports) | `ppi_access: true` | already in `user_roles` | rebrand, reprice, add reports feature set |
| **Roasting** (roasting tools) | `role: member` | already in `user_roles` | rebrand, reprice |
| **Dev / API** | `api_plan` field | unchanged | nothing |

Intelligence and Roasting are fully independent addons. A user can have either, both, or neither.

### Reports tier and ppi_access

Reports is not a separate boolean in `user_roles`. The `ppi_access` boolean is the gate to the intelligence layer, which includes reports. The distinction between a reports-only subscriber and a full intelligence subscriber lives in `billing_subscriptions` (which product is active), not in `user_roles`.

- Reports subscription (cheaper) → sets `ppi_access = true`; UI shows reports features and basic intelligence analytics
- Intelligence subscription (full) → sets `ppi_access = true`; UI shows full analytics command center, sourcing chat tools, and reports
- Entitlement logic: `ppiAccess = true` means "you have some intelligence access"; specific feature depth is determined by subscription lookup when needed

This keeps `user_roles` clean with no new columns and follows the same entitlement resolution pattern already in `entitlements.ts`.

New Stripe SKUs needed: `reports.monthly`, `reports.annual` (same grants as ppi_addon: `ppiAccess: true`; product family: `'reports'`). Feature differentiation is handled in the UI and server load functions, not in the grants object.

### Chat tool access by tier

| Tool | Viewer | Intelligence (`ppiAccess`) | Roasting (`member`) |
|---|---|---|---|
| `coffee-catalog` | limited | ✓ | ✓ |
| `coffee-chunks` | — | ✓ | ✓ |
| `green-coffee-inv` | — | ✓ (add/search/track green coffees) | ✓ |
| `roast-profiles` | — | — | ✓ |
| `bean-tasting` | — | — | ✓ |

Intelligence chat access: green coffee sourcing, catalog research, market questions, sourcing briefs. Roasting chat access: all Intelligence tools plus roast planning, roast log updates, tasting loops, inventory drawdown, production history.

`chat/+page.server.ts` must be updated to pass `ppiAccess` through to the page, since it currently only returns `{ session, user, role }`.

### Upgrade prompt philosophy

**Viewer tier (free, logged in):** Strong, persistent conversion funnel. These users have committed interest by signing up. Upgrade prompts should be prominent and contextual throughout the analytics, catalog, and chat surfaces. Do not be subtle here.

**Paying users missing one tier:** Light, contextual, not overbearing. A roasting-only user who asks chat about market analytics gets a natural response: "I have intelligence tools available with the Intelligence subscription." A workspace type locked behind Roasting appears grayed out with a single short upgrade note. Do not repeat prompts or gate every interaction.

**Chat-native upgrade prompts:** When a user's question touches a capability they don't have, the chat response itself surfaces the upgrade path naturally — not a modal, not a banner, just a direct explanation within the response. This is the primary upgrade mechanism for chat.

**Anonymous (not logged in):** Minimal, catalog-focused. The goal is login conversion first, subscription second.

## Product tier descriptions

### Viewer (free, requires login)

The meaningful product floor. Viewer tier is intentionally gated behind login — anonymous access is deliberately limited to prevent scraping and preserve the value of catalog data.

**Viewer gets:**
- Full catalog browsing with comprehensive filters (significantly more than anonymous)
- Public analytics proof surface (basic pricing, availability, origin overview)
- Intelligence reports: read access to published reports in-app (daily/weekly/monthly)
- Basic API access (existing viewer `apiPlan`: 200 req/min, 25 rows/call)
- No individual saved data, no custom filtering preferences, no personalized surfaces

**Anonymous gets (much less):**
- ~20 coffees, 1–2 filters max
- Basic analytics overview only
- Blog/public content

**Viewer upgrade funnel:** The viewer experience should make the Intelligence and Roasting value obvious at every surface. The catalog shows what full filter access looks like. Analytics shows what the full command center contains. Chat shows limited capability with clear prompts toward Intelligence.

### Intelligence (paid, `ppiAccess: true`)

The core paid product. Includes the reports tier feature set and the full analytics command center.

**Intelligence adds:**
- Full analytics command center (all current PPI features: supplier comparison, health scoring, arrivals, delistings, origin benchmarks, price spread, extended trend depth)
- Sourcing-focused chat with `coffee-catalog`, `coffee-chunks`, and `green-coffee-inv` tools
- Green coffee inventory: add, search, and track sourcing candidates
- Catalog research tools, saved filtering preferences (future), personalized surfaces (future)
- Intelligence reports: full access — daily dashboard, weekly briefs, monthly deep dives

**Reports feature set within Intelligence:**
- **Daily:** live intelligence dashboard — CPI, new arrivals, delistings, price movement for the current day; structured like the existing PPI dashboard with streaming/refreshed data
- **Weekly:** curated sourcing brief — market read, top lots, supplier highlights; structured blog-style with interactive charts
- **Monthly:** deep intelligence report — origin trends, market thesis, longer-term analysis; fully structured with charts and narrative
- Email delivery: planned future addition; initial delivery is in-app only
- Content mix: deterministic data-driven scaffolding (price indexes, availability deltas) combined with AI-generated insight for non-obvious patterns and narrative

### Roasting (paid, `role: member`)

Independent addon. Can be purchased without Intelligence.

**Roasting adds:**
- Roast upload and logging
- Roast profile management and analysis
- Tasting notes and tasting loops
- Inventory tracking and drawdown
- Profit and margin analysis
- Roasting-focused chat tools (`roast-profiles`, `bean-tasting`)
- Roast-to-sourcing cross-analysis (roast history informing future sourcing decisions)

### Developer / API (separate axis, `api_plan` field)

Unchanged from current model. API plan pricing and rate limits remain as-is. No entitlement changes in this program.

## Navigation taxonomy

### Authenticated navigation sections

Replace current `'core' | 'secondary'` section IDs with:

```
Intelligence    — Analytics (/analytics), Catalog (/catalog), Chat/Ask (/chat)
Roasting        — Roast (/roast), Inventory (/beans), Profit (/profit)
Developer       — Parchment Console (/api-dashboard), Docs (/docs)
Admin           — Admin Dashboard (/admin) [admin-only, unchanged]
```

Account-level items (Subscription, Contact) move to the user/auth menu in the sidebar, not a main nav section.

### Visibility rules

- **Intelligence section:** visible to all authenticated users; items within it expand significantly for `ppiAccess` users vs. viewers
- **Roasting section:** visible to all authenticated users; items are locked/grayed for non-`member` users with a single upgrade note
- **Developer section:** visible to all authenticated users
- **Chat:** primary entry in Intelligence; both Intelligence and Roasting users get access; tool depth differs by tier

### Workspace types in chat

Current workspace types (general, sourcing, roasting, inventory, analysis) are half-baked and will be addressed in PR 06. For Roasting-specific workspace types (roasting, inventory), non-Roasting users see them grayed out with a short upgrade note. This is the natural upgrade discovery mechanism for the Roasting tier.

### NavSection type change

`appNavigation.ts` line 12 must update the `id` union:

```typescript
// Before
id: 'core' | 'secondary' | 'admin'

// After  
id: 'intelligence' | 'roasting' | 'developer' | 'admin'
```

## Analytics command center — product direction

The analytics page is the agentic intelligence layer made visible. The goal is not a better data dashboard — it is actionable intelligence that speaks to each user's specific context and converts observation into decision.

### Design principle: agentic intelligence over data display

The analytics surface should answer: "Given what the market is doing right now, what should this specific user do next?" That answer is different for a green coffee distributor tracking competitive supply than for a roaster hunting the best anaerobic lot available. The surface must adapt.

This is why chat is embedded beside analytics, not separate from it. Chat is the execution layer. Analytics provides the evidence; chat converts it to action.

### Above-the-fold priority order

1. **Market read / current state summary** — one concise headline: what is the green coffee supply chain doing today? Not a chart — a sentence or two with supporting signals.
2. **Scope and filter controls** — origin, process, supplier, availability, price range, time window. Promoted to the control plane of the investigation, not buried as chart settings.
3. **KPI movement strip** — compact signals: price delta, new arrivals count, delisting count, supplier coverage change. Numbers with direction, not charts.
4. **Insight cards** — "what changed, why it matters, what you can do" — before the user reaches raw charts. Short, evidence-backed, provenance-visible (sample counts, date range, supplier count).
5. **Charts and evidence modules** — the existing components (OriginLineChart, BarChart, ProcessDonut, PriceTierChart, SupplierComparison, SupplierHealth) become the expandable evidence layer below the decision surface.
6. **Contextual action rail** — ask, compare, watch, save, export/API, analyze against inventory. Honest capability gating per the capability matrix.

### Persona adaptability (future direction, not PR 03 scope)

The command center should eventually adapt to the user's primary context: a distributor surface emphasizes competitive supplier coverage and pricing spread; a roaster surface emphasizes buy opportunities, lot availability, and process breakdown. This is a future personalization layer that depends on saved user context. PR 03 builds the layout foundation; persona adaptation is post-program scope.

### Mobile layout

Stack order on small screens: market read → scope/filter sheet → KPI strip → insight cards → action drawer → charts. Do not bury the ask/action affordances below chart blocks. PR 03 manual test plan must verify this at 375px viewport.

## Implementation spine

1. **PR 01: Intelligence-first navigation taxonomy.** Establish the hierarchy without route changes or new behavior.
2. **PR 02: Dashboard becomes Intelligence Home.** Replace the generic launcher with a clear intelligence landing page using only existing data or copy/layout.
3. **PR 03: Analytics command-center layout pass.** Make analytics the working surface for market read, filters, insight hierarchy, evidence, and bounded action context.
4. **PR 04: Analytics action CTA primitive.** Add only honest action affordances according to the capability matrix.
5. **PR 05: Catalog-to-intelligence connective tissue.** Reframe catalog as the supply substrate behind analytics and sourcing decisions.
6. **PR 06: Mallard Studio boundary cleanup.** Keep roaster workflows useful, but frame them as personalization context for intelligence.

## Feature or program

Reframe Purveyors around green coffee supply-chain intelligence, market analytics, and decision support as the central product. Roasters remain primary users, but the product should not read as a roasting tool. It should read as a supplementary intelligence layer that integrates with existing roaster infrastructure and improves sourcing, market visibility, and green coffee decision quality.

Mallard Studio remains the personal roaster workspace name, but it is not the umbrella product. It is the context layer where a roaster's inventory, roast, tasting, and sales data can enrich the core green coffee supply-chain intelligence product.

The first implementation wave should avoid backend changes. It should clean up the front-end information architecture, naming, navigation, and decision/action affordances so the product stops presenting itself as a cluster of CRUD workspaces and starts presenting itself as a green coffee intelligence system with honest paths from analysis to action.

## Why now

The current product surface has two partially competing centers of gravity:

1. **Market intelligence / supply-chain buyer value:** catalog breadth, price movement, supplier coverage, analytics, proof, API, CLI, and agent-readable data.
2. **Roaster workspace value:** personal inventory, roast logging, tasting, profit, and chat over private operational data.

Both are valuable, but they are not the same product category. Treating them as one generic roasting application causes strategy blur. The navigation makes authenticated users bounce between Catalog, Market Data, Parchment Console, Inventory, Roast, Profit, and Chat as if each were an equal CRUD module. That makes the product look broader and less decisive than the underlying data moat actually is.

## Product segmentation thesis

### Segment A: green coffee supply-chain and market-intelligence users

**Job:** identify leverage, arbitrage, risk, supply shifts, pricing movement, supplier signals, and sourcing options across the green coffee market.

**Likely users:** roasters doing sourcing and procurement, green buyers, consultants, commercial roasters, procurement-minded operators, API/agent users, and eventually suppliers who want demand signals.

**Product promise:** Purveyors sees the market across suppliers and turns that fragmented supply into decision-grade intelligence.

**Core surfaces:** `/analytics`, `/catalog`, `/chat`, `/v1`, docs, CLI/API, reports, proof summaries, procurement brief patterns.

**Success feeling:** "I can understand where the market is moving and make a better sourcing decision faster than by checking supplier sites manually."

### Segment B: roasting-side users

**Job:** make better sourcing, inventory, roasting, tasting, and margin decisions using personal roasting context layered onto supply-chain intelligence.

**Likely users:** serious home roasters, micro-roasters, small roasting businesses, and power users who want to connect their own roasting data without replacing their existing infrastructure.

**Product promise:** Purveyors applies green coffee market intelligence to the coffees and decisions that matter to the user's own roasting operation.

**Core surfaces:** Mallard Studio inventory, roast, tasting, profit, existing saved/supported workflows, and roasting-context chat defaults layered onto the shared intelligence chat substrate.

**Success feeling:** "The market intelligence knows what I roast, what I've been buying, and what I should source next."

### Strategic implication

Mallard Studio should not be the umbrella product. It should remain the named personal roaster workspace that enriches the core intelligence product. The public and logged-in framing should center on green coffee supply-chain intelligence; Mallard Studio should be the mode for applying that intelligence to a user's own roasting context.

### Canonical naming map

- **Purveyors:** the platform and company surface.
- **Coffee intelligence / green coffee supply-chain intelligence:** broad product promise and marketing language.
- **Parchment Intelligence:** paid analytics and market-intelligence package where the product already uses that name.
- **Parchment API / Parchment CLI / Parchment Console:** developer, machine, and API-management surfaces.
- **Mallard Studio:** the personal roaster workspace only.
- **Chat / Ask:** route or entry labels for the shared assistant surface.

### Access and action capability matrix

| Verb | Current support | Access level | No-backend behavior | Future backend plan |
| --- | --- | --- | --- | --- |
| Ask about this | Possible only if routed to existing chat with honest scoped context | Intelligence or Roasting (ppiAccess or member) | Route to chat with visible scope in the prompt | Define analytics-to-chat state contract and tool mapping |
| Compare suppliers | Existing analytics modules support member-visible supplier comparison | Intelligence (ppiAccess) | Link to existing gated module or preview entitlement honestly | Expand comparison workflows only with server-side entitlement checks |
| Watch origin / segment | Not supported as persistent state | Future member workflow | Disabled preview or omit; never show watched/saved state | Saved watchlist or alert model |
| Save / shortlist sourcing candidate | Not generally supported | Future workflow | Disabled preview or route to an existing supported save action only | Saved sourcing object model |
| Export / API | API/docs/CLI surfaces exist | API tier / Intelligence depending on feature | Link to API docs, Parchment Console, or CLI instructions | Align export semantics with API tier and CLI contract |
| Analyze against my inventory | Requires signed-in inventory context | Roasting (member) | Route only where existing inventory-backed analysis exists | Shared tool contract combining catalog analytics with owned inventory |
| Draft sourcing brief | Future workflow | Intelligence / API / agent | Use clear future-language or route to chat as draft request | Backend-backed saved brief or agent workflow |

**Hard rule:** non-persistent CTAs must never claim saved state. They must route to an existing surface, open chat with explicit scoped context, or appear as disabled previews with future-language.

### Analytics-to-chat state contract

Before PR 04 is scoped, define this TypeScript interface:

```typescript
interface AnalyticsChatContext {
  origin: string | null;
  process: string | null;
  supplier: string | null;
  viewMode: 'retail' | 'wholesale' | 'all';
  timeWindow: string;
  activeFilters: Record<string, unknown>;
  visibleModules: string[];
  entitlement: 'viewer' | 'intelligence' | 'roasting' | 'both';
}
```

If this contract is not finalized before PR 04, the "ask about this" CTA will either route to chat with no context (useless) or invent ad hoc serialization (technical debt). This interface must be agreed on before PR 04 scope is finalized.

## Scope in / out

### In scope

- Front-end information architecture and language cleanup.
- Navigation hierarchy that makes analytics/intelligence primary and Mallard Studio/roasting secondary.
- `NavSection` type update: `'core' | 'secondary'` → `'intelligence' | 'roasting' | 'developer' | 'admin'`.
- Chat gate update: `checkRole(role, 'member')` → `ppiAccess || checkRole(role, 'member')`.
- `chat/+page.server.ts` updated to pass `ppiAccess` through to the page.
- Reframing `/dashboard` as an intelligence home rather than a generic app launcher, including replacing the "Unlock the full roastery workspace" upgrade CTA.
- Reframing `/analytics` as an analytics command center with insight hierarchy, filter/control-plane prominence, and contextual decision/action affordances.
- Adding decision/action affordances on analytics/catalog surfaces only where the capability matrix says backend support already exists, the action can route honestly, or the UI can safely degrade as a disabled preview.
- Reports content structure: daily dashboard, weekly brief, monthly deep dive — in-app presentation.
- Renaming and grouping existing cards/routes without changing underlying routes or data contracts.
- Tests that lock the new navigation/frame behavior. **Note:** no navigation label tests currently exist in the layout test suite. PR 01 must create `appNavigation.test.ts`, not update an existing file.

### Out of scope

- Database migrations or new `user_roles` columns. The entitlement model is handled within existing columns.
- New Stripe SKUs for reports (`reports.monthly`, `reports.annual`) — billing catalog addition is a separate task, not part of the front-end framing wave.
- New saved-search/watchlist/intent tables.
- New analytics queries or price-index backend endpoints.
- Entitlement model changes beyond the chat gate update.
- Removing inventory, roast, profit, or tasting routes.
- Building the full Procurement Brief, Intent Exchange, or Proof Layer.
- Email delivery for reports.
- Persona-adaptive analytics surfaces (future, depends on saved user context).
- GenUI runtime improvements (chat workspace types are acknowledged as half-baked; addressed in PR 06 framing only, not rebuilt).
- Public pricing/package changes.

## Proposed UX or behavior

The app should communicate three layers:

1. **Market Intelligence:** analytics, catalog, price movement, supplier coverage, proof, reports, and sourcing signals. This is the product center.
2. **Shared Chat, GenUI, and Decision Workflows:** ask, save, watch, compare, shortlist, export, or start a buying investigation. Core intelligence capabilities, not Studio-only affordances. Available to Intelligence and Roasting users with different tool depth.
3. **Mallard Studio / Roasting:** roast, tasting, inventory, and profit. The personal roaster context layer with roasting-focused chat defaults.

The logged-in dashboard should become an "Intelligence Home" with:

- A primary path into market analytics and reports.
- A secondary path into catalog discovery.
- A prominent intelligence chat / ask path for catalog research, comparisons, and sourcing questions.
- A preview of the analytics command-center pattern: market read, KPI/movement cards, and next-best investigation actions where existing data supports them (`recentArrivals` is already available server-side — use it).
- A tertiary "Mallard Studio" group for roast, inventory, and profit workflows.
- Copy that says personal roasting data enriches recommendations rather than defining the whole product.
- Upgrade CTAs specific to each tier (not the current generic "Unlock the full roastery workspace").

The analytics page should evolve toward a command-center layout (see above-the-fold priority order in the analytics section).

Navigation grouping:

- **Intelligence:** Analytics, Catalog, Chat/Ask
- **Roasting:** Roast, Inventory, Profit (locked/grayed for non-member users with upgrade note)
- **Developer:** Parchment Console, Docs
- **Account:** moved to user/auth sidebar menu, not a main nav section

## Current analytics baseline to preserve

PR 03 must begin from a current-state map of `/analytics`. The redesign should consolidate and prioritize existing modules, not recreate them as decorative dashboard chrome. Current capabilities to account for:

- Green coffee market intelligence framing
- Supplier, origin, and stocked-SKU stat strip
- Retail, wholesale, and all-market scope control
- Public price trends, processing mix, and origin price ranges
- Parchment Intelligence gating
- Supplier comparison, supplier health, arrivals, delistings, origin benchmarks, price spread, and longer-term trends

## Files or systems likely to change

- `src/lib/components/layout/appNavigation.ts` — NavSection type + section restructure
- `src/lib/components/layout/LeftSidebar.svelte`
- `src/lib/components/layout/MobileAppMenu.svelte`
- `src/lib/components/layout/MobileAppShell.svelte`
- `src/routes/dashboard/+page.svelte`
- `src/routes/catalog/+page.svelte`
- `src/routes/analytics/+page.svelte`
- `src/routes/chat/+page.server.ts` — pass `ppiAccess` through
- `src/routes/chat/+page.svelte` — update chat gate from `member` to `ppiAccess || member`
- Existing inventory route/components if copy currently frames green coffee inventory only as roast-log input
- `src/routes/analytics/page.svelte.test.ts`
- `src/lib/components/layout/appNavigation.test.ts` (new file — no existing nav label tests)
- Potentially a new presentational component under `src/lib/components/intelligence/` for reusable insight/action CTAs (decision deferred to PR 03)

## API or data impact

No backend API, schema, or database impact in the first wave.

The chat gate change (`ppiAccess || member`) is a frontend-only change: `chat/+page.svelte` reads the role and ppiAccess from the page load, which `chat/+page.server.ts` already has access to via `locals.safeGetSession()`. No new server endpoints.

Any decision/action affordance in this program must either:

1. Use an existing route/action/API safely, or
2. Be a non-persistent front-end CTA that routes to an existing surface, or
3. Be deferred to a later backend-backed plan.

## PR sequence

### PR 01: Intelligence-first navigation taxonomy

**Goal:** Change the authenticated navigation model so market intelligence is the primary category and Mallard Studio roaster workflows are grouped as personalization context.

**Why first:** The navigation frame is the product frame. This gives every later UI change a coherent destination without touching data flows.

**In scope:** Update `NavSection` type (`'core' | 'secondary'` → `'intelligence' | 'roasting' | 'developer' | 'admin'`). Update navigation data, sidebar/mobile labels, grouping, route descriptions. Move Chat to Intelligence as the primary entry. Move Parchment Console and Docs to Developer. Move Subscription and Contact to the auth/user menu. Lock Roasting items as visible-but-gated for non-member users. Update chat gate in `+page.server.ts` and `+page.svelte`. Write new `appNavigation.test.ts`.

**Out of scope:** Dashboard redesign, analytics page redesign, new decision/action affordances, route renames.

**Label decision:** The `/analytics` nav item label changes from "Market Data" to "Analytics" within the Intelligence group. `getCurrentRouteLabel()` updates accordingly; this affects the mobile page title.

**Stop point:** If only this PR ships, the app already communicates a clearer product hierarchy.

**Acceptance criteria:**
- Authenticated desktop navigation has Intelligence, Roasting, Developer sections.
- Roasting items are visible but locked/grayed for non-member users with a single upgrade note.
- Chat appears in Intelligence, not Roasting. Non-member viewers without ppiAccess see chat as locked.
- Mobile navigation uses the same taxonomy.
- Existing role/member/admin visibility behavior is preserved for items that remain gated.
- Nav item does NOT appear in the wrong section (test both presence and absence).
- The `NavSection` id type union is updated.
- `chat/+page.server.ts` passes `ppiAccess` to the page.
- `chat/+page.svelte` gate is `ppiAccess || checkRole(role, 'member')`.
- New `appNavigation.test.ts` covers: section IDs, item membership per section, chat placement, Roasting lock state for viewer.

**Test plan:**
- `pnpm test -- src/lib/components/layout`
- `pnpm check --fail-on-warnings`
- Manual inspect `/dashboard`, `/analytics`, `/catalog`, `/beans`, `/roast`, `/profit`, `/api-dashboard`, `/chat` on desktop and 375px mobile viewport.

**Risks:**
- Label churn can become bikeshedding. Mitigation: keep labels descriptive and reversible.
- `getCurrentRouteLabel()` is used for the mobile header title — verify all routes still resolve correctly after the label changes.
- Acknowledged inconsistency: chat workspace types (roasting, inventory) still appear inside chat for Intelligence-only users until PR 06. This is an accepted gap, not a regression.

### PR 02: Dashboard becomes Intelligence Home

**Goal:** Rewrite `/dashboard` from a quick-start grid into an intelligence-oriented home with primary analytics/reports paths and a secondary Mallard Studio group.

**Why second:** Once nav hierarchy is settled, the logged-in landing page should reinforce the same mental model.

**In scope:** Dashboard copy/layout, card grouping, member/viewer states, upgrade CTAs specific to Intelligence and Roasting (replacing the current "Unlock the full roastery workspace" language), tests. The `recentArrivals` data is already available server-side — use it in the Intelligence Home preview. Add an intelligence chat / ask path clearly for catalog research and sourcing questions, not roast operations.

**Copy targets (before → after):**
- Tagline: "your logged-in home for jumping into sourcing, roasting, and the rest of the app" → "your intelligence home for green coffee supply-chain research, market analytics, and sourcing decisions"
- Upgrade CTA headline: "Unlock the full roastery workspace" → tier-specific: "Unlock the Intelligence layer" / "Unlock roasting tools"
- Dashboard label: "Quick start" → "Get started" or remove the section label entirely in favor of grouped cards

**Out of scope:** New backend data, new analytics widgets, persistent saved objects, fake KPI cockpit content.

**Stop point:** Logged-in users understand the product center and how personal roasting data fits.

### PR 03: Analytics command-center layout pass

**Goal:** Rework `/analytics` information hierarchy around the above-the-fold priority order: market read → scope controls → KPI strip → insight cards → evidence charts → action rail.

**Why third:** The analytics layout must exist before scattered action buttons are placed on it.

**In scope:** Current-state audit of existing analytics modules (OriginLineChart, OriginBarChart, ProcessDonutChart, PriceTierChart, SupplierComparisonTable, SupplierHealthTable), layout-only and copy-first refactor using existing analytics data and chart components. Add reusable presentational shells only if they reduce repeated structure across dashboard and analytics. Decision on whether to establish `src/lib/components/intelligence/` directory belongs here.

**Above-the-fold requirement:** On a 1280px desktop viewport, the visible area must contain: (1) market read headline, (2) scope controls, (3) KPI strip. Insight cards appear immediately on first scroll. Charts are below insight cards.

**Out of scope:** New analytics queries, persisted watchlists, saved briefs, notification logic, entitlement changes, new backend-backed actions.

**Mobile test plan:** Manual verify at 375px viewport that market read, scope filter sheet, and at least one insight card are visible before any chart block.

**Stop point:** `/analytics` becomes the visual and functional center of the product even before backend-backed action state ships.

### PR 04: Analytics action CTA primitive

**Goal:** Add a small reusable decision/action CTA primitive per the capability matrix, only for "ask about this", "compare suppliers", "watch origin", "save sourcing question", or "analyze against inventory".

**Pre-condition:** The analytics-to-chat state interface (`AnalyticsChatContext`) must be defined and agreed on before this PR is scoped. See the interface definition in the entitlement model section.

**Why after layout:** The command-center layout defines where actions belong.

**In scope:** Reusable CTA component, minimal analytics placements, safe disabled/login/member states, explicit future-language for unsupported actions, test coverage.

**Out of scope:** Saved searches, alerts, intent tables, notifications, server persistence, any UI state that claims an unsupported action succeeded.

**Stop point:** Analytics has honest action affordances without pretending persistence exists.

### PR 05: Catalog-to-intelligence connective tissue

**Goal:** Adjust catalog copy and CTAs so the catalog reads as the supply substrate behind intelligence decisions.

**Why after analytics:** Catalog should support the analytics thesis once the command-center frame is visible.

**In scope:** Catalog hero/empty-state/CTA copy, link paths into analytics, member prompts for shortlist/watch/analyze workflows where safely non-persistent.

**Specific copy targets:** Catalog subtitle "Browse live coffee inventory and compare sourcing options" — revise to position catalog as the supply layer behind market intelligence, not a shopping browser.

**Test plan:** New or updated test covering catalog hero copy and at least one analytics link path.

**Out of scope:** New filters, entitlement changes, backend query changes.

**Stop point:** Catalog and analytics tell the same product story.

### PR 06: Mallard Studio boundary cleanup

**Goal:** Make roasting route labels and dashboard paths read as Mallard Studio personalization context, not the primary product suite. Address chat workspace type framing for non-Roasting users.

**Why after catalog:** This is the delicate part — should come after the intelligence frame is visible so the change feels like clarification, not demotion.

**In scope:** Copy and grouping on existing Mallard Studio routes, route cards, dashboard descriptions, and helper text explaining how roasting context improves sourcing recommendations. Chat workspace types: roasting/inventory types grayed out for non-member users with a short upgrade note (not rebuilt, just framed). Reframe green coffee inventory route as owned-stock context for intelligence.

**Out of scope:** Removing routes, rebuilding forms, changing CRUD behavior, backend schema, rebuilding GenUI or workspace type logic.

**Stop point:** Mallard Studio workflows remain fully usable but are strategically subordinated to intelligence.

## Acceptance criteria for the whole program

- The product reads as green coffee supply-chain intelligence first, not a generic roaster CRUD suite.
- Analytics and catalog become the obvious primary surfaces for both logged-out and logged-in users.
- Mallard Studio / Roasting workflows remain accessible but are framed as roasting context and complement.
- Chat, CLI-backed actions, and GenUI are framed as core intelligence capabilities with optional roasting-specific defaults.
- Green coffee inventory reads as a sourcing research tool (Intelligence tier), not only as a roast-log input.
- `/analytics` reads as a command center with visible market read, scope controls, insight hierarchy, evidence modules, and contextual ask/action affordances.
- No backend migration is required for the front-end framing wave through PR 04.
- Every PR is independently mergeable and useful if the program pauses.
- Navigation, dashboard, analytics, and catalog copy use the same category language.
- Tests protect the new IA enough that future feature additions do not silently flatten everything back into peer CRUD modules.
- The `AnalyticsChatContext` interface is defined and agreed on before PR 04 begins.

## Risks and rollback

- **Risk: overcorrecting away from roasters.** Mitigation: preserve Mallard Studio as a valuable roasting complement, not a deprecated feature set. Roasters remain primary users; the product differentiates around green coffee supply-chain intelligence.
- **Risk: decision/action scaffolding feels fake without persistence.** Mitigation: only add CTAs that route to real existing surfaces or clearly say what will happen; do not imply saved state unless it exists.
- **Risk: naming sprawl.** Mitigation: use the canonical naming map. Do not add new Studio names or new intelligence product brands in this program.
- **Risk: backend pressure creeps in.** Mitigation: the front-end framing wave through PR 04 must pass the mergeable-slice gate without DB or API changes. Anything needing persistence, alerting, exports, inventory matching, or entitlement changes becomes a separate backend-backed plan.
- **Risk: chat gate change breaks existing member experience.** Mitigation: the change is additive (`ppiAccess || member`); existing member users are unaffected. Test both paths explicitly in PR 01.
- **Risk: acknowledged inconsistency in chat workspace types.** Workspace types (roasting, inventory) remain visible inside chat for Intelligence-only users until PR 06. This is a known gap, documented here, not a regression.

Rollback is straightforward for PR 01 and PR 02: revert copy/navigation changes. No data migrations or API changes are involved.

## Resolved decisions

1. Keep **Mallard Studio** as the only Studio name.
2. Keep existing core product names and categories. Work "intelligence" into IA and product copy without inventing a new formal brand.
3. Treat the core product as green coffee supply-chain intelligence first.
4. Parchment Intelligence remains the paid analytics package name unless a separate naming decision supersedes it.
5. Navigation section IDs: `'intelligence' | 'roasting' | 'developer' | 'admin'`.
6. Chat gate: `ppiAccess || checkRole(role, 'member')`. Intelligence users get sourcing-focused chat; Roasting users get roasting-focused chat; both use the shared substrate.
7. Green coffee inventory is an Intelligence-tier tool (sourcing research), not Roasting-tier exclusive.
8. `ppi_access` boolean remains the intelligence gate; no new `user_roles` column needed for reports. Reports subscription sets `ppi_access = true`; feature depth differentiated by subscription lookup in `billing_subscriptions`.
9. Viewer tier is a meaningful product floor with intentional login gating. Anonymous access is deliberately limited.
10. Upgrade prompts: strong and persistent for viewer tier; contextual and light for paying users missing one tier.
11. Reports content: in-app from launch (daily live dashboard, weekly brief, monthly deep dive); email delivery is a future addition.
12. Analytics-to-chat state contract must be defined as a TypeScript interface before PR 04 is scoped.
13. Workspace types in chat (roasting, inventory) grayed out for non-Roasting users with a short upgrade note. Not rebuilt in this program; addressed in PR 06 framing only.

## Remaining open items

1. **`AnalyticsChatContext` interface:** needs to be written and agreed on before PR 04. Draft in the resolved decisions section above; finalize as a committed type before PR 04 scope is locked.
2. **Reports billing SKUs:** `reports.monthly` and `reports.annual` Stripe SKUs with `productFamily: 'reports'` and `grants: { ppiAccess: true }`. This is a separate billing catalog task, not part of the front-end framing wave.
3. **Persona-adaptive analytics surface:** deferred to post-program. The command center layout (PR 03) should be built with adaptability in mind but not implement persona switching.
