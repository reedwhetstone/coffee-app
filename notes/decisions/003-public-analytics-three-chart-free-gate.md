# ADR-003: Public Analytics — 3 Free Charts, Auth Gate for the Rest

**Status:** Accepted
**Date:** 2026-02-01 (approximate)

## Context

The `/analytics` page is the primary top-of-funnel surface for purveyors.io. It
aggregates data from 35+ suppliers and is genuinely useful to coffee buyers, roasters,
and hobbyists who have not yet signed up. Hiding it entirely wastes the data asset.

At the same time, the deeper analytics (supplier health comparisons, PPI origin-level
aggregates, new arrivals/delistings tracking) represent the core value proposition
for paid and free registered members. Giving everything away reduces signup incentive.

The monetization tiers are:
- **Anonymous** — view public market overview
- **Free member** — arrivals/delistings tracking, supplier comparisons
- **PPI member** ($29/mo) — origin-level price aggregates with full time-series data

## Decision

Three charts are visible without authentication:
1. **Average $/lb by top origins** (bar chart — 30-day snapshot)
2. **Price trend over time** (line chart — market-wide)
3. **Statistics bar** (total suppliers, stocked SKUs, origins count)

Everything below these three is blurred with an auth prompt overlay. The comment in
`+page.svelte` marks the gate: "Blurred preview for unauthenticated users — everything
below the 3 public charts."

The three free charts were chosen because they provide market-level insight (useful
for SEO and social sharing) without exposing the per-supplier detail that drives
registered-user value.

PPI-tier features (origin aggregates with median/p25/p75 bands and supplier coverage)
sit behind a separate `session` check within the authenticated section, not just
the unauthenticated gate.

## Consequences

- Unauthenticated users get real value; likely to share/link (SEO signal).
- Auth wall is visible and explicit — no dark patterns.
- Revisit chart selection if signup conversion is low: more free charts may increase
  top-of-funnel but reduce signup pressure.
- If the PPI product expands, the gate logic may need to inspect subscription tier
  rather than just session presence.
