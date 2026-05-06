# PR 332 Re-verification: similarity price_tiers array correction

**Date:** 2026-05-06  
**Repo:** `/root/.openclaw/workspace/worktrees/coffee-app-pr332-fix`  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/332  
**Base:** `origin/main`  
**Head reviewed:** `a5c88fb` (`fix: surface canonical similarity permission errors`)

## Operator summary

VERDICT: ready  
P0: 0  
P1: 0  
P2: 0  
P3: 0  
NEXT_ACTION: merge  
TOP_FIXES:
- None required.

## Scope reviewed

Read the supplied artifacts under `.verify-pr/20260506T022357Z-pr-332-comparison-fix`: `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff`. The supplied artifact was generated at `20f090e`; the worktree then advanced to `a5c88fb`, so this re-verification also inspected the current `HEAD` diff and the latest permission-fallback commit.

Files inspected:

- `supabase/migrations/20260506_recreate_similarity_price_tiers_array.sql`
- `supabase/migrations/20260504_canonical_similarity_contract.sql`
- `src/lib/server/catalogSimilarity.ts`
- `src/lib/types/database.types.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts`
- Focused pricing/server route tests touched by the prior findings

## Findings

### Prior P1 fixed: forward migration is deployable to DBs with the wrong v2 return type

The new `20260506_recreate_similarity_price_tiers_array.sql` migration drops `find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN)` and `find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN)` before recreating them with `price_tiers JSONB[]`. This is the right rollout pattern for existing prod/preview DBs because PostgreSQL cannot change a TABLE-returning function's return type via `CREATE OR REPLACE FUNCTION`.

The migration keeps the original v2 signatures, restores the service-role grants, and leaves `count_similar_beans_aggregated_v2` alone because it does not return `price_tiers`. Fresh DBs can apply the old `20260504` migration and then this forward correction; existing DBs get the later correction as a normal new migration.

### Prior P2 fixed: permission-denied errors no longer fall back to legacy RPCs

Current `isLikelyMissingCanonicalSimilarityRpc` falls back only for `42804`, `42883`, `PGRST202`, the known return-shape drift message, and missing-function text. It no longer treats broad v2 function-name substrings or `permission denied for function ..._v2` as fallback-eligible.

The route tests now cover both canonical similarity and canonical count permission-denied paths and assert that legacy RPCs are not called. Focused validation passes on current `HEAD`.

### Prior P3 fixed: generated RPC types now reflect `jsonb[]`

`src/lib/types/database.types.ts` now declares both v2 RPC return shapes as `price_tiers: Json[] | null`. That is an acceptable generated TypeScript representation for PostgreSQL `jsonb[]`. Runtime pricing normalization also accepts the array shape.

## Validation

- `VALIDATION_PASS`: `pnpm run check`
- `VALIDATION_PASS`: `pnpm run lint`
- `VALIDATION_PASS`: `pnpm exec vitest run --config .verify-pr/vitest.reverify.config.ts src/lib/server/catalogSimilarity.test.ts 'src/routes/v1/catalog/[id]/similar/similar.test.ts' src/lib/utils/pricing.test.ts` passed 90 tests after removing the temporary config.

Default Vitest collection remains affected by the known detached-worktree `@testing-library/svelte/vite` resolution issue, so focused server/helper tests were run with a SvelteKit-only temporary Vitest config and the temp file was removed.

## Verdict

PR 332 is merge-ready from this re-verification. The forward migration, fallback narrowing, and RPC type updates address the previous P1/P2/P3 findings, and no new blocker was found.
