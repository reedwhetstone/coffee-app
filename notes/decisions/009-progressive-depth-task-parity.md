# ADR-009: Progressive Depth With Task Parity

**Status:** Accepted

**Date:** 2026-07-07

## Context

Purveyors now has several analytical product surfaces: the public and member Market Index, catalog filtering and lot detail, portfolio/watchlist review, roast profiling, profit analytics, Parchment Console usage views, and chat/canvas-generated blocks.

The app has historically used responsive layout as the default adaptation mechanism. That is necessary, but not sufficient for analytics. A compressed desktop dashboard can preserve visual elements while losing the decision the user came to make. This is especially risky for coffee-market workflows where the user needs a complete chain from signal to evidence to action.

ADR-008 established that the Market Index should become a decision surface rather than a dataset display. This ADR generalizes that standard across analytical experiences in coffee-app.

## Decision

We will design analytics experiences around **task parity**, not visual parity.

Mobile, tablet, and desktop must support the same core user decisions, but may use different layouts, navigation models, chart density, filtering affordances, and interaction patterns.

## Principles

1. Preserve the decision, not the exact layout.
2. Start each analytical feature by defining the user question it answers.
3. Mobile gets a complete path: overview, anomaly, explanation, source, action.
4. Desktop may expose more simultaneous context; mobile exposes progressive layers.
5. No critical insight, action, or trust signal may be desktop-only.
6. Tables, charts, and filters must have mobile-native representations.
7. Responsive behavior must be designed intentionally, not left to generic wrapping.

## Required Pattern

Each analytical module must declare:

- **User question:** the question this module answers.
- **Decision:** the action or judgment the user can make after reading it.
- **Overview:** the first-screen summary at small widths.
- **Anomaly:** the movement, outlier, exception, or priority item surfaced first.
- **Explanation:** the short interpretation that separates signal from raw data.
- **Source:** the evidence, timestamp, segment, sample size, supplier count, row count, or entitlement note that makes the read trustworthy.
- **Action:** the next product move, such as view lot detail, ask chat with context, refine filters, track a lot, log a roast, log a sale, export, or upgrade.
- **Desktop representation:** the high-density form, such as chart plus table, side-by-side comparisons, or expanded controls.
- **Mobile representation:** the progressive form, such as summary cards, drill-in sheets, column-priority tables, compact sparklines, segmented controls, or card lists.
- **QA task:** the mobile and desktop task that must pass before release.

## Consequences

- Dashboards are composed from reusable insight modules, not fixed desktop panels.
- Charts require small-screen variants that preserve the read even when labels, density, or simultaneous series must change.
- Dense tables require summary, card, column-priority, or drill-in modes.
- Filters require both full desktop control and mobile scoped refinement.
- QA must include analytical task completion on mobile, not only layout checks.
- A module may use richer desktop context, but the mobile path must still let a user identify the signal, inspect evidence, and take the corresponding action.

## Product-Surface Guidance

- **Market Index:** primary exemplar. Every value signal, market movement read, metadata trend, supplier comparison, and arrivals/delistings module should follow the required pattern.
- **Catalog:** filtering and lot detail must let mobile users narrow the market, understand price/process/proof context, and track or compare a lot without requiring desktop tables.
- **Portfolio/watchlist:** mobile must support the procurement loop: see holdings, spot depletion or price movement, open lot context, and act.
- **Roast:** mobile must support monitoring and lightweight profile review, even if live roast logging remains more ergonomic on tablet/desktop.
- **Profit:** mobile must support margin and sell-through triage with drill-in evidence, not just scaled-down charts.
- **API dashboard:** usage, entitlement, and key-management insights must expose status, risk, evidence, and action on small screens.
- **Chat/canvas:** generated analytical blocks must follow the same module contract because chat is a primary progressive-depth surface.

## References

- ADR-003: public analytics three-chart free gate
- ADR-005: catalog access levels and visibility vs leverage
- ADR-006: CLI-owned portable agent tools
- ADR-007: headless API extraction, web as reference client
- ADR-008: Market Index actionable insight direction
- `notes/implementation-plans/2026-07-07-progressive-depth-task-parity-audit.md`
