# ADR-010: Public Market Index Proof Surface

**Status:** Accepted
**Date:** 2026-07-07

## Context

ADR-003 made three analytics charts visible without authentication. That was useful
when `/analytics` was mostly a proof page with a few market charts and a deeper
auth gate.

The Market Index is now moving toward the ADR-015 decision surface: a market read,
signals, pricing movement, supplier intelligence, and disclosure trends. Keeping the
old three-chart anonymous contract inside this larger page creates scroll fatigue and
turns the public surface into a dense preview of the paid product instead of a clear
top-of-funnel read.

The current product direction is simpler:

- anonymous visitors should see the main market read, basic signals, the main price
  trend, and one consolidated upgrade path;
- signed-in non-Intelligence viewers can see additional public context and gated
  previews;
- Parchment Intelligence users get the supplier comparison, arrivals/delistings,
  supplier health, and disclosure-trend modules.

## Decision

ADR-003 is superseded. Anonymous `/analytics` no longer guarantees the old
three-chart baseline.

The public Market Index proof surface is:

1. the current market read and scope controls;
2. basic signal and KPI context;
3. the primary price trend chart;
4. one consolidated upgrade summary that names the deeper capabilities without
   repeating CTA cards between modules.

Processing mix, origin price ranges, supplier price comparison, lot previews,
arrivals/delistings, supplier health, disclosure trends, and metadata-trend modules
are no longer part of the anonymous baseline. They should either render for signed-in
viewers or appear behind a concise entitlement/upgrade treatment.

Section navigation must match rendered sections for the current access level. Public
navigation cannot link to hidden or non-rendered paid sections.

## Consequences

- Anonymous users get a shorter proof page that better matches mobile and desktop
  scanning behavior.
- The funnel is clearer: see the read, understand the value, then sign in or upgrade
  for supplier and disclosure depth.
- This reduces free chart breadth relative to ADR-003, so conversion and SEO impact
  should be watched after launch.
- Future anonymous additions should be treated as product-contract changes, not
  incidental UI tweaks.

## References

- ADR-003: Public Analytics — 3 Free Charts, Auth Gate for the Rest
- ADR-015: Market Index direction: actionable insight, value signals, and the
  metadata index
- `notes/PRODUCT_VISION.md` — public analytics as proof of value without turning
  anonymous access into the power-user surface
