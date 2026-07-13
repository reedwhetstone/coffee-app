# ADR-012: Provenance-aware atomic market publications

**Status:** Accepted
**Date:** 2026-07-13

## Context

The legacy daily index is recomputed from rows labeled with a scrape date and upserted segment by segment. A partial rerun can therefore overwrite some segments while leaving others behind, creating a hybrid day that never existed. Requiring every registered source to succeed avoids partial data but makes one supplier outage suppress the entire market view. Copying failed suppliers into today's raw snapshots preserves a smooth chart by falsely describing old prices and stock as newly observed.

The production cohort also cannot be inferred from every source registered in scraper code. Recovery groups, experimental sources, and intentionally paused integrations are operational concerns, not silent changes to index methodology.

## Decision

Market data is built from immutable, supplier-level observation sets. Each observation keeps its true `observed_at`; carried inputs reference the prior complete set and never acquire today's date or fresh stock confidence. Legacy backfill may be labeled `unknown` or `legacy` rather than claiming completeness.

Legacy and unknown-completeness sets are not eligible for production publications. Making reconstructed history publishable requires a separate reviewed backfill policy and methodology version; it cannot reuse the ordinary fresh/carried path.

Publication age will be derived in the database from the supplier set's `observed_at` and the exclusive UTC end-of-day cutoff for `as_of_date`. Same-UTC-day observations are fresh; older observations are carried. A scrape failure, including a zero-result supplier response, does not erase the last known good set and does not impose a short publication cliff. Staleness lowers disclosed confidence rather than pretending old data is fresh or suppressing the market level after an arbitrary number of days.

An explicit, versioned cohort defines production suppliers, their weights, and enablement. Enabled cardinality is derived from membership rather than copied into a drift-prone count. A cohort is frozen before another artifact references it; its definition and membership then become immutable, except that an open-ended cohort may receive a one-time exclusive `effective_to` retirement boundary so a non-overlapping successor can begin there.

This first schema slice stores only scrape provenance, immutable supplier observations, fenced ingest leases, and cohort configuration. It deliberately provides no candidate, aggregate, activation, promotion, or reader primitive. Publication construction and activation belong together in a later database-owned transaction.

Child writes lock their observation-set parent. Supplier leases carry monotonic fences so an expired scraper worker cannot seal observations after a successor owns that supplier. Completion acquires the same parent lock, so a child write either commits before the set is sealed or observes the sealed parent and fails.

Quality policy is versioned separately from schema. Freshness affects confidence and disclosure, not whether a reasonably representative market level exists. A later builder computes the level from all represented suppliers, including last-known-good carried sets. Daily movement uses only fresh suppliers matched to their prior observations, so a prolonged Shopify outage neither manufactures movement nor mechanically flattens the trend.

The methodology direction is supplier-first: compute segment measures within each supplier, limit supplier influence through equal or explicit cohort weights, and derive movement from matched supplier/segment price relatives. Assortment change is reported separately from repricing. This foundation records the inputs required for that method but does not replace the legacy calculation yet.

## Consequences

- A supplier failure can be represented by disclosed last-known-good carry-forward rather than a false fresh row or total shutdown.
- Same-day reruns cannot create hybrid aggregates; a candidate is selected as a whole.
- Coverage, staleness, age, cohort, methodology, and policy will be auditable for every publication.
- Observation and publication storage increases, and promotion/build logic must be transactional.
- Existing `coffee_price_snapshots` and `price_index_snapshots` remain operational until readers and writers migrate in later, independently reversible slices.
- Strict all-source/per-run perfection and naive copied snapshots are rejected as steady-state designs.
