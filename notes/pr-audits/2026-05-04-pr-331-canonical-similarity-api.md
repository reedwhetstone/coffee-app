# PR #331 Verify Audit: Canonical Similarity API

**Date:** 2026-05-04  
**Reviewer:** OpenClaw verify-pr subagent  
**Base:** `origin/main`  
**Head:** `HEAD` / `feat/canonical-similarity-api`  
**Verdict:** `ready_with_fixes`  
**Scope assessment:** `mergeable_with_followups`

## Operator summary

```text
VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 2
P3: 2
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Remove direct non-member RPC execution paths for the new v2 similarity functions, and make an explicit legacy-RPC compatibility decision before claiming matching details are gated.
- Fix 1 lb price-baseline logic so ineligible higher-minimum tiers are not labeled as `price_delta_1lb`.
- Move mode/count semantics before limiting, or rename/count teasers so the API does not under-return or mislabel results.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_with_followups
VALIDATION_STATUS:
- git diff --check origin/main...HEAD: VALIDATION_PASS
- pnpm vitest run src/lib/server/catalogSimilarity.test.ts src/lib/server/catalogAccess.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/routes/catalog/page.svelte.test.ts: VALIDATION_PASS
- pnpm check: VALIDATION_PASS
```

## What the PR does well

- Adds a coherent server-side similarity normalization layer in `src/lib/server/catalogSimilarity.ts` with canonical `price_per_lb`, `price_tiers`, beta confidence copy, match categories, dimension scores, and 1 lb delta fields.
- Adds `/v1/catalog/[id]/similar` with session/API principal resolution, member/API capability checks, API-key rate headers, and usage logging for successful and most handled API-key outcomes.
- Keeps the route non-destructive. It queries `coffee_catalog` and v2 similarity RPCs through the server admin client; it does not mutate catalog rows or identity state.
- Adds useful tests for anonymous `401`, viewer `403` teaser, member success, paid API success, validation, access capability resolution, and pricing fallback.
- Uses v2 RPC names instead of changing legacy function signatures, which lowers compatibility risk.

## Findings

### P1: New v2 similarity RPCs are directly executable by every authenticated Supabase user

**Files:** `supabase/migrations/20260504_canonical_similarity_contract.sql`, `src/routes/v1/catalog/[id]/similar/+server.ts`, `src/lib/server/catalogAccess.ts`

The route enforces `canUseBeanMatching` correctly at the SvelteKit boundary, but the migration grants the new premium RPCs to the broad Postgres `authenticated` role:

```sql
GRANT EXECUTE ON FUNCTION find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN) TO authenticated, service_role;
```

That bypasses the route-level entitlement contract. A signed-in viewer can call the RPC directly through the Supabase client and receive supplier, similarity, canonical pricing, tier, stock, and dimension-score details without being a member. Existing table policies also make `coffee_catalog` and `coffee_chunks` broadly readable, so the function body is not protected by stricter RLS.

This conflicts with ADR-005 and the PR intent: matching/comparison details are member or paid API leverage, while non-members may receive only locked count teasers.

**Correction:**

- Revoke the new v2 RPCs from `authenticated`; grant only to `service_role` for the server route path.
- Add a migration assertion or SQL smoke note such as `pg_has_function_privilege('authenticated', 'find_similar_beans_aggregated_v2(INT,FLOAT,INT,BOOLEAN)', 'EXECUTE') = false`.
- Add a route-level test is not enough; this is a database privilege issue.

### P2: Legacy public similarity RPCs still undermine the premium gating story

**Files:** `supabase/migrations/20260321_similarity_infrastructure.sql`, new migration

The old `find_similar_beans` and `find_similar_beans_aggregated` functions remain executable by `anon` and `authenticated`. They already expose match lists with supplier/source, origin, processing, `cost_lb`, stock, average similarity, and chunk match count. The new endpoint improves the contract, but leaving the old public RPCs available means a non-member can still access much of the matching detail that the route now positions as premium.

This is partly inherited technical debt, but it is directly relevant because the program plan identifies direct RPC grants to `anon` as a known gap before productizing the feature.

**Correction options:**

1. Best product/security fix: revoke legacy similarity RPC execution from `anon` and broad `authenticated` in this PR, then migrate CLI/tool callers in the follow-on PR to the `/v1/catalog/:id/similar` route.
2. If compatibility requires keeping legacy RPCs temporarily, document that exception in the PR and response metadata, and do not claim the product surface fully gates matching details yet. That should become a hard follow-up before UI launch.

### P2: 1 lb baseline pricing can use an ineligible higher-minimum tier

**File:** `src/lib/server/catalogSimilarity.ts`

`getPriceFromTiersAtQuantity` sorts tiers, filters those with `min_lbs <= quantityLbs`, then falls back to `tiers[0]` when none are eligible:

```ts
const eligible = tiers.filter((tier) => (tier.min_lbs ?? 0) <= quantityLbs);
const selected = eligible.at(-1) ?? tiers[0];
return selected.price;
```

For a coffee with `price_tiers: [{ min_lbs: 5, price: 6.25 }]` and no `price_per_lb`, the API will report `baseline_quantity_lbs: 1`, `baseline_source: 'price_tiers'`, and compute `price_delta_1lb` from the 5 lb price. That mislabels wholesale or bulk tiers as a 1 lb comparable price.

The plan says to launch with a 1 lb baseline and compare 5 lb / 50 lb only when tiers allow it. This implementation can silently create false price deltas, which is risky because price comparison is the main member value in this slice.

**Correction:**

- Return `null` when no tier is eligible for the requested quantity, or return the actual selected tier minimum separately and do not label the delta as 1 lb.
- Add tests for `{ min_lbs: 5, price: ... }` and wholesale-only tier arrays.

### P3: `mode` filtering happens after SQL `LIMIT`, so mode-specific results can under-return

**File:** `src/lib/server/catalogSimilarity.ts`

`fetchCatalogSimilarityMatches` calls `find_similar_beans_aggregated_v2` with `match_count: input.query.limit`, then filters the resulting rows by `mode` in JavaScript. If a caller requests `mode=likely_same&limit=10`, the database returns the top 10 by average similarity across all categories first; the service may then discard rows that are `similar_profile`, returning fewer than 10 even when more likely-same candidates exist below the initial SQL limit.

**Correction:**

- Either overfetch and slice after filtering, or move category/mode filtering into SQL/service before applying the caller-visible limit.
- Add a test with mixed category rows proving `mode=likely_same` returns the best likely-same rows up to the requested cap.

### P3: Viewer teaser field is named `likely_match_count`, but the SQL count is broader

**Files:** `src/routes/v1/catalog/[id]/similar/+server.ts`, `src/lib/server/catalogSimilarity.ts`, `supabase/migrations/20260504_canonical_similarity_contract.sql`

`count_similar_beans_aggregated_v2` counts coffees with any origin/processing/tasting chunk above the threshold. It does not derive `likely_same` vs `similar_profile`, and the viewer route ignores `mode`. The response field is called `likely_match_count`, which overstates the meaning of the count.

**Correction:**

- Rename the teaser to `similar_match_count`, or implement count logic using the same category semantics as the detailed response.

## Validation

- `git diff --check origin/main...HEAD`: passed.
- `pnpm vitest run src/lib/server/catalogSimilarity.test.ts src/lib/server/catalogAccess.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts src/routes/catalog/page.svelte.test.ts`: passed, 15 tests.
- `pnpm check`: passed, 0 Svelte diagnostics.

## Repo state note

The worktree had two pre-existing dirty files outside the PR diff before validation:

- `src/lib/components/layout/MobileOverlayShell.test.ts`
- `src/lib/components/layout/Settingsbar.test.ts`

They are not part of `origin/main...HEAD`, but they make the local checkout non-clean and should not be bundled into this PR accidentally.

## Mergeability

This PR is close and the product slice is directionally correct, but it should not merge until the direct RPC privilege bypass is fixed. After that, it can be merged as a beta vertical slice with explicit follow-up for legacy RPC compatibility/gating before a member UI markets matching as premium leverage.
