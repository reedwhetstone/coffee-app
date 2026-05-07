# PR #347 Verify Audit: Bounded hard-gated similar API

**Date:** 2026-05-07  
**Repo:** `coffee-app`  
**Branch:** `feat/bounded-hard-gated-similar-api`  
**Base:** `origin/main`  
**Commit:** `e533cc7`  
**Verdict:** `ready_with_fixes`

## Operator summary

VERDICT: ready_with_fixes  
P0: 0  
P1: 0  
P2: 2  
P3: 1  
NEXT_ACTION: patch_same_pr

## Scope and intent coverage

PR intent was to replace score-only similar-coffee identity promotion with a bounded, hard-gated `/v1/catalog/{id}/similar` contract. The implementation substantially delivers the main route behavior:

- Adds `find_similar_beans_aggregated_v3` with bounded per-target vector candidate retrieval.
- Adds TypeScript classification with blocker codes for processing, fermentation, country, decaf, blend/single-origin, harvest year, and insufficient structured process.
- Changes endpoint output to include `data.groups.canonical_candidates`, `data.groups.similar_recommendations`, transitional `data.matches`, `meta.classification_version`, and `meta.query_strategy`.
- Preserves entitlement behavior and rate-limit/API-key flow.
- Updates member comparison UI copy to say `Likely same coffee candidate` vs `Similar recommendation` and surfaces blocker reasons.
- Adds focused helper, route, and component tests.

The remaining issues are not merge-blocking P0/P1s, but they are squarely in the PR's stated performance and identity-contract scope and should be patched on this PR before merge.

## Findings

### P2-1: Locked viewer teaser still uses the old full-scan count RPC

**Evidence:**

- `src/routes/v1/catalog/[id]/similar/+server.ts:114-122` calls `countCatalogSimilarityMatches()` for signed-in users without `canUseBeanMatching`.
- `src/lib/server/catalogSimilarity.ts:997-1008` still calls `count_similar_beans_aggregated_v2`.
- `count_similar_beans_aggregated_v2` is the same full cross-join family the implementation plan explicitly said to avoid for exact teaser counts when expensive.

**Why it matters:**

The member success path now uses bounded v3 retrieval, but the denied viewer path can still pay the expensive exact-count cost before returning a 403 teaser. The implementation plan specifically warned: "Avoid exact teaser counts if they require the same expensive full scan. Prefer null, an estimate, or a separate cheap bounded count." This keeps a timeout-prone path attached to the same endpoint and undercuts the performance goal for non-member signed-in callers.

**Fix guidance:**

For this PR, prefer the conservative product-safe patch:

- Return `similar_match_count: null` for locked viewers, or
- Add a bounded count/exists helper that calls v3 with a small bounded candidate pool and marks the result as capped/estimated instead of exact.

Do not keep calling `count_similar_beans_aggregated_v2` synchronously in the entitlement-denied route.

### P2-2: v3 changes `chunk_matches` semantics from distinct dimensions to raw bounded rows

**Evidence:**

- Previous v2 aggregate used `COUNT(DISTINCT s.chunk_type)::INT AS chunk_matches` in `supabase/migrations/20260504_canonical_similarity_contract.sql`.
- New v3 uses `COUNT(*)::BIGINT AS chunk_matches` at `supabase/migrations/20260507_bounded_similarity_candidates.sql:69-79`.
- `classifyCatalogMatch()` treats `chunkMatches >= 2` as identity evidence in `src/lib/server/catalogSimilarity.ts:637-644`.
- `coffee_chunks` schema has no uniqueness constraint on `(coffee_id, chunk_type)`; only `id` is primary key.

**Why it matters:**

If a coffee has multiple chunks for the same dimension, or if multiple target chunks of the same type are added later, v3 can count duplicate same-dimension matches as multiple identity signals. That can make `chunkMatches >= 2` pass from repeated origin-only or processing-only evidence, which weakens the hard-gated identity contract. The old v2 behavior counted distinct chunk types, and the classifier appears to rely on that meaning.

**Fix guidance:**

Preserve dimensional semantics in v3:

- Add a `best_per_dimension` CTE using `DISTINCT ON (coffee_id, chunk_type)` with highest similarity per candidate/dimension.
- Aggregate from that CTE.
- Return `COUNT(DISTINCT chunk_type)::INT` or equivalent as `chunk_matches`.

This also keeps the average from being skewed by duplicate same-dimension rows.

### P3-1: `deriveMatchCategory()` remains score-only despite the plan naming it as a semantic update

**Evidence:**

- `src/lib/server/catalogSimilarity.ts:454-471` still promotes `likely_same` based only on score dimensions and chunk count.
- Current production normalization bypasses it by using `classifyCatalogMatch()` when target context is passed, but the exported helper and its test still encode the old score-only semantics.

**Why it matters:**

This is not currently breaking the endpoint because `fetchCatalogSimilarityMatches()` passes target context to `normalizeSimilarityRow()`. It is still a maintenance trap: the implementation plan explicitly called out updating `deriveMatchCategory()` semantics so embedding score is necessary but not sufficient. Keeping an exported helper with the old name and old behavior invites future callers/tests to reintroduce score-only identity language.

**Fix guidance:**

Either:

- Deprecate/remove `deriveMatchCategory()` if classification is now the only source of category truth, or
- Change it to accept `CatalogMatchClassification` / gate result and derive category from `classification.kind`.

Update tests so old score-only promotion is not preserved as the documented helper behavior.

## Validation run

- `pnpm exec vitest run src/lib/server/catalogSimilarity.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts`  
  Result: pass, 33 tests.
- `pnpm check --fail-on-warnings`  
  Result: pass, 0 errors, 0 warnings.
- `pnpm run lint`  
  Result: pass, Prettier and ESLint clean.

## Product alignment

The PR is directionally well aligned with `notes/PRODUCT_VISION.md`: it strengthens truthful coffee data, reduces opaque score-only identity claims, and keeps the API contract machine-readable. It also aligns with ADR-002 by implementing the catalog-adjacent machine contract under `/v1/`, ADR-004 by respecting structured process nulls as missing evidence, and ADR-005 by preserving member/API entitlement enforcement server-side.

Patch the two P2s before merge so the performance and identity semantics match the plan instead of merely improving the happy path.
