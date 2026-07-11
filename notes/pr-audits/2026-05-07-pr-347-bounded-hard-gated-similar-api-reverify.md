# PR #347 Reverify Audit: Bounded hard-gated similar API

**Date:** 2026-05-07
**Repo:** `coffee-app`
**Branch:** `feat/bounded-hard-gated-similar-api`
**Base:** `origin/main`
**Commit reviewed:** `3fd0214`
**Prior verify report:** `notes/pr-audits/2026-05-07-pr-347-bounded-hard-gated-similar-api.md`

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 0
P3: 1
NEXT_ACTION: patch_same_pr
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_with_followups

## Scope and intent coverage

The PR still matches the intended independently mergeable slice: replace score-only likely-same promotion with a bounded, hard-gated `/v1/catalog/{id}/similar` contract while preserving entitlement and fallback behavior.

The prior P2 findings are fixed:

1. **Locked viewer 403 teaser no longer calls the expensive count path.** `src/routes/v1/catalog/[id]/similar/+server.ts:106-121` returns `similar_match_count: null` before creating the admin Supabase client or invoking similarity RPCs. The route tests at `src/routes/v1/catalog/[id]/similar/similar.test.ts:245-260` assert the null teaser and `rpc` non-use.
2. **v3 `chunk_matches` is back to distinct dimensions.** `supabase/migrations/20260507_bounded_similarity_candidates.sql:69-85` adds `best_per_dimension` and returns `COUNT(DISTINCT bpd.chunk_type)::BIGINT`, preserving the dimensional semantics consumed by `classifyCatalogMatch()`.
3. **The stale score-only `deriveMatchCategory()` helper is removed.** `src/lib/server/catalogSimilarity.ts` no longer exports or references `deriveMatchCategory`; classification is now driven by `classifyCatalogMatch()` and production normalization passes target context at `src/lib/server/catalogSimilarity.ts:970-972`.

The implementation remains aligned with `notes/PRODUCT_VISION.md`: it improves truthful machine-readable coffee data, avoids opaque score-only identity claims, and keeps the catalog-adjacent API under `/v1/` in the direction of ADR-002. Server-side entitlement handling remains consistent with ADR-005.

## Findings

### P3-1: API docs still describe the removed locked teaser count

**Evidence:**

- Runtime response now always returns `teaser.similar_match_count: null` for insufficiently entitled signed-in callers in `src/routes/v1/catalog/[id]/similar/+server.ts:115-118`.
- Tests now lock that behavior in `src/routes/v1/catalog/[id]/similar/similar.test.ts:245-260` and `263-267`.
- Docs still say viewer sessions can receive a locked teaser count in `src/lib/docs/content.ts:773-776`.
- The 403 error example still shows `"similar_match_count": 4` in `src/lib/docs/content.ts:852-855`.

**Why it matters:**

This is not a runtime blocker, but it is a public API documentation mismatch introduced by the correct performance patch. The whole reason for the patch was to avoid exact teaser counts on the denied path, so docs should not keep promising that count.

**Fix guidance:**

Update `src/lib/docs/content.ts` so the entitlement bullet and 403 example state that locked teasers currently return `similar_match_count: null`. If a future bounded estimate ships, document that as a separate estimated/capped field rather than an exact count.

## Previous findings rechecked

### Prior P2: locked viewer count path

**Status:** fixed.

The route now checks `!capabilities.canUseBeanMatching` before `createAdminClient()` and returns a 403 body with `similar_match_count: null`. There is no remaining reference to `countCatalogSimilarityMatches()` or `count_similar_beans_aggregated_v2` in the active route/service path. Remaining `count_similar_beans_aggregated_v2` references are database type/history/migration artifacts, not the endpoint code path.

### Prior P2: v3 raw row `chunk_matches`

**Status:** fixed.

The SQL now deduplicates by `(coffee_id, chunk_type)` before aggregation and uses `COUNT(DISTINCT bpd.chunk_type)`. This prevents repeated same-dimension rows from satisfying the classifier's `chunkMatches >= 2` identity evidence rule.

### Prior P3: stale score-only `deriveMatchCategory()`

**Status:** fixed.

The helper and its test were removed. The production path calls `normalizeSimilarityRow(..., target)`, and `classifyCatalogMatch()` applies target/candidate hard gates plus evidence checks before `canonical_candidate` promotion.

One lower-risk caveat remains: `classifyCatalogMatch()` still accepts an optional target, so direct helper misuse without target context can still classify from score evidence alone. I am not counting that as a separate finding because the stale exported `deriveMatchCategory()` trap was removed and the endpoint path always supplies target context. A future hardening cleanup could make target required for canonical classification.

## Mergeability assessment

The PR is independently mergeable from a runtime/API behavior perspective. It does not require the later calibration golden set, durable identity schema, CLI parity, or review queues to make the current endpoint coherent.

The only remaining issue is a small docs mismatch. Because this endpoint is an API surface, I recommend patching it on the same PR before merge rather than deferring.

## Validation

- `pnpm exec vitest run src/lib/server/catalogSimilarity.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts`
  **VALIDATION_PASS:** 3 files, 28 tests passed.
- `pnpm check --fail-on-warnings`
  **VALIDATION_PASS:** 0 errors, 0 warnings.
- `pnpm run lint`
  **VALIDATION_PASS:** Prettier and ESLint passed.

## Final verdict

`ready_with_fixes`: no P0/P1/P2 issues remain. Patch the docs inconsistency, then the PR can move to merge-ready.
