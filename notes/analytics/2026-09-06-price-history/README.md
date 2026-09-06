# Price history: evidence, reconstruction direction, and recorded-data UI

Status: **draft for discussion**, September 5 Mountain / September 6 UTC, 2026.

## Product outcome

The primary analytics chart should provide a useful, continuous reconstructed price trend, not a graph dominated by collection outages and changing supplier participation. Recorded observations remain inspectable and immutable. A publication quality threshold should prevent poor evidence from becoming a misleading trend; it need not prohibit a separately identified estimate.

This supersedes an initial proposed observed-only/gaps default for the final product. The implementation in this draft is the **recorded-data inspection foundation**, not the final main-chart behavior. Do not merge this draft as completion of the reconstructed-history request.

## What is happening now

See [live evidence](evidence.md) for queries, dates, counts, and distinctions between measured and inferred state.

- Publication resumed September 1–5. Latest run: 43 complete sources, Showroom partial, Atlas/Aida failed. Exact runtime price-coverage denominator is not persisted in the inspected tables.
- July 11–15: source/sample collapse shifted the reported median, rather than establishing a market-wide jump. Indonesia's sample fell from 67 to 16 while its median rose from $10.39 to $16.
- July 22–August 31: 41 days without published price-index aggregates. Some raw prices exist on 39 days, but those days are not automatically representative.
- Pre-March 22: available prices are synthetic reconstruction from catalog prices and availability dates, not recorded historical prices.
- The current web chart discards synthetic provenance, labels medians as averages, joins missing days with smooth curves, clips extremes at a percentile-based axis limit, and misdates nearest-point tooltips.

## Recommended final experience

- Main view: **Reconstructed price trend**, in estimated $/lb, with concise methodology access.
- Secondary view: **Recorded prices**, showing exact dates, sample/supplier counts, historical-estimate provenance, and genuine missing published-index days.
- Hover/tap identifies recorded, adjusted, or interpolated points. Do not flood the main chart with warnings; disclose the evidence where users inspect it.
- A light optional observation overlay supports checking the reconstruction.
- Mobile: usable plot width, compact controls, readable legend, accessible date inspection, and no overlapping endpoint labels or nested duplicated headings.

## Methodology must precede replacing the main series

1. Select a canonical run/source observation per day. Distinguish successful partial collection from complete supplier evidence and avoid counting multiple runs as additional coverage.
2. Validate purchase-unit conversion and historical origin identity. The existing `compute_price_index(date)` joins today's catalog attributes, so it is not a historically immutable replay mechanism.
3. Reduce composition effects using matched lots where available and normalized supplier contributions. Do not reinterpret a disappearing low-price supplier as price inflation.
4. Treat unsupported periods as estimates and bridge reliable anchors without spline overshoot. Separate historical corrections from real price changes. Earlier-than-March history requires an explicit additional model/source, not a claim of recovered observations.
5. Backtest: hide known-good dates and entire supplier cohorts, reconstruct them, and compare against held-out outcomes. Evaluate level error, spurious jumps, preserved genuine moves, sensitivity to weights, and uncertainty over longer holes.
6. Store a versioned derived series, input provenance, and reconstruction method. Keep raw prices and observed aggregates unchanged. The quality gates continue to govern observed publication; the reconstruction has its own support/quality contract.

## Exploratory comparison — not a proposed production formula

[Matched-supplier comparison](reconstruction-comparison.png) uses daily retail per-source/origin medians from March 22–September 5, requiring at least two common suppliers with two lots each. It chains the equal-weight mean log price-relative of suppliers present at both endpoints, anchors each origin to its September 5 published median, and linearly joins dates lacking support.

This removes the obvious July cohort spike, but **does not yet produce a validated reconstruction**. Within-supplier lot churn remains. September extraction or unit corrections can be misread as market changes; anchoring at the end rescales the entire earlier series. Several origins show long modeled ramps and substantially shifted historical levels. A trial using median rather than mean daily relatives was overly flat because most suppliers did not change on most days. Neither variant should ship just because it looks smoother.

These results support the desired product distinction, not acceptance of this formula. Next implementation needs matched-product and price-unit validation plus the holdout tests above. Raw historical identity also uses today's catalog join in this exploration; its classification caveat applies.

## Draft implementation and validation

The recorded-data UI preserves upstream synthetic provenance, excludes backward-projected estimates unless explicitly selected, uses exact UTC-date inspection, separates retail and wholesale cohorts rather than averaging medians, exposes samples, includes full value extents, and improves mobile layout. It introduces no new estimates and changes no database rows or publication thresholds.

Local screenshots use a temporary fixture harness with production aggregate-only data, not a deployed page:

- [Mobile recorded view](mobile-recorded-preview.png)
- [Desktop recorded view](desktop-recorded-preview.png)

This is a partial foundation pending reconstructed-series implementation and agreement on its methodology. PR merge/deploy and historical data writes are not part of this draft handoff.
