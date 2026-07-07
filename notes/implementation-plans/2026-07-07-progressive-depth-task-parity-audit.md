# Progressive Depth With Task Parity Audit

**Date:** 2026-07-07

**Related ADR:** `notes/decisions/009-progressive-depth-task-parity.md`

## Executive Read

Coffee-app is partially aligned with ADR-009. The strongest surface is the Market Index: it now starts with a market read, preserves global scope controls, renders question-led value signals, keeps evidence and action close together, and publishes the page context into chat. The app is weaker at enforcing the pattern systematically. Several dense charts and tables still rely on generic responsive wrapping or horizontal overflow instead of mobile-native representations and task-based QA.

Overall rating: **3.1 / 5**

- Market Index: **4.0 / 5**
- Catalog and CoffeeCard detail: **3.8 / 5**
- Portfolio/watchlist: **3.4 / 5**
- Roast analytics: **2.8 / 5**
- Profit analytics: **2.4 / 5**
- API dashboard and usage: **2.8 / 5**
- Chat/canvas analytical blocks: **3.3 / 5**
- Cross-app QA standard: **1.8 / 5**

## Evidence Snapshot

Positive evidence:

- Market Index starts with a decision-oriented read and scoped controls: `src/lib/components/analytics/sections/MarketReadSection.svelte:45`.
- Scope and movement window feed the whole analytics context, including the chat handoff: `src/routes/analytics/+page.svelte:764`.
- Market Index insight cards include title, body, and evidence: `src/routes/analytics/+page.svelte:724`.
- Evidence charts use progressive expansion panels instead of forcing all density upfront: `src/lib/components/analytics/sections/EvidenceChartsSection.svelte:68`.
- Value signals ask the correct user question and link to catalog action: `src/lib/components/analytics/sections/ValueSignalsSection.svelte`.
- Portfolio now uses CoffeeCard detail pop-outs and watchlist lots: `src/routes/beans/+page.svelte:520`.

Negative evidence:

- Supplier comparison is still fundamentally a table in horizontal overflow, not a mobile-native card or drill-in representation: `src/lib/components/analytics/SupplierComparisonTable.svelte:107`.
- Evidence chart modules define visual containers but not mobile summary/anomaly/source/action contracts: `src/lib/components/analytics/sections/EvidenceChartsSection.svelte:84`.
- Profit charts expose many filters and chart modes, but the mobile task path is not explicitly separated from desktop density: `src/routes/profit/SalesChart.svelte:69`.
- Portfolio summary is useful, but the source distribution and row/card flow are not framed as anomaly, explanation, source, and next action: `src/routes/beans/+page.svelte:599`.
- There is no shared module contract or test helper for ADR-009 task parity.

## Surface Audit

### Market Index

Rating: **4.0 / 5**

What is aligned:

- The page starts with "what happened" before charts.
- Scope controls apply across charts.
- Value signals, market movement, metadata trends, supplier movement, and chat handoff are organized as decision modules.
- Public vs Intelligence gates generally describe the added decision depth instead of blurring fake data.

Gaps:

- Chart components do not expose explicit small-screen variants; many still rely on SVG scaling and container heights.
- Supplier comparison and arrivals/delistings tables are still table-first below the visual read.
- QA is not expressed as tasks such as "On mobile, identify the largest weekly move, inspect evidence, and ask chat with context."

Required standard:

- Every Market Index section should become an `InsightModule`-style implementation with overview, anomaly, explanation, source, action, desktop view, mobile view, and QA task.
- Tables must render as card/drill-in views on small screens.

### Catalog And CoffeeCard Detail

Rating: **3.8 / 5**

What is aligned:

- CoffeeCard provides progressive detail tabs and source/proof signals.
- Catalog can open a deep-linked lot detail panel.
- Filter state can publish context into chat.
- Watchlist tracking gives the user an action after judging a lot.

Gaps:

- Filter controls are comprehensive, but the mobile refinement model is not separately specified.
- Price context, proof, process transparency, and similar-lot matching need a declared mobile decision path: overview, why this lot matters, evidence, action.
- Catalog result density is card-based, but "which lot should I inspect next?" is not always surfaced as an anomaly/priority signal.

Required standard:

- Define catalog modules for "find candidate lots," "trust process/proof," "compare price context," and "track or ask."
- Add a mobile filter sheet/scoped-refinement design before adding new advanced filters.

### Portfolio And Watchlist

Rating: **3.4 / 5**

What is aligned:

- Portfolio now uses canonical CoffeeCard detail pop-outs for purchased and bookmarked lots.
- Watchlist annotations show price movement and delisting status.
- Summary tiles expose portfolio value, purchased weight, remaining weight, average cost, and stocked status.

Gaps:

- The page still reads as a dashboard plus cards rather than a procurement decision sequence.
- Source distribution is a simple grid summary, not an insight module.
- Mobile users can see the data, but there is no first-class task path for "what should I roast next," "what should I replace," or "which tracked lot changed enough to act."

Required standard:

- Promote watchlist/portfolio anomalies to the top: depleted lots, delisted tracked lots, price drops, high-value remaining lots.
- Add actions from those reads: roast this, replace via catalog, ask about alternatives, or untrack.

### Roast Analytics

Rating: **2.8 / 5**

What is aligned:

- Roast page has summary metrics and batch grouping.
- Chart loading is deferred, which helps first comprehension.
- Roast profile selection and URL state support direct profile review.

Gaps:

- Live roast and saved roast review are blended in one dense surface.
- Mobile monitoring may work visually, but the decision path is not formal: monitor phase, spot anomaly, inspect event/source, adjust or save.
- The roast chart has no documented small-screen summary mode or mobile QA task.

Required standard:

- Split the roast surface into two task modes: live roast control and saved profile analysis.
- Mobile saved-profile view should prioritize phase summary, event anomalies, weight loss, and notes before full chart density.
- Live roast mobile should be explicitly tested for control reachability and non-overlap.

### Profit Analytics

Rating: **2.4 / 5**

What is aligned:

- Profit page has KPI tiles and two charts.
- Sales chart supports metric, date, purchase-date, and wholesale/retail filtering.
- Performance chart supports cumulative, monthly, and margin modes.

Gaps:

- The charts are dense desktop-style analytical widgets.
- Mobile users need a clear triage path: is margin healthy, which coffee is driving it, what sale or cost explains it, and what to do next.
- Current filters are chart controls, not mobile scoped refinement.
- There is no source/evidence summary near the KPIs explaining whether missing sales, missing costs, or stale rows make the read trustworthy.

Required standard:

- Reframe profit around task modules: margin health, sell-through risk, top/bottom lot performance, revenue over time.
- Add mobile cards for top/bottom drivers before charts.
- Add drill-in from KPI/card to sale rows and lot detail.

### API Dashboard And Usage

Rating: **2.8 / 5**

What is aligned:

- Console surfaces are operationally important and likely simpler than market analytics.
- Key-management actions are direct.

Gaps:

- Usage and entitlement views still need task-parity review: "am I near a limit," "which key is risky," "what action should I take."
- Mobile-native representations for usage tables and key lists should be explicit.

Required standard:

- Treat usage as an analytical module with status, anomaly, evidence, action.
- Turn key/usage tables into cards or row drill-ins on small screens.

### Chat And Canvas Blocks

Rating: **3.3 / 5**

What is aligned:

- Analytics pages publish current context into chat.
- Market signal blocks can produce tables/cards from tool output.
- Chat is a natural progressive-depth escape hatch for mobile users.

Gaps:

- Canvas block schemas do not yet encode ADR-009 module metadata.
- Generated blocks can still become generic data tables without mobile-specific representation.

Required standard:

- Add module metadata to analytical blocks: user question, evidence, action.
- Prefer cards/summaries for mobile and allow table expansion when the user asks for density.

## Implementation Plan

### PR 1: Add The Task-Parity Module Contract

Goal: create the shared language and light technical substrate before changing UI behavior.

Scope:

- Add an `InsightModuleContract` type near analytics/shared UI code.
- Fields: `id`, `surface`, `userQuestion`, `decision`, `overview`, `anomaly`, `explanation`, `source`, `primaryAction`, `desktopRepresentation`, `mobileRepresentation`, `qaTask`.
- Add a small `InsightModuleFrame` or equivalent helper only if it reduces duplication in Market Index sections.
- Add documentation in `notes/UI-FRAMEWORK.md` or a focused `notes/implementation-plans/*` companion if the code contract is too early.

Acceptance:

- At least three Market Index modules instantiate the contract.
- Existing visuals still render unchanged or near-unchanged.
- Tests cover contract shape and rendering of overview/source/action.

### PR 2: Market Index Mobile-Native Tables And Charts

Goal: make the flagship analytics page meet ADR-009 first.

Scope:

- Convert supplier comparison to small-screen cards with supplier, cheapest lot, price, process, type, and action. Keep table on desktop.
- Convert arrivals/delistings named rows to mobile cards. Keep tables on desktop.
- Add compact textual summaries above origin trend, processing mix, origin range, movement, and metadata charts.
- Add `aria-label` and source notes to chart summaries so the non-visual read is complete.

Acceptance:

- Mobile path supports: read market headline, inspect a value signal, inspect one evidence source, open catalog or chat.
- Desktop still exposes high-density chart/table views.
- Playwright coverage includes a mobile Market Index task.

### PR 3: Portfolio And Catalog Decision Flow

Goal: make procurement decisions complete on mobile.

Scope:

- Add priority strips for portfolio/watchlist anomalies: delisted tracked lots, price movers, low remaining weight, and high-value inventory.
- Add actions: roast, replace in catalog, ask chat, track/untrack.
- Add a mobile filter/refinement pattern for catalog advanced filters before more filters are added.
- Ensure CoffeeCard detail tabs preserve trust signals and action on mobile.

Acceptance:

- Mobile task: find a tracked lot with a price drop, inspect price/process evidence, and open catalog detail.
- Mobile task: find a portfolio coffee low on remaining weight and start a replacement search.

### PR 4: Profit Analytics Reframe

Goal: replace chart-first profit review with decision-first profit triage.

Scope:

- Add modules for margin health, sell-through, top/bottom lot performance, and monthly revenue.
- Add source/evidence notes for missing or stale sales/cost data.
- Add mobile cards for top drivers and anomalies.
- Keep full charts as desktop/deep-dive views.

Acceptance:

- Mobile task: determine whether margin is healthy, identify the top profit driver, inspect the sale/cost basis, and log a sale.
- Desktop task: compare monthly revenue, cumulative profit, and lot-level performance without losing density.

### PR 5: Roast Analysis Task Split

Goal: make roast analytics fit the user's current mode.

Scope:

- Separate live roast control from saved profile review in the IA.
- Saved profile mobile view starts with phase summary, weight loss, event anomalies, and notes.
- Full roast chart remains available as a deep-dive panel.
- Live roast controls get explicit mobile QA for control reachability, timer state, and save flow.

Acceptance:

- Mobile task: open a saved roast, identify the key phase/weight-loss read, inspect event context, and compare to another profile.
- Tablet/desktop task: run a live roast without controls overlapping the chart or timeline.

### PR 6: API Console And Chat/Canvas Parity

Goal: apply the standard to operational analytics and generated analytical blocks.

Scope:

- Audit API dashboard usage/key views with the same module contract.
- Convert usage/key tables to mobile cards or drill-ins.
- Add analytical block metadata for chat/canvas generated tables.
- Make market signal and supplier comparison blocks prefer summary/card views on small screens.

Acceptance:

- Mobile task: check usage limit risk, inspect evidence, and choose the key or plan action.
- Chat task: receive a market signal block on mobile, inspect evidence, and open the relevant catalog/action path.

## QA Standard To Add

Every analytical PR should include at least one task assertion per affected breakpoint:

- **Mobile:** complete the decision path with viewport around 390px wide.
- **Tablet:** verify controls and drill-ins remain reachable without overlap.
- **Desktop:** verify high-density view retains comparison depth.

For each task, record:

- starting route and state
- user question
- expected first read
- evidence source visible
- action reachable
- viewport
- validation command

## Priority

1. Market Index table/chart mobile-native variants.
2. Profit analytics reframe.
3. Portfolio/watchlist anomaly strip.
4. Catalog mobile refinement model.
5. Roast saved-profile/mobile mode split.
6. API console and chat/canvas analytical block metadata.

The important sequence is to standardize the module contract first, then apply it to the flagship Market Index, then pull the rest of the app up by surface risk and user value.
