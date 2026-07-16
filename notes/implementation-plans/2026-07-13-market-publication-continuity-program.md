# Market publication continuity program

**Date:** 2026-07-13
**Decision:** ADR-012
**Status:** Superseded by `2026-07-16-market-publication-recovery-and-activation.md`, which incorporates the first production run after the provenance writer merged and replaces the rejected builder boundary.

## Outcome

Publish a continuous, comparable daily market view from an explicit supplier cohort while exposing which inputs are fresh, carried, expired, or unavailable. Never fabricate observation dates, partially patch an aggregate day, or let a recovery/test scrape publish an index.

## Mergeable PR sequence

1. **Additive provenance foundation (this PR).** Add production-scoped scrape runs, fenced supplier ingest leases, immutable supplier observation sets, true-time observations, and versioned cohorts with derived membership counts. Add no publication, aggregate, activation, caller, or reader contract; change no legacy readers/writers.
2. **Scraper provenance writes.** Record every scrape run and create one supplier observation set only after a supplier finishes. Insert observations while the set is open, then seal it complete. Failed and partial sets remain ineligible. Keep legacy snapshot writes unchanged during dual-write validation.
3. **Cohort and policy configuration.** Seed and freeze a reviewed production cohort explicitly. Code registration alone never changes the cohort. Define confidence bands and disclosure without a short carry-forward TTL publication cliff.
4. **Transactional publication builder.** After every completed production `all` run, including degraded and all-failed runs, select each cohort supplier's newest complete set at or before the publication cutoff. Preserve `observed_at`, mark carried stock confidence, compute level from every represented supplier, and compute movement only from fresh matched suppliers. Build, validate, and atomically activate the exact manifest plus all aggregates in one database-owned transaction. Recovery/source/group/test/backfill runs remain non-publishing.
5. **Atomic replacement and rollback tests.** Lock date/cohort, compare whole publications deterministically, and replace exactly one whole publication without exposing partial artifacts. Add concurrency and rollback tests around the same builder-owned transaction.
6. **Shadow comparison.** Build candidates without serving them. Compare legacy and supplier-first results, coverage, stale share, assortment effects, and matched-relative movement over multiple production runs. Tune policy by version, never by rewriting history.
7. **Reader cutover.** Expose active publications through a compatibility view or versioned API. Switch readers behind a reversible feature flag. Keep the legacy tables read-only for a bounded observation period.
8. **Methodology evolution and retirement.** Adopt supplier-first weighting and matched supplier/segment relatives after shadow evidence. Separate assortment change. Retire legacy compute/writes only after API consumers and backfills are verified.

## Invariants

- Only complete supplier sets are eligible; unknown legacy sets are visibly labeled.
- Carry-forward uses the original observation timestamp and remains available through prolonged scrape failure; age changes confidence and disclosure instead of creating a short publication cliff.
- Carried stock is not asserted as freshly observed.
- A publication manifest has at most one set per expected source.
- Aggregates belong to one candidate and are never shared daily UPSERTs.
- Exactly one active publication exists per date/cohort; active artifacts are immutable.
- Explicit source/group/recovery/test/backfill runs cannot publish production indexes. Every completed production `all` run invokes the builder even when every supplier failed, so continuity comes from last-known-good observations rather than successful-run gating.

## Deployment and rollback

Apply each migration before deploying its writer. The foundation is additive and requires no backfill, so deployment does not affect current application traffic. Later dual-write and shadow stages must emit comparison telemetry before cutover.

Rollback before reader cutover is disabling the new writer/builder and leaving additive tables dormant. Do not drop provenance data during ordinary rollback. Reader cutover rolls back by switching the feature flag/API view to legacy `price_index_snapshots`. If schema removal is eventually required, export publication manifests first and use a dedicated reviewed down migration after all dependencies are removed.

## Backfill

Historical raw rows may be grouped into observation sets only with `completeness = 'unknown'` or `legacy` and matching quality labels. Backfill must retain original timestamps where known and must not make historical sets eligible as fresh observations. Historical publication reconstruction is a separate audited operation, not part of deployment.

## Validation gates

- Static DDL contract checks in this slice.
- Executable SQL behavior checks for fenced ingest, immutable observations, derived cohort cardinality, freeze semantics, and safe cohort retirement.
- Local Supabase reset/migration replay when the service is available.
- Scraper unit/integration tests for sealing, failure, and dual-write behavior.
- Database tests for prolonged carry-forward selection, confidence disclosure, manifest completeness, fresh matched movement, concurrent replacement, immutability, and rollback.
- Shadow-run acceptance report before any production reader changes.
