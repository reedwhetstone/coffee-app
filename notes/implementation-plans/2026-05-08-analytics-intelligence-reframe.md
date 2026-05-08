# Analytics Intelligence Reframe Program

**Date:** 2026-05-08
**Mode:** multi-stage implementation plan
**Status:** Proposed

## Feature or program

Reframe Purveyors around market analytics and coffee intelligence as the central product, while demoting Mallard Studio from the primary product frame into an optional personalization layer for roasters who want to connect their own inventory, roast, tasting, and sales context.

The first implementation wave should avoid backend changes. It should clean up the front-end information architecture, naming, navigation, and analytics capture primitives so the product stops presenting itself as a cluster of CRUD workspaces and starts presenting itself as an intelligence system with native capture points.

## Why now

The current product surface has two partially competing centers of gravity:

1. **Market intelligence / supply-chain buyer value:** catalog breadth, price movement, supplier coverage, analytics, proof, API, CLI, and agent-readable data.
2. **Roaster workspace value:** personal inventory, roast logging, tasting, profit, and chat over private operational data.

Both are valuable, but they are not the same buyer. Treating them as one generic application causes strategy blur. The navigation makes authenticated users bounce between Catalog, Market Data, Parchment Console, Inventory, Roast, Profit, and Chat as if each were an equal CRUD module. That makes the product look broader and less decisive than the underlying data moat actually is.

Reed's May 8 direction sharpens the thesis: less CRUD theater, more analysis, native capture. That means the primary product should be market intelligence. Personal roaster data should become an enhancer that makes intelligence more relevant, not the main thing the whole product claims to be.

## Product segmentation thesis

### Segment A: supply-chain and market-intelligence buyers

**Job:** identify leverage, arbitrage, risk, supply shifts, pricing movement, and supplier signals across the green coffee market.

**Likely users:** green buyers, consultants, commercial roasters, procurement-minded operators, API/agent users, and eventually suppliers who want demand signals.

**Product promise:** Purveyors sees the market across suppliers and turns that fragmented supply into decision-grade intelligence.

**Core surfaces:** `/analytics`, `/catalog`, `/v1`, docs, CLI/API, proof summaries, procurement brief patterns, future intent matching.

**Success feeling:** "I can understand where the market is moving and make a better sourcing decision faster than by checking supplier sites manually."

### Segment B: roaster-side personalization buyers

**Job:** make better buy, roast, tasting, and margin decisions using personal context.

**Likely users:** serious home roasters, micro-roasters, small roasting businesses, and power users who want to connect their own data.

**Product promise:** Purveyors applies market intelligence to the coffees and decisions that matter to the user's own inventory and operations.

**Core surfaces:** inventory, roast, tasting, profit, chat, personal recommendations, captured shortlist/coffees, future watchlists.

**Success feeling:** "The market intelligence knows what I own, what I roast, what I sell, and what I should buy next."

### Strategic implication

Mallard Studio should not be the umbrella product. It should become the personalized workspace or add-on that enriches the core intelligence product. The public and logged-in framing should center on analytics/intelligence; Studio should be a mode for applying that intelligence to a user's own coffee context.

## Strategy Alignment Audit

- **Canonical direction:** Strongly aligned with `notes/PRODUCT_VISION.md`: Purveyors is a coffee intelligence platform, not a marketplace and not a roast logger. This plan makes that hierarchy visible in the front end.
- **Product principle supported:** "Intelligence should replace navigation where possible" and "the data moat matters more than feature sprawl." The plan reduces equal-weight CRUD navigation and elevates analysis, capture, and decision workflows.
- **Cross-surface effect:** Near-term work is web-first, but it aligns with API/CLI direction by treating intelligence as the shared product surface and personal data as contextual enrichment. No backend API contract changes in the first wave.
- **Public value legibility:** High. The first PRs make logged-out and logged-in users understand that the analytics and catalog are the product thesis, while authenticated CRUD features are personalization paths.
- **Moonshot check:** Informed by `2026-04-07-procurement-brief` and `2026-05-07-purveyors-coffee-intent-exchange`. The proving slice selected here is not a full brief or exchange; it is the lower-risk front-end framing and capture surface that makes those future products coherent.
- **Scope check:** Explicitly excludes backend migrations, new entitlement logic, new intent tables, automated supplier contact, new analytics data sources, or a full route rewrite. It does not remove existing CRUD workflows yet.

## Scope in / out

### In scope

- Front-end information architecture and language cleanup.
- Navigation hierarchy that makes analytics/intelligence primary and Studio/personal operations secondary.
- Reframing `/dashboard` as an intelligence home rather than a generic app launcher.
- Adding native capture affordances on analytics/catalog surfaces for "watch this", "compare this", "save to shortlist", or "ask about this" as UI scaffolding only where backend support already exists or can safely degrade.
- Renaming and grouping existing cards/routes without changing underlying routes or data contracts.
- Tests that lock the new navigation/frame behavior.

### Out of scope

- Database migrations.
- New saved-search/watchlist/intent tables.
- New analytics queries or price-index backend endpoints.
- Entitlement model changes beyond existing gates.
- Removing inventory, roast, profit, or tasting routes.
- Building the full Procurement Brief, Intent Exchange, or Proof Layer.
- Public pricing/package changes.

## Proposed UX or behavior

The app should communicate three layers:

1. **Market Intelligence:** analytics, catalog, price movement, supplier coverage, proof, and sourcing signals. This is the product center.
2. **Capture and Decision Workflows:** save, watch, compare, ask, shortlist, export, or start a buying investigation. These are the verbs that turn analytics into action.
3. **Personal Studio:** inventory, roast, tasting, profit, and personal chat. This is optional context that makes recommendations and analysis more personalized.

The logged-in dashboard should become an "Intelligence Home" with:

- a primary path into market analytics;
- a secondary path into catalog discovery;
- a tertiary "Personal Studio" group for inventory, roast, tasting/profit, and chat;
- copy that says personal data enriches recommendations rather than defining the whole product;
- clear prompts like "watch this origin", "compare suppliers", "save a sourcing candidate", or "analyze against my inventory" where those actions can be safely stubbed or linked to existing flows.

Navigation should stop implying all modules are peers. A rough grouping:

- **Intelligence:** Market, Catalog, API/CLI docs or Parchment Console.
- **Personalization:** Inventory, Roast, Profit, Chat.
- **Admin:** operational-only tools.

The naming should avoid making Mallard Studio the public umbrella. If Mallard Studio remains, use it as the personal workspace label only.

## Files or systems likely to change

- `src/lib/components/layout/appNavigation.ts`
- `src/lib/components/layout/LeftSidebar.svelte`
- `src/lib/components/layout/MobileAppMenu.svelte`
- `src/lib/components/layout/MobileAppShell.svelte`
- `src/routes/dashboard/+page.svelte`
- `src/routes/catalog/+page.svelte`
- `src/routes/analytics/+page.svelte`
- `src/routes/analytics/page.svelte.test.ts`
- `src/lib/components/layout/*.test.ts`
- Potentially a new presentational component under `src/lib/components/intelligence/` for reusable insight/capture CTAs.

## API or data impact

No backend API, schema, or database impact in the first wave.

Any capture affordance in this program must either:

1. use an existing route/action/API safely, or
2. be a non-persistent front-end CTA that routes to an existing surface, or
3. be deferred to a later backend-backed plan.

The plan intentionally keeps the first implementation mergeable without backend risk.

## Program rationale

This should be a multi-stage program, not one giant PR. The work touches shared navigation, dashboard framing, catalog copy, analytics CTAs, and tests. Each slice should be independently mergeable and useful if later slices never ship.

## PR sequence

### PR 01: Intelligence-first navigation taxonomy

**Goal:** Change the authenticated navigation model so market intelligence is the primary category and personal roaster workflows are grouped as personalization/studio.

**Why first:** The navigation frame is the product frame. This gives every later UI change a coherent destination without touching data flows.

**In scope:** Update navigation data, sidebar/mobile labels, grouping, route descriptions, and tests.

**Out of scope:** Dashboard redesign, analytics page redesign, new capture actions.

**Stop point:** If only this PR ships, the app already communicates a clearer product hierarchy.

### PR 02: Dashboard becomes Intelligence Home

**Goal:** Rewrite `/dashboard` from a quick-start grid into an intelligence-oriented home with primary analytics/catalog paths and a secondary Personal Studio group.

**Why second:** Once nav hierarchy is settled, the logged-in landing page should reinforce the same mental model.

**In scope:** Dashboard copy/layout, card grouping, member/viewer states, tests.

**Out of scope:** New backend data, new analytics widgets, persistent saved objects.

**Stop point:** If the program stops here, logged-in users understand the product center and how personal data fits.

### PR 03: Analytics capture scaffolding

**Goal:** Add front-end capture/decision CTAs to analytics without persistence: "compare suppliers", "watch origin", "save sourcing question", "ask about this trend" as routed/stubbed actions that do not pretend to save server state.

**Why third:** This turns analytics from passive charts toward native decision capture while avoiding backend changes.

**In scope:** Reusable capture CTA component, analytics page placements, safe disabled/login/member states, test coverage.

**Out of scope:** Saved searches, alerts, intent tables, notifications.

**Stop point:** If the program stops here, analytics feels more like an intelligence workflow even before persistence exists.

### PR 04: Catalog-to-intelligence connective tissue

**Goal:** Adjust catalog copy and CTAs so the catalog reads as the supply substrate behind intelligence, not a standalone shopping/browser grid.

**Why fourth:** Catalog should support the analytics thesis and Personal Studio add-on story.

**In scope:** Catalog hero/empty-state/CTA copy, link paths into analytics, member prompts for shortlist/watch/analyze workflows where safely non-persistent.

**Out of scope:** New filters, entitlement changes, backend query changes.

**Stop point:** Catalog and analytics now tell the same product story.

### PR 05: Personal Studio boundary cleanup

**Goal:** Make inventory/roast/profit/chat labels and dashboard paths read as personalization context, not the primary product suite.

**Why fifth:** This is the delicate part. It should come after the intelligence frame is visible so the change feels like clarification, not feature demotion.

**In scope:** Copy and grouping on existing personal routes, route cards, dashboard descriptions, maybe small helper text explaining how personal data improves recommendations.

**Out of scope:** Removing routes, rebuilding forms, changing CRUD behavior, backend schema.

**Stop point:** Personal workflows remain usable but are strategically subordinated to intelligence.

## Recommended first PR

Start with **PR 01: Intelligence-first navigation taxonomy**.

It is the cleanest mergeable slice, has no backend dependency, is easy to verify, and it changes the product frame without overcommitting to capture persistence. It also forces the team to name the categories before rewriting half the UI.

## Atomic PR plan: PR 01

### PR goal

Refactor the authenticated navigation taxonomy so Purveyors presents market intelligence as the primary product surface and personal roaster workflows as a personalization/studio layer.

### Why this slice comes now

This is the lowest-risk change that directly expresses the strategic pivot. It prepares the dashboard and analytics changes without requiring backend work.

### In-scope

- Update navigation labels/groups in `appNavigation.ts` or equivalent source of truth.
- Group Analytics/Market Data and Catalog under an intelligence category.
- Group Inventory/Roast/Profit/Chat under a personal studio or personalization category.
- Keep Parchment Console/API in the intelligence/platform group, not buried as a generic utility.
- Ensure left sidebar and mobile shell render the new groups consistently.
- Update relevant tests.

### Out-of-scope

- Removing routes.
- Renaming URL paths.
- Changing permissions or entitlements.
- Adding saved searches, alerts, or persistent capture.
- Rewriting dashboard content.

### Files to change

- `src/lib/components/layout/appNavigation.ts`
- `src/lib/components/layout/LeftSidebar.svelte`
- `src/lib/components/layout/MobileAppMenu.svelte`
- `src/lib/components/layout/MobileAppShell.svelte`
- Existing layout navigation tests.

### Acceptance criteria

- Authenticated desktop navigation has a clear Intelligence grouping.
- Personal roaster workflows are grouped separately and do not appear as peer products to analytics/catalog.
- Mobile navigation uses the same taxonomy.
- Existing role/member/admin visibility behavior is preserved.
- No route URLs or backend data loads change.
- Tests cover the new grouping labels and at least one member/non-member visibility path.

### Test plan

- `pnpm test -- src/lib/components/layout`
- `pnpm check`
- Manual inspect `/dashboard`, `/analytics`, `/catalog`, `/beans`, `/roast`, `/profit`, `/api-dashboard` on desktop and mobile viewport.

### Risks

- Label churn can become product bikeshedding. Mitigation: keep labels descriptive and reversible.
- Existing tests may assert old labels. Update intent, not just snapshots.
- Users relying on familiar navigation could be briefly disoriented. Mitigation: keep route names recognizable under clearer groups.

### Exact follow-on dependency

PR 02 should only begin after PR 01 lands or its taxonomy is accepted, because dashboard copy should reuse the same category names.

## Acceptance criteria for the whole program

- The product reads as coffee market intelligence first, not a generic roaster CRUD suite.
- Analytics and catalog become the obvious primary surfaces for both logged-out and logged-in users.
- Personal workflows remain accessible but are framed as context and personalization.
- No backend migration is required for the first three PRs.
- Every PR is independently mergeable and useful if the program pauses.
- Navigation, dashboard, analytics, and catalog copy use the same category language.
- Tests protect the new IA enough that future feature additions do not silently flatten everything back into peer CRUD modules.

## Risks and rollback

- **Risk: overcorrecting away from roasters.** Mitigation: preserve Personal Studio as a valuable add-on, not a deprecated feature set.
- **Risk: capture scaffolding feels fake without persistence.** Mitigation: only add CTAs that route to real existing surfaces or clearly say what will happen; do not imply saved state unless it exists.
- **Risk: naming sprawl.** Mitigation: choose one taxonomy and reuse it everywhere. Avoid adding new brands unless necessary.
- **Risk: backend pressure creeps in.** Mitigation: first three PRs must pass the mergeable-slice gate without DB or API changes.

Rollback is straightforward for PR 01 and PR 02: revert copy/navigation changes. No data migrations or API changes are involved.

## Open questions for Reed

1. Should the personal add-on be called **Personal Studio**, **Roaster Studio**, **My Studio**, or keep **Mallard Studio** as a sub-brand?
2. Should the primary nav label be **Market Intelligence**, **Coffee Intelligence**, or simply **Intelligence**?
3. For capture scaffolding, should we prefer honest disabled previews for future "watch/save" actions, or avoid nonfunctional controls entirely until persistence exists?
4. Is Parchment Intelligence still the paid analytics package name, or should that name collapse into the broader Purveyors Intelligence positioning?
