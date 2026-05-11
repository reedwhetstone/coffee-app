# PR #372 Verify Audit: Analytics Validation Baseline Cleanup

VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 1
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:

- Restore the top-level verify contract structure in `notes/pr-audits/2026-05-07-pr-355-bean-identity-review.md` by inserting a blank line after the second `TOP_FIXES` bullet so `CONFIDENCE`, `SCOPE_ASSESSMENT`, and `VALIDATION_STATUS` are not parsed as part of that bullet.
  CONFIDENCE: high
  SCOPE_ASSESSMENT: mergeable
  VALIDATION_STATUS:
- `pnpm exec prettier --check package.json src/routes/analytics/+page.svelte src/routes/analytics/page.svelte.test.ts notes/blog/source-map.md notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md notes/implementation-plans/2026-05-08-open-listing-schema-validator.md notes/implementation-plans/2026-05-08-parchment-intelligence-cli-activation.md notes/pr-audits/2026-05-07-pr-355-bean-identity-review.md notes/blog/outlines/chat-and-canvas-are-two-different-kinds-of-thinking.md`: VALIDATION_PASS
- `pnpm test`: VALIDATION_PASS
- `pnpm check`: VALIDATION_PASS
- `pnpm lint`: VALIDATION_PASS
- `git diff --check origin/main...HEAD && pnpm exec vitest run src/routes/analytics/page.svelte.test.ts`: VALIDATION_PASS

## Summary

PR #372 mostly satisfies the stated intent. It makes the local `pnpm test` command use Vitest's non-watch runner directly, keeps analytics arrival and delisting window tests deterministic by anchoring the client-side cutoff to the page's analytics freshness date, and formats the files that were causing Prettier failures. The code slice is independently mergeable and does not expand the analytics intelligence refactor scope.

One introduced documentation regression should be patched before merge: Prettier reformatted an existing verify report in a way that nests the `CONFIDENCE`, `SCOPE_ASSESSMENT`, and `VALIDATION_STATUS` contract fields under the second `TOP_FIXES` bullet. That makes a previously top-level operator contract harder to parse and undermines the validation-baseline cleanup goal.

## Evidence reviewed

- PR artifacts from `.verify-pr/20260511T013542Z-fix-analytics-validation-cleanup/`: `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, `full.diff`
- Product direction: `notes/PRODUCT_VISION.md`
- Relevant ADRs:
  - `notes/decisions/003-public-analytics-three-chart-free-gate.md`
  - `notes/decisions/005-catalog-access-level-positioning.md`
  - `notes/decisions/002-api-first-external-internal-split.md`
- Changed implementation files:
  - `package.json`
  - `src/routes/analytics/+page.svelte`
  - `src/routes/analytics/page.svelte.test.ts`
- Changed documentation and planning files listed in `changed_files.txt`

## Intent coverage

- Preserve local workspace cleanup: mostly satisfied. The branch is a single cleanup commit and avoids analytics-refactor feature expansion.
- Fix local validation blockers found on `origin/main`: satisfied for the tested local gates. `pnpm test`, `pnpm check`, and `pnpm lint` all pass in this checkout.
- Make `pnpm test` exit reliably: satisfied. `package.json` now runs `vitest run` directly instead of invoking the watch-mode `test:unit` script with forwarded `--run`.
- Make analytics arrival and delisting window tests deterministic against fixture data: satisfied. `movementWindowCutoff()` anchors 7-day and 30-day movement filters to `stats.lastUpdated` when present, and the fixture uses `lastUpdated: '2026-04-08'` with dates that now deterministically exercise both windows.
- Reformat files that were failing Prettier: mechanically satisfied by Prettier checks, but one reformatted audit file has a semantic markdown issue called out below.
- Do not expand analytics refactor scope: satisfied. The analytics code change is local to the existing arrival and delisting window filtering behavior.

## Findings

### P2: Reformatting corrupted the top-level contract in an existing verify report

Confirmed defect.

`notes/pr-audits/2026-05-07-pr-355-bean-identity-review.md` now renders `CONFIDENCE`, `SCOPE_ASSESSMENT`, and `VALIDATION_STATUS` as continuation text under the second `TOP_FIXES` bullet because those lines are indented by two spaces and there is no blank line separating them from the list.

Current changed structure:

```markdown
- Replace the manual `database.types.ts` additions with generated Supabase types when typegen is available.
  CONFIDENCE: medium
  SCOPE_ASSESSMENT: mergeable_with_followups
  VALIDATION_STATUS:
- CI Code Quality run 25492544291: VALIDATION_PASS
```

`origin/main` had these fields at top level. The current branch intended to clean validation and report formatting, but this change makes a saved verify report less machine-readable and less consistent with the verify-pr output contract.

Recommended correction:

- In `notes/pr-audits/2026-05-07-pr-355-bean-identity-review.md`, insert a blank line after the second `TOP_FIXES` bullet.
- Ensure the contract block reads:

```markdown
TOP_FIXES:

- Before any UI, scraper, or automation caller uses these helpers for production review actions, wrap link/identity/event transitions in a single database transaction or RPC so audit events cannot drift from state transitions.
- Replace the manual `database.types.ts` additions with generated Supabase types when typegen is available.

CONFIDENCE: medium
SCOPE_ASSESSMENT: mergeable_with_followups
VALIDATION_STATUS:
```

This is a same-PR cleanup fix. It does not require rescoping.

## Non-blocking observations

- `src/routes/analytics/+page.svelte` now uses `stats.lastUpdated` as the movement-window anchor. That is a reasonable deterministic test seam because the page already presents `stats.lastUpdated` as analytics freshness. If analytics movement data later decouples from `market_daily_summary.snapshot_date`, consider returning a dedicated `movementAsOfDate` from `+page.server.ts` instead of piggybacking on `stats.lastUpdated`.
- The analytics test clicks the first `30d` button, relying on shared `windowMode` to update both arrivals and delistings. That matches current component behavior.

## Product and architecture alignment

The branch aligns with `notes/PRODUCT_VISION.md` and ADR-003. It preserves the analytics access boundary: arrivals, delistings, supplier comparison, and deeper origin analytics remain behind Parchment Intelligence, while public charts remain the proof surface. It does not add new public leverage tooling, new routes, or new entitlement bypass risk.

The package script change improves agent and CI ergonomics without touching product behavior. It also fits the repo's API-first and agent-first operating model by making the default test command predictable for automation.

## Scope assessment

`SCOPE_ASSESSMENT: mergeable`. The PR can remain a validation-baseline cleanup slice. The one P2 is a local markdown correction inside the same cleanup surface, not evidence that the PR boundary is wrong.

## Validation details

- `pnpm exec prettier --check ...changed files...`: passed.
- `pnpm test`: passed, 59 files and 578 tests.
- `pnpm check`: passed, 0 Svelte errors and 0 warnings.
- `pnpm lint`: passed, full Prettier check plus ESLint.
- `git diff --check origin/main...HEAD && pnpm exec vitest run src/routes/analytics/page.svelte.test.ts`: passed. The targeted Vitest run logged the expected intentional `chunk load failed` error from the deferred-import failure-state test, but the test file passed all 7 tests.
