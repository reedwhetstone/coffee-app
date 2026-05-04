# PR #331 Re-verify Audit: Canonical Similarity API

VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 0
P3: 2
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Remove trailing whitespace from `notes/pr-audits/2026-05-04-pr-331-canonical-similarity-api.md` so `git diff --check` is green.
- Decide whether the residual `mode` filtering under-return edge is acceptable for beta, or overfetch beyond the public max/apply category filtering before SQL limit.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_with_followups
VALIDATION_STATUS:
- `git diff --check origin/main...HEAD`: VALIDATION_FAIL, trailing whitespace in the newly added prior audit markdown file.
- `pnpm vitest run src/lib/server/catalogSimilarity.test.ts src/lib/server/catalogAccess.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts`: VALIDATION_PASS
- `pnpm vitest run src/lib/server/catalogSimilarity.test.ts src/lib/server/catalogAccess.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/routes/catalog/page.svelte.test.ts`: VALIDATION_FAIL, `src/routes/catalog/page.svelte.test.ts` fails on `Invalid Chai property: toBeInTheDocument`; the only PR diff in that file adds `canUseBeanMatching` fixture fields, while the failing matcher assertions already exist on `origin/main`.
- `pnpm check`: VALIDATION_PASS

## Scope and context

Reviewed follow-up patch commit `c391095` on `feat/canonical-similarity-api` against `origin/main`, using the generated artifacts in `.verify-pr/20260504T163610Z-feat-canonical-similarity-api`. Also re-read `notes/PRODUCT_VISION.md` and ADR-005 because this PR touches premium catalog leverage and route-level entitlement.

The product direction still fits: matching/comparison is member/API leverage, public/viewer surfaces may prove value with safe teaser copy/counts, and the canonical route keeps web/API/agent semantics aligned.

## Prior findings re-check

### Prior P1: v2 RPCs granted to broad `authenticated`

**Status: resolved.**

`supabase/migrations/20260504_canonical_similarity_contract.sql` now revokes the new v2 functions from `PUBLIC`, `anon`, and `authenticated`, then grants only `service_role`:

- `find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN)`
- `find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN)`
- `count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN)`

The SvelteKit route calls these through `createAdminClient()`, so the member/API checks in `src/routes/v1/catalog/[id]/similar/+server.ts` are now the intended gate for the v2 premium contract.

Legacy v1 RPCs remain public in `supabase/migrations/20260321_similarity_infrastructure.sql`, but the new migration explicitly documents that as a compatibility gap until CLI/tool callers migrate. That is still real product/security debt before a UI markets matching as fully premium, but it is no longer a blocker for this v2 endpoint slice because the new route does not broaden the legacy exposure.

### Prior P2: 1 lb baseline used ineligible higher-minimum tiers

**Status: resolved.**

`getPriceFromTiersAtQuantity()` now returns `null` when no tier has `min_lbs <= quantityLbs`, instead of falling back to the lowest higher-minimum tier. `normalizeCanonicalPricing()` therefore no longer labels a 5 lb-only tier as a 1 lb baseline. `src/lib/server/catalogSimilarity.test.ts` covers both the null case and the legacy `cost_lb` fallback case.

### Prior P3: teaser count field misnamed `likely_match_count`

**Status: resolved.**

The 403 teaser response now uses `similar_match_count`, matching the broader count semantics of `count_similar_beans_aggregated_v2`. Route tests and the implementation plan were updated.

### Prior P3: mode filtering after SQL limit

**Status: improved, but not perfectly closed.**

Mode-specific requests now call the RPC with `match_count: MAX_CATALOG_SIMILARITY_LIMIT` and filter/slice in service code, with a regression test proving `likely_same` rows are not hidden by a smaller caller limit.

Residual edge: because `MAX_CATALOG_SIMILARITY_LIMIT` is also the public maximum `limit`, a request such as `mode=likely_same&limit=25` can still under-return if the top 25 SQL rows by average similarity are all `similar_profile` and likely-same candidates exist below that cut. This is not a beta blocker, but the contract is still approximate. A fully correct fix would either overfetch beyond the public response cap or compute category/mode before applying the SQL limit.

## New findings

### P3: `git diff --check` now fails on trailing whitespace in the added prior audit report

**File:** `notes/pr-audits/2026-05-04-pr-331-canonical-similarity-api.md`

The new prior audit markdown file has trailing spaces on lines 3-7. This is not product logic, but it makes the standard diff hygiene gate fail and contradicts the earlier report's validation claim.

Correction: strip trailing whitespace from the added audit report.

### P3: one included component test command is not locally green, but failure appears baseline/test-harness related

**File:** `src/routes/catalog/page.svelte.test.ts`

The exact broader test command from the prior report fails because `toBeInTheDocument` is not registered as a Chai matcher in `src/routes/catalog/page.svelte.test.ts`. The PR's diff in that file only adds `canUseBeanMatching` to existing fixture capability objects; the failing matcher assertions and `@testing-library/jest-dom/vitest` import already exist on `origin/main`.

This does not invalidate the similarity API patch, and the focused server/route tests all pass. Still, the branch should not claim that broader command passed unless the matcher setup issue is fixed or the command is narrowed to the PR-owned test surface.

## Mergeability assessment

The prior P1/P2 blockers are fixed. The slice is independently coherent: v2 RPCs are service-role only, the route enforces `canUseBeanMatching`, 1 lb price deltas no longer use ineligible bulk tiers, and teaser semantics no longer overclaim likely-same counts.

I would not call this fully merge-ready until the trivial diff-check issue is patched. After that, the remaining mode-filter edge and legacy v1 RPC compatibility debt can be tracked as follow-ups before member UI launch.
