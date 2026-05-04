# PR 07: Scraper Resolution Pipeline

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Make the scraper propose and, only when calibrated confidence is high, link catalog rows into canonical identities after ingestion.

## Why this slice comes now

The scraper owns fresh catalog changes. Identity resolution should run near ingestion so new listings become candidates quickly and so repeated supplier updates improve the graph over time.

## In-scope

- In `coffee-scraper`, add a post-scrape identity resolution step.
- For new or materially changed catalog rows, query the canonical matching service or DB RPC using calibrated thresholds.
- Create candidate links for ambiguous matches.
- Auto-link only above the conservative high-confidence threshold and only when hard constraints agree.
- Create new provisional identities when no match exists and product rules allow it.
- Respect rejected candidates so the same false positive does not reappear every run.
- Add audit logging and tests.

## Out-of-scope

- UI review queue polish.
- Public identity pages.
- Broad backfill across the full historical catalog in the first PR.
- Any deletion of embeddings for unstocked rows.

## Files to change

- `repos/coffee-scraper/scrape/` identity resolution module
- `repos/coffee-scraper/scrape/utils/database.ts` or post-processing orchestration
- `repos/coffee-scraper/scrape/types/interfaces.ts`
- Coffee-scraper tests for candidate, auto-link, reject-respect, and no-match behavior
- Possibly coffee-app service or RPC helpers if the scraper imports shared endpoint logic by HTTP

## Acceptance criteria

- New rows generate candidate identity work without blocking scrape completion.
- Auto-link happens only in the high-confidence band and only when hard blockers pass.
- Ambiguous matches are review candidates, not accepted identities.
- Rejected pairs stay rejected unless source data or embedding version materially changes.
- The pipeline never deletes embeddings based on stock status.
- The pipeline writes adaptive identity/candidate overlays only; it does not mutate or destroy core `coffee_catalog` source rows.

## Test plan

- Unit tests for hard blockers: different country, incompatible process, conflicting harvest year when known, blend vs single-origin mismatch.
- Unit tests for candidate state transitions.
- Integration-style test with mocked Supabase responses.
- Dry-run command or log-only mode before enabling writes.

## Risks

- Scrape runtime could grow. Run resolution only for changed rows and cap candidate checks.
- False positives could poison identity data. Default to candidate state until calibration and manual review justify auto-linking.
- Cross-repo release sequencing matters. Coffee-app schema must be deployed before scraper writes.

## Exact follow-on dependency

PR 08 consumes accepted identities and candidate state to render canonical merged views.
