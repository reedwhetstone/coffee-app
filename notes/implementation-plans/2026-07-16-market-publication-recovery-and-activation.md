# Market publication recovery and activation program

**Date:** 2026-07-16
**Decision:** ADR-012
**Status:** Proposed
**Repositories:** `coffee-app`, `coffee-scraper`

## Executive decision

Keep legacy daily aggregate publication frozen. Repair scraper run telemetry immediately, deploy and validate the already-merged provenance foundation, collect trustworthy shadow observations, then replace the legacy index with one database-owned build-and-activate transaction that is invoked by every completed production `all` run.

PRs #370 and #477 establish Web Bot Auth identity. They do not correct supplier/operational scope accounting, deploy the provenance schema, create market publications, invoke a builder, validate shadow methodology, or cut readers over from legacy tables. Those concerns remain separate so identity rollout cannot silently change index methodology.

## Production evidence and current truth

The 2026-07-16 production scrape ran coffee-scraper revision `80cec64` and completed the catalog pipeline:

- 44 real supplier sources completed successfully.
- 2,022 products were observed and updated; 36 were new.
- Shopify found 824 products across 27 stocked suppliers. Aida Batlle, the 28th Shopify source, was legitimately empty under its explicit `allowEmptyInventory` contract.
- Shopify wrote 817 raw `coffee_price_snapshots`; the full run wrote 1,323 raw snapshots across 39 suppliers with eligible priced inventory.
- `shopify_fleet` and `market_index_contract` were synthetic operational scopes misreported as failed suppliers, producing the false `44/46` result and two false Source Health criticals.
- `price_index_snapshots` correctly remained empty because `PUBLISH_LEGACY_DAILY_AGGREGATES` is intentionally `false`. The synthetic failure did not gate raw snapshot writes or cause the freeze.
- The scraper emitted `relation "public.scrape_runs" does not exist`, proving that the merged provenance foundation was not present in the production database. The writer therefore stayed dormant and legacy catalog writes continued. Repository audit found no workflow that applies `supabase/migrations` to production; Vercel deployment and the existing type-generation workflow do not deploy SQL.
- The superseded builder PR #465 is closed. No current builder, publication artifact, automatic invocation, shadow comparison, or reader cutover exists.

## Scope

This program owns:

1. truthful operational telemetry for supplier cohorts and publication state;
2. production deployment verification for the merged ADR-012 foundation;
3. shadow observation capture and completeness evidence;
4. explicit cohort and methodology configuration;
5. transactional publication construction and activation;
6. automatic invocation after every production `all` run;
7. shadow comparison, reader cutover, rollback, and legacy retirement.

It does not own Web Bot Auth key publication, request signing, Shopify registration, or signed canary sequencing. Those remain in coffee-app #477 and coffee-scraper #370.

## Architectural invariants

- A supplier source and an operational scope are different types. Operational scopes never affect supplier success counts or produce zero-product supplier alerts.
- `coffee_price_snapshots` remain raw operational evidence during migration. They are not relabeled as provenance-aware publications.
- Legacy aggregate writers remain disabled. Re-enabling them would recreate partial and hybrid days rejected by ADR-012.
- Only complete supplier observation sets are eligible for a publication. Failed, partial, unknown, and legacy sets never masquerade as fresh.
- Carry-forward retains the original `observed_at`. There is no short time-to-live cliff; age changes confidence and disclosure.
- The production cohort is explicit, versioned, reviewed, and frozen. Scraper source registration cannot silently change methodology.
- Market level is supplier-first and uses represented cohort suppliers. Movement uses only fresh suppliers matched to their prior observations. Assortment change is separate from repricing.
- A publication manifest, aggregates, quality assessment, predecessor identity, and activation decision are created in one database transaction.
- Exactly one whole active publication exists per date and cohort. Same-day reruns replace it only when a deterministic whole-publication comparator says the candidate is better.
- Every terminal production `all` run invokes the builder, including degraded and all-failed runs. Recovery, source, group, test, and backfill runs cannot publish.
- Reader cutover is reversible and cannot occur until shadow evidence is accepted.

## Red-team dispositions

- **Rejected: flip `PUBLISH_LEGACY_DAILY_AGGREGATES` back on.** This would restore output quickly by reintroducing partial/hybrid same-day writes that ADR-012 explicitly rejects.
- **Rejected: treat `shopify_fleet` as a successful zero-product supplier.** Marking the synthetic scope successful would hide real cohort degradation and still corrupt the denominator. It must be typed as operational telemetry.
- **Rejected: gate publication on the current run being fully successful.** All-failed and degraded runs must still build from last-known-good sets so continuity is explicit rather than silently frozen.
- **Rejected: revive closed PR #465.** Its stale branch and short carry-forward cliff conflict with the accepted ADR and current foundation.
- **Rejected: run production migrations automatically on merge or Vercel deploy.** Database changes require an explicit pending-version allowlist, protected environment approval, and post-apply verification.
- **Rejected: let an unhandled builder exception abort scrape terminalization.** Publication failure must preserve the prior active artifact and truthful run outcome.
- **Rejected: expose shadow publications directly to existing readers.** Methodology, caching, rollback, and cross-surface contracts must be validated before cutover.

## Delivery program

### PR 1: Scraper operational-scope telemetry

**Repository:** coffee-scraper
**Boundary:** independently mergeable observability correction

- Classify `shopify_fleet`, `price_index_contract`, and `market_index_contract` as non-supplier operational contracts.
- Exclude operational contracts from supplier totals and Source Health failure rules while retaining their errors and warnings.
- Emit a structured Shopify cohort summary with requested, admitted, successful, products-found, and raw-snapshot counts.
- Render intentional aggregate maintenance as an explicit skipped publication state, not a warning from a failed source.
- Add regression coverage for the observed `44/46`, zero-Shopify, false-critical, and snapshot-summary failure modes.

Acceptance:

- The same logical run reports `44/44` supplier sources.
- Shopify reports `28/28`, 824 products found, and 817 raw snapshots.
- Aida Batlle's trusted empty inventory remains successful.
- Operational warnings remain visible without a `Products found: 0` line.
- Intentional aggregate maintenance creates no Source Health critical.

### PR 2: Guarded database migration release path

**Repository:** coffee-app
**Boundary:** manually dispatched release tooling; no automatic production mutation on merge

Add a reproducible migration release path before applying the foundation:

- a checked-in Supabase project configuration or explicit project-ref input;
- a workflow-dispatch release job protected by the GitHub `production` environment;
- required operator approval before the apply step;
- migration-history and pending-migration output before apply;
- an explicit allowlist of the migration versions approved for that release, with failure on any unexpected pending migration;
- fresh-database replay and focused foundation verification before apply;
- `supabase db push` only after the verification and approval gates;
- post-apply schema, function-grant, migration-version, and type-generation checks;
- an uploaded release log containing versions and checks without secrets;
- no push-triggered or Vercel-triggered production migration.

Required environment inputs are `SUPABASE_ACCESS_TOKEN`, the production project reference, and the database credential required by the CLI. Secret and environment configuration remain an operator action; the workflow must fail closed and explain the missing input.

This PR is required because a merged migration that never reaches production is not a deployed contract. It also prevents future scraper features from silently running in fallback mode for days.

### Deployment gate 3: Provenance foundation readiness

**Owner:** coffee-app database deployment
**Code source:** merged migration `20260713_market_publication_foundation.sql`

Apply the merged additive migration through the normal deployment path before deploying or validating the scraper writer. Do not hand-edit production schema.

Required preflight:

- replay all migrations and `supabase/tests/market_publication_foundation.sql` in a fresh database;
- run `verify:market-publication-migration` and the concurrency verification;
- verify production exposes the expected tables and RPCs to `service_role` and denies direct lifecycle mutations;
- prove the migration version is recorded by production deployment state;
- capture a rollback artifact and confirm rollback means disabling writers, not dropping provenance data.

Exit evidence:

- `scrape_runs`, fenced leases, supplier observation sets, price observations, cohorts, and sealing RPC exist in production;
- the scraper no longer emits the missing-relation shadow warning;
- no reader or legacy aggregate behavior changes.

### Deployment gate 4: Shadow writer activation

Deploy current coffee-scraper `main` after deployment gate 3. Run a low-impact single-source non-production canary, then one scheduled production `all` run.

Acceptance:

- non-production canary creates non-production provenance and cannot publish;
- the production run creates one terminal production run and one outcome per selected supplier;
- complete sets have exact observation counts and immutable children;
- failed/skipped/partial suppliers remain visibly ineligible;
- lease loss, terminalization, and sealing obey the accepted lock order;
- legacy catalog and raw snapshot counts remain consistent with the scraper summary.

Collect at least three production runs before freezing the first cohort. This is an evidence threshold, not a time-based freshness cliff.

### PR 5: Reviewed cohort and shadow policy seed

**Repository:** coffee-app
**Boundary:** independently mergeable versioned configuration with validation, no publication reader

- Seed the reviewed production supplier cohort explicitly from observed production sources.
- Record source weights, enablement, effective dates, and a methodology identifier.
- Freeze the cohort using the existing database-owned lifecycle.
- Add a policy configuration contract for disclosure bands and deterministic candidate comparison.
- Do not encode a carry-forward TTL.
- Reject overlapping effective cohorts, unknown sources, mutable frozen membership, copied cardinality, or policy rewrites.

The first policy version should classify quality from represented supplier weight, represented item coverage, fresh matched weight, carried weight, oldest observation age, failed/unavailable membership, and observation completeness. Initial thresholds remain shadow-only until the comparison report is accepted.

### PR 6: Transactional shadow publication builder with automatic caller

**Repository:** coffee-app
**Boundary:** one migration that creates the builder and its database-owned invocation path; no public reader cutover

Start from current `main`; do not revive or stack on closed PR #465.

The transaction must:

1. serialize by publication date and cohort;
2. select each enabled supplier's newest complete set with known completeness (never `unknown` or `legacy`) at or before the exclusive UTC day cutoff;
3. preserve source observation time and classify each manifest entry as fresh, carried, or unavailable;
4. compute supplier-first segment levels with bounded/versioned cohort weights;
5. compute repricing movement only from fresh supplier-segment pairs matched to the active predecessor;
6. compute assortment entry/exit separately;
7. derive coverage, carried share, fresh-matched share, oldest age, and quality classification;
8. write candidate, manifest, aggregates, movement evidence, and predecessor identity atomically;
9. promote only a whole candidate that deterministically improves on the current same-day publication;
10. remain invisible to existing readers.

Invocation must be database-owned and wired in the same PR. Terminalizing any production-scoped `all` scrape run invokes build-and-activate exactly once after observations are sealed. Terminal non-production runs are rejected by the caller. The terminalization hook must run the builder inside an exception-isolated database subtransaction: builder writes roll back together on failure, the failure is recorded outside that subtransaction, and the truthful scrape-run terminal transition still commits. This avoids an unimplemented external queue while preserving atomic publication replacement. The hook and builder need a bounded execution budget so publication work cannot hold the scrape-run lock indefinitely.

Required adversarial tests:

- all-failed run with last-known-good carry-forward;
- prolonged Shopify outage with honest increasing age;
- zero-result supplier preserving its prior complete set;
- missing cohort member and never-observed member;
- same-day rerun better/worse/equal comparator cases;
- concurrent same-day and adjacent-day builders;
- predecessor replacement after later movement depends on it;
- partial insert or computation failure rollback;
- source-registration changes that do not alter a frozen cohort;
- recovery/test/source/group runs that cannot invoke publication;
- carried suppliers affecting level but never fresh movement;
- assortment change isolated from repricing.

### Gate 7: Shadow comparison and policy acceptance

Build shadow publications for at least 10 successful production runs spanning at least 14 calendar days, and require the evidence set to include a real supplier failure and subsequent recovery. A shorter window may be accepted only when it contains that failure/recovery evidence and the remaining comparison criteria. If no real incident occurs, run and document a controlled supplier failure/recovery rehearsal before cutover. Compare:

- legacy versus supplier-first level and segment composition;
- source and item coverage;
- carried share and oldest observation age;
- fresh-matched movement versus apparent movement from assortment change;
- same-day rerun replacement decisions;
- Shopify failure/recovery behavior;
- null-price and wholesale-only supplier representation.

Produce a checked-in acceptance report. Any threshold or weight change creates a new policy/methodology version; historical artifacts are never rewritten.

### PR 8: Versioned reader/API cutover

**Repository:** coffee-app, with CLI/API consumers updated as required
**Boundary:** reversible consumer switch after Gate 7 shadow comparison and policy acceptance

- Expose active publication identity, cohort, methodology, coverage, freshness, carried share, oldest observation, quality, level, matched movement, and assortment effect.
- Use a compatibility view or versioned shared query contract consumed consistently by web, CLI, and API.
- Gate serving behind a reversible feature flag.
- Preserve legacy readers as the immediate rollback path during the observation window.
- Prevent caches from mixing publication identities or methodology versions.

### Gate 9: Legacy retirement

After a bounded observation window with no rollback:

- stop legacy aggregate computation permanently;
- make legacy tables read-only;
- verify no web, CLI, API, agent, export, or cron consumer reads them;
- document the final methodology and operational runbook;
- retain raw snapshots and provenance according to explicit retention policy;
- remove legacy code only in a separate reviewed cleanup PR.

## Failure handling and operator signals

The run summary must distinguish:

- supplier collection result;
- Shopify cohort admission/result;
- raw snapshot result;
- provenance writer state;
- publication builder state;
- reader-serving state.

No layer may infer another layer's success. A successful catalog run can coexist with a disabled provenance writer or failed publication builder, and the summary must say exactly that.

Minimum terminal summary:

```text
Suppliers: 44/44 successful
Shopify: 28/28 successful; 28 admitted; 824 products; 817 raw snapshots
Raw snapshots: 1,323 written across 39 priced suppliers
Provenance: active|disabled|degraded; run=<id>; complete=<n>; partial=<n>; failed=<n>; skipped=<n>
Publication: active|carried|skipped|failed; publication=<id>; cohort=<version>; quality=<band>; coverage=<value>; carried=<value>; oldest=<age>
Readers: legacy|shadow|publication-v1
```

Alerts page only on real state transitions or failed contracts. Intentional maintenance and trusted empty inventory are status, not incidents.

## Rollback boundaries

- Telemetry PR: revert code; no data rollback.
- Foundation/writer: disable writer and leave additive provenance intact.
- Builder: disable automatic invocation; active shadow artifacts remain immutable and unserved.
- Reader: flip back to legacy reader without mutating publications.
- Never roll back by copying old observations into a new date, deleting provenance, partially patching aggregates, or re-enabling the legacy writer as an emergency shortcut.

## Program completion criteria

- Supplier and operational scopes cannot be confused in summaries or audits.
- Production provenance is deployed, active, and evidenced across multiple runs.
- A reviewed frozen cohort and policy version exist.
- Every production `all` terminal run invokes one transactional publisher.
- Shadow evidence demonstrates truthful behavior through a supplier failure and recovery.
- Web, CLI, API, and agent consumers expose one versioned publication contract.
- Legacy aggregate writers and readers are retired without losing raw evidence or rollback capability.
