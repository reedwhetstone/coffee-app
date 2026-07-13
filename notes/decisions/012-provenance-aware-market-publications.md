# ADR-012: Provenance-aware atomic market publications

**Status:** Accepted
**Date:** 2026-07-13

## Context

The legacy daily index is recomputed from rows labeled with a scrape date and upserted segment by segment. A partial rerun can therefore overwrite some segments while leaving others behind, creating a hybrid day that never existed. Requiring every registered source to succeed avoids partial data but makes one supplier outage suppress the entire market view. Copying failed suppliers into today's raw snapshots preserves a smooth chart by falsely describing old prices and stock as newly observed.

The production cohort also cannot be inferred from every source registered in scraper code. Recovery groups, experimental sources, and intentionally paused integrations are operational concerns, not silent changes to index methodology.

## Decision

Market data is built from immutable, supplier-level observation sets. Each observation keeps its true `observed_at`; carried inputs reference the prior complete set and never acquire today's date or fresh stock confidence. Legacy backfill may be labeled `unknown` or `legacy` rather than claiming completeness.

Legacy and unknown-completeness sets are not eligible for production publications. Making reconstructed history publishable requires a separate reviewed backfill policy and methodology version; it cannot reuse the ordinary fresh/carried path.

Publication age is derived in the database from the supplier set's `observed_at` and the exclusive UTC end-of-day cutoff for `as_of_date`. Same-UTC-day observations are fresh; older observations are carried and subject to cohort TTL; observations at or beyond the cutoff are ineligible. Callers cannot choose or shorten age.

An explicit, versioned cohort defines expected production suppliers, their weights, enablement, and maximum carry-forward age. Daily publication candidates each own an exact source-to-observation-set manifest and a complete set of publication-scoped aggregates. Candidates can coexist. Promotion selects exactly one active publication per date and cohort atomically; active inputs and aggregates are immutable. A suppressed candidate does not patch the last good publication.

Child writes lock their observation-set or publication parent. Completion and sealing transitions acquire the same row locks, so a child write either commits before the parent is sealed or observes the sealed parent and fails. Cohort definitions and membership become immutable as soon as any candidate references that cohort version.

Quality policy is versioned separately from schema. The initial policy direction is healthy at at least 80% expected-supplier coverage, 70% item coverage, and no more than 20% stale share; degraded at at least 60%, 50%, and no more than 40%; below that is suppressed. These values remain policy inputs so they can change without schema surgery.

The methodology direction is supplier-first: compute segment measures within each supplier, limit supplier influence through equal or explicit cohort weights, and derive movement from matched supplier/segment price relatives. Assortment change is reported separately from repricing. This foundation records the inputs required for that method but does not replace the legacy calculation yet.

## Consequences

- A supplier failure can be represented by a bounded, disclosed carry-forward rather than a false fresh row or total shutdown.
- Same-day reruns cannot create hybrid aggregates; a candidate is selected as a whole.
- Coverage, staleness, age, cohort, methodology, and policy are auditable for every publication.
- Observation and publication storage increases, and promotion/build logic must be transactional.
- Existing `coffee_price_snapshots` and `price_index_snapshots` remain operational until readers and writers migrate in later, independently reversible slices.
- Strict all-source/per-run perfection and naive copied snapshots are rejected as steady-state designs.
