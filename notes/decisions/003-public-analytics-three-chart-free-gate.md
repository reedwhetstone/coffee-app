# ADR-003: Public Analytics — 3 Free Charts, Auth Gate for the Rest

**Status:** Accepted
**Date:** 2026-02-01 (approximate)

## Context

The `/analytics` page is the primary top-of-funnel surface for purveyors.io. It
aggregates data from 35+ suppliers and is genuinely useful to coffee buyers, roasters,
and hobbyists who have not yet signed up. Hiding it entirely wastes the data asset.

At the same time, the deeper analytics (supplier health comparisons, Parchment
Intelligence origin-level aggregates, new arrivals/delistings tracking) represent the
core value proposition for upgraded users. Giving everything away reduces signup
incentive.

The shipped entitlement model is:

- **Public visitor or signed-in viewer** — the same baseline market overview
- **Parchment Intelligence** — supplier comparisons, arrivals/delistings tracking,
  origin-level aggregates, spread analysis, and extended trend history

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

Parchment Intelligence features (origin aggregates with median/p25/p75 bands,
supplier coverage, and extended trend views) sit behind an entitlement check, not just
an authentication check.

## Consequences

- Unauthenticated users get real value; likely to share/link (SEO signal).
- Auth wall is visible and explicit — no dark patterns.
- Revisit chart selection if signup conversion is low: more free charts may increase
  top-of-funnel but reduce signup pressure.
- If the Parchment Intelligence product expands, the gate logic may need to inspect
  finer-grained entitlements than the current single access flag.
