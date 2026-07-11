# PR #302 Verification: Public Catalog Process Transparency Facets

**Date:** 2026-04-28
**Repo:** `reedwhetstone/coffee-app`
**Branch:** `feat/public-catalog-process-facets`
**Head:** `c23574bd7d18feb69fe251de7ed7484223c6ccf3`
**Verifier:** OpenClaw verify-pr subagent

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 0
P3: 1
NEXT_ACTION: patch_same_pr
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

## Validation

- `pnpm vitest run src/lib/catalog/urlState.test.ts src/lib/stores/filterStore.test.ts src/routes/catalog/page.server.test.ts src/lib/components/CoffeeCard.svelte.test.ts`: VALIDATION_PASS, 4 files / 21 tests passed.
- `pnpm check --fail-on-warnings`: VALIDATION_PASS, svelte-check found 0 errors and 0 warnings.
- `git diff --check origin/main...HEAD`: VALIDATION_PASS.

## Context reviewed

- Verify artifacts: `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff` in `.verify-pr/20260428T183807Z-feat-public-catalog-process-facets`.
- Product direction: `notes/PRODUCT_VISION.md`.
- Processing transparency architecture: `notes/decisions/004-processing-transparency-schema-api.md`.
- Implementation plan: `notes/implementation-plans/2026-04-27-processing-transparency-discovery-funnel.md` and `notes/implementation-plans/2026-04-27-processing-transparency-discovery-funnel-pr-01-public-catalog-facets.md`.
- Changed code in repo context, especially `src/lib/catalog/urlState.ts`, `src/lib/stores/filterStore.ts`, `src/routes/catalog/+page.server.ts`, `src/routes/catalog/+page.svelte`, `src/lib/components/CoffeeCard.svelte`, and related tests.

## Verdict rationale

The slice boundary is correct and independently mergeable in concept. It uses the existing `/v1/catalog` contract, makes the public catalog URL-state aware of process transparency fields, adds public controls, and renders process analysis from the nested `coffee.process` object without backend or schema work. That aligns well with `PRODUCT_VISION.md`: public value becomes more legible, and the implementation consumes the canonical data contract instead of inventing a web-only backend path.

However, there is one user-visible truthfulness defect that violates the plan's most important acceptance criterion: missing or placeholder process values can be displayed as real process analysis.

## Findings

### P1: Placeholder process values are surfaced as meaningful process transparency claims

**Status:** confirmed defect

`CoffeeCard.svelte` filters only `unknown`, `not specified`, and `n/a` in `cleanProcessText()` (`src/lib/components/CoffeeCard.svelte:98-106`). It does not suppress `None Stated`, even though the repo's own fixtures show `fermentation_type: 'None Stated'` as a real catalog metadata value (`src/routes/api/catalog/filters/filters.test.ts:18`, `src/lib/server/catalogResource.test.ts:91`). The card then renders any non-null fermentation value as `Fermentation: <value>` (`src/lib/components/CoffeeCard.svelte:157-159`).

Concrete bad outcome: a catalog resource with `process.fermentation_type = 'None Stated'` renders `Fermentation: None Stated` inside the new Process analysis block. The advanced filter dropdown also exposes the same value as a normal fermentation facet because `/catalog` renders `$filterStore.uniqueValues.fermentation_type` directly (`src/routes/catalog/+page.svelte:322-325`).

This conflicts with ADR-004 and the PR acceptance criterion that missing structured metadata must not render fake `none`, `unknown`, or low-confidence claims. The fix should be in this PR because this PR is the first public UI surface for those fields.

**Recommended fix:** centralize process-display normalization for public UI values. Treat `none stated`, `not stated`, `not disclosed`, `unspecified`, `unknown`, `n/a`, and blank values as missing for display purposes, while preserving explicit additive `['none']` semantics as a separate case. Use that same normalization to omit placeholder options from process transparency dropdowns or relabel them as a clearly missing-data filter only if the product intentionally wants that. Add a CoffeeCard test for `fermentation_type: 'None Stated'` and, ideally, a page/control test or option-normalization unit test.

### P3: Page-level control behavior is mostly covered through stores, not an actual catalog component interaction test

**Status:** coverage concern, not a blocker by itself

The focused tests cover URL parsing/serialization, store request serialization/clearing, SSR query plumbing, and CoffeeCard rendering. They do not directly render `/catalog` and interact with the new advanced controls. Given `pnpm check` and the store tests pass, this is acceptable for this slice, but the gap made the placeholder dropdown exposure easier to miss.

**Recommended follow-up:** after the P1 patch, add a lightweight Svelte test around the process option normalization or the advanced process control rendering. A full browser smoke is optional if local browser validation is available.

## Intent coverage audit

- **URL hydration:** implemented. `parseCatalogUrlState()` reads `processing_base_method`, `fermentation_type`, `process_additive`, `processing_disclosure_level`, and valid `processing_confidence_min` values into filter state.
- **Shareable URLs:** implemented. `buildCatalogShareParams()` preserves active process filters and omits default page/limit noise.
- **Canonical request names:** implemented. Client fetches use `/v1/catalog` with canonical query names, and SSR maps those URL names into the shared catalog search options.
- **Controls set/combine/clear:** implemented through `filterStore.setFilter()` and `clearFiltersByKeys()`, with tests proving process filters combine with country/legacy process filters and clear without dropping unrelated filters.
- **CoffeeCard process analysis:** mostly implemented, but blocked by the P1 placeholder-normalization defect.
- **No backend/schema changes:** satisfied.
- **Anonymous preview and CTA:** preserved; no change observed that breaks the 15-card preview or signup CTA.
- **Scope hygiene:** acceptable. Blog note changes are mechanical formatting to satisfy repo-wide formatting.

## Product alignment

Strong overall. This PR makes process transparency visible on the public catalog, which supports the product vision's emphasis on truthful coffee data, public proof before the paywall, and consistency with the API contract. The only serious product risk is the placeholder-value display issue, because it undermines the same trust claim the feature is meant to prove.

## Required next action

Patch PR #302 in the same branch to suppress or clearly distinguish placeholder process values, then re-run:

1. `pnpm vitest run src/lib/components/CoffeeCard.svelte.test.ts src/lib/catalog/urlState.test.ts src/lib/stores/filterStore.test.ts src/routes/catalog/page.server.test.ts`
2. `pnpm check --fail-on-warnings`
3. `git diff --check origin/main...HEAD`

After that, re-run verify on the patched PR.
