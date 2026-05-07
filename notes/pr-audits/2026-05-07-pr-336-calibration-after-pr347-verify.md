# PR #336 Verify Audit: Calibration harness after PR #347

**Date:** 2026-05-07  
**Repo:** `coffee-app`  
**Branch:** `fix/pr336-merge-main`  
**Base:** `origin/main`  
**PR:** #336

## Operator summary

VERDICT: fail  
P0: 0  
P1: 1  
P2: 0  
P3: 0  
NEXT_ACTION: patch_same_pr  
CONFIDENCE: high  
SCOPE_ASSESSMENT: mergeable_after_targeted_patch

## Scope and intent coverage

The PR mostly keeps the still-valid calibration slice: it adds a source-safe golden fixture, a deterministic smoke script, threshold constants, unit coverage, and a calibration note that correctly distinguishes score bands from the hard-gated classifier. The harness runs against `classifyCatalogMatch()` and the local script passes with 8/8 expected rows.

However, the conflict resolution reintroduces an exported score-only `deriveMatchCategory()` helper that current main had intentionally removed during PR #347 reverify. That violates the explicit update requirement to avoid stale score-only identity logic after the bounded hard-gated similar API landed.

## Findings

### P1-1: `deriveMatchCategory()` reintroduces the stale score-only likely-same helper removed by PR #347

**Evidence:**

- `src/lib/server/catalogSimilarity.ts:515-523` exports `deriveMatchCategory(input: CatalogSimilarityScoreInput)` and maps `auto_link_candidate` / `likely_same` score bands directly to product `CatalogMatchCategory = 'likely_same'`, with no target/candidate context and no hard blockers.
- `src/lib/server/catalogSimilarity.test.ts:241-253` adds tests that exercise this score-only helper as category behavior.
- Current main's PR #347 reverify explicitly recorded removal of this exact trap: `notes/pr-audits/2026-05-07-pr-347-bounded-hard-gated-similar-api-reverify.md:27-30` and `66-72` state that `deriveMatchCategory()` was removed so classification is driven by `classifyCatalogMatch()` with target context.

**Why it matters:**

The production endpoint currently still uses `classifyCatalogMatch()` through `normalizeSimilarityRow(..., target)`, so this is not an immediate route behavior regression. But it is a shared exported server helper whose name and return type are product-facing category semantics, not merely calibration semantics. Merging it would recreate the precise maintenance hazard PR #347 fixed: future web, API, CLI, or agent code could call the helper and label rows `likely_same` from scores alone, bypassing country/process/decaf/blend/harvest/evidence gates.

That is directly contrary to this PR's rebase intent: calibration should run against the shared hard-gated classifier and avoid stale score-only identity logic.

**Fix guidance:**

Remove the exported `deriveMatchCategory()` helper and its test assertions. Keep `deriveCalibrationBand()` as the score-band primitive, because the note correctly frames `auto_link_candidate` as a calibration band rather than a product state. Any product category or response grouping should continue to flow from `classifyCatalogMatch()` / `classification.kind` with target and candidate context. If a convenience mapper is needed for the calibration script, keep it private to the script and name it as calibration-only, not `CatalogMatchCategory`.

## Non-findings

- No stale route/count behavior was reintroduced in the changed files. The PR no longer touches the denied teaser count path or the similar route.
- The calibration fixture and script are coherent as a seed safety floor. `pnpm exec tsx scripts/catalog-similarity-calibration.ts --json` passes with 8/8 expected rows, zero auto-link false positives, zero likely-or-better false positives, zero hard-gated canonical false positives, and zero clear non-match rejection misses.
- The documentation note is product-aligned: it says score bands are inputs, not accepted identity claims, and calls out the hard-gated classifier as the source of truth after PR #347.

## Validation

- `pnpm exec tsx scripts/catalog-similarity-calibration.ts --json`  
  **VALIDATION_PASS:** 8 examples, 8/8 expectations, zero false positives in the guarded metrics.
- CI evidence supplied by the requester: Format/Check/Lint, Playwright, CodeQL, GitGuardian, and Vercel are green.
- Local targeted vitest remained environment-blocked per requester evidence due to the temp worktree module symlink issue; not re-run as a blocker because CI covered repo checks.

## Final verdict

Patch the same PR before merge. The patch should be small: remove or privatize the score-only category helper and keep calibration consumers on `deriveCalibrationBand()` plus `classifyCatalogMatch()`.
