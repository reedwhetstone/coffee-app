# PR #377 Verify: Analytics Command Center Layout

**Date:** 2026-06-07  
**Repo:** `/root/.openclaw/workspace/worktrees/openclaw-feature-builder-coffee-app-analytics-command-center-1780841967`  
**Base:** `origin/main`  
**Head:** `9d2cc08e02d2af8576ace5b0dc4fb6a70682745e`  
**Branch:** `feat/analytics-command-center-layout`  
**Artifacts:** `.verify-pr/20260607T143159Z-feat-analytics-command-center-layout`

## Verdict

`ready_with_fixes`. The PR is the right slice and mostly satisfies the PR 03 intent: `/analytics` now reads more like a market command center, keeps backend scope unchanged, uses existing data only, preserves the Parchment Intelligence boundary for named premium tables, and adds tests for the new hierarchy. Two product/UX consistency issues should be patched before merge because both are local to this PR and easy to fix.

## Findings

### P2: Analytics metadata still uses the retired Purveyors Price Index name

**Evidence:** `src/routes/analytics/+page.svelte` now frames the page body and data source as **Parchment Market Index** (`h1` around lines 518-523, data source copy around lines 1355-1358). That matches the locked implementation-plan naming. But `src/routes/analytics/+page.server.ts` still emits SEO and schema metadata using **Purveyors Price Index**:

- `schemaService.generateDatasetSchema({ name: 'Purveyors Price Index — Green Coffee Market Data', ... })` around line 402
- `title: 'Green Coffee Market Visibility | Purveyors Price Index'` around line 456
- `ogTitle: 'Green Coffee Market Visibility — Purveyors Price Index'` around line 467

**Why it matters:** PR 03 is a framing and naming pass. Leaving browser/social/search metadata on the old brand makes external/public surfaces contradict the page body and the canonical implementation plan. This is not a backend issue; it is the same route and should be fixed in the same PR.

**Suggested fix:** Rename those analytics-route metadata strings to Parchment Market Index while leaving internal entitlement abbreviations such as `ppi_access` alone.

### P2: The action rail is buried below the entire premium/gated module block

**Evidence:** The new action rail is rendered after the whole Parchment Intelligence section, not immediately after the public evidence layer:

- Public evidence charts end around `src/routes/analytics/+page.svelte` line 785.
- The gated or premium block spans roughly lines 787-1317.
- The action rail starts around line 1319.

The new hierarchy test only asserts `evidenceCharts` before `actionRail`; it does not catch that a large premium preview or full paid module stack sits between them.

**Why it matters:** The PR intent is a command-center layout: market read, controls, KPI strip, insight cards, evidence, then bounded action context. The action rail currently becomes a footer after the paywall/premium modules, especially bad for logged-out and mobile users. That weakens the central UX goal even though the rail itself is honest and routes only to existing surfaces.

**Suggested fix:** Move the action rail directly after the public evidence charts, before the non-PI gated preview / PI premium module block. If the paid version needs a second contextual action rail later, that can be a follow-up, but this PR’s basic rail should stay attached to the command-center read.

## Confirmed good

- The branch head is the amended `9d2cc08`, matching the updated artifacts.
- No tracked working-tree changes were present during review; only an untracked `pr-body.md` exists outside the PR diff.
- Public and signed-in viewer behavior remains the same baseline surface per tests.
- Named arrivals/delistings remain behind the Parchment Intelligence boundary. The new public KPI counts are supported by the PR 03 implementation plan, which explicitly calls for movement cards with new-arrival and delisting counts.
- The action rail copy avoids fake persistence and explicitly says watchlists, alerts, saved briefs, and persistent actions are out of scope.
- Validation passed:
  - `pnpm exec vitest run src/routes/analytics/page.svelte.test.ts`: 8/8 tests passed.
  - `pnpm check`: 0 errors, 0 warnings.
  - Earlier accidental broad run `pnpm test -- --run src/routes/analytics/page.svelte.test.ts` also completed with 70 files / 627 tests passed, though the argument shape caused Vitest to run the broader suite.

## Scope assessment

The slice boundary is right. The fixes above are local copy/placement corrections inside the two changed files, not evidence that the PR needs new backend work, entitlement changes, or rescoping.
