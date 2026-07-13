# Market publication continuity program

**Date:** 2026-07-13
**Decision:** ADR-012

## Outcome

Publish a continuous, comparable daily market view from an explicit supplier cohort while exposing which inputs are fresh, carried, expired, or unavailable. Never fabricate observation dates, partially patch an aggregate day, or let a recovery/test scrape publish an index.

## Mergeable PR sequence

1. **Additive database foundation (this PR).** Add scrape runs, immutable supplier observation sets, true-time observations, versioned cohorts, candidate publications, exact manifests, and publication-scoped aggregates. Add no callers and change no legacy readers/writers.
2. **Scraper provenance writes.** Record every scrape run and create one supplier observation set only after a supplier finishes. Insert observations while the set is open, then seal it complete. Failed and partial sets remain ineligible. Keep legacy snapshot writes unchanged during dual-write validation.
3. **Cohort and policy configuration.** Seed a reviewed production cohort explicitly. Implement versioned policy evaluation and TTL enforcement. Shopify recovery commands remain non-publishing; code registration alone never changes the cohort.
4. **Candidate builder.** Select the newest complete same-day set per cohort source, then a prior complete set only within that source's TTL. Preserve `observed_at`; mark carried stock confidence. Build the exact manifest and all aggregates in one transaction. Record healthy/degraded/suppressed metrics using the initial 80/70/20 and 60/50/40 policy versions.
5. **Atomic promotion.** Add a transactional promotion RPC that locks date/cohort, compares candidate quality/freshness deterministically, rejects or supersedes the prior candidate, and activates exactly one whole publication. Add concurrency and rollback tests.
6. **Shadow comparison.** Build candidates without serving them. Compare legacy and supplier-first results, coverage, stale share, assortment effects, and matched-relative movement over multiple production runs. Tune policy by version, never by rewriting history.
7. **Reader cutover.** Expose active publications through a compatibility view or versioned API. Switch readers behind a reversible feature flag. Keep the legacy tables read-only for a bounded observation period.
8. **Methodology evolution and retirement.** Adopt supplier-first weighting and matched supplier/segment relatives after shadow evidence. Separate assortment change. Retire legacy compute/writes only after API consumers and backfills are verified.

## Invariants

- Only complete supplier sets are eligible; unknown legacy sets are visibly labeled.
- Carry-forward uses the original observation timestamp and cohort-specific TTL.
- Carried stock is not asserted as freshly observed.
- A publication manifest has at most one set per expected source.
- Aggregates belong to one candidate and are never shared daily UPSERTs.
- Exactly one active publication exists per date/cohort; active artifacts are immutable.
- Explicit source/group runs cannot publish production indexes.

## Deployment and rollback

Apply each migration before deploying its writer. The foundation is additive and requires no backfill, so deployment does not affect current application traffic. Later dual-write and shadow stages must emit comparison telemetry before cutover.

Rollback before reader cutover is disabling the new writer/builder and leaving additive tables dormant. Do not drop provenance data during ordinary rollback. Reader cutover rolls back by switching the feature flag/API view to legacy `price_index_snapshots`. If schema removal is eventually required, export publication manifests first and use a dedicated reviewed down migration after all dependencies are removed.

## Backfill

Historical raw rows may be grouped into observation sets only with `completeness = 'unknown'` or `legacy` and matching quality labels. Backfill must retain original timestamps where known and must not make historical sets eligible as fresh observations. Historical publication reconstruction is a separate audited operation, not part of deployment.

## Validation gates

- Static DDL contract checks in this slice.
- Executable SQL behavior checks plus `pnpm run verify:market-publication-concurrency`, which creates an ephemeral local PostgreSQL database and runs two-session parent-transition/child-write races. It requires local `postgres` access through `su`; cleanup drops the database and any test-created roles.
- Local Supabase reset/migration replay when the service is available.
- Scraper unit/integration tests for sealing, failure, and dual-write behavior.
- Database tests for TTL selection, manifest completeness, concurrent promotion, immutability, and rollback.
- Shadow-run acceptance report before any production reader changes.

## Shadow comparison cutover gate

Run the read-only production cohort comparison after at least seven active publication days exist:

```bash
pnpm run audit:market-publication-shadow -- --days 30
```

Use `--as-of YYYY-MM-DD` for a reproducible inclusive UTC window, `--json` for a machine-readable report, or `--cohort-key` and `--cohort-version` to inspect a non-default cohort. For clean JSON stdout without the package-runner banner, use `pnpm --silent run audit:market-publication-shadow -- --days 30 --json > shadow-report.json`; the human summary remains on stderr. The command requires `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It performs only PostgREST `select` queries; it does not call RPCs, mutate data, enable flags, or change reader behavior.

Exit status is the cutover contract:

- `0`: every named `shadow-cutover-v1` acceptance gate passed. This is necessary evidence for reader cutover, not authorization to switch readers by itself.
- `1`: the report ran, but the evidence does not meet the gate. Investigate the JSON/day details and continue shadowing.
- `2`: invalid arguments, missing credentials (`VALIDATION_BLOCKED_ENV`), absent publication schema, or an unavailable/query-failing service (`VALIDATION_BLOCKED_SERVICE`). This is no verdict about the data.

`shadow-cutover-v1` is a versioned named configuration in `src/lib/server/marketPublicationShadow.ts`. It conservatively requires at least seven comparable days and at most one degraded day. Every active day must contain a usable matched median pair; seven good days cannot hide an eighth unusable publication. Every healthy day must meet the `coverage-v1` healthy bounds (80% suppliers, 70% expected items, at most 20% stale); the bounded degraded day must still meet its 60%/50%/40% bounds. Each day independently requires at least 85% exact segment overlap and bounded matched-segment divergence: median absolute price-median delta at most 5%, p95 at most 15%, maximum at most 50%, with supplier-count divergence median at most 1, p95 at most 3, and maximum at most 5. Window distributions remain supplemental and cannot dilute a bad day with higher-volume good days. Equal zero medians compare as zero; a nonzero publication median against a zero legacy median is explicitly non-comparable and fails the gate. Missing medians on an otherwise matching segment also fail rather than shrinking the comparison sample silently.

The audit detects cohort, methodology, and policy changes. It reports each compatibility group separately and rejects the window rather than silently pooling unlike days. Legacy queries explicitly exclude `synthetic=true` rows, and duplicate segment identities on either side are rejected rather than map-overwritten. Missing dates, median failures, duplicate identities, and representative segment entrants/departures are shown in the human report as well as JSON. Legacy `price_index_snapshots` are a divergence baseline, not ground truth: differences can represent defects, supplier-first weighting, bounded carry-forward, or legitimate assortment/composition change. A passing report still requires review of those causes before reader cutover.
