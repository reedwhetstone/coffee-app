# PR 332 Verification: Similar comparison DB correction

**Date:** 2026-05-06  
**Repo:** `/root/.openclaw/workspace/worktrees/coffee-app-pr332-fix`  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/332  
**Base:** `origin/main`  
**Head:** `12304e2` (`fix: align similarity rpc price tiers type`)

## Operator summary

VERDICT: fail  
P0: 0  
P1: 1  
P2: 1  
P3: 1  
NEXT_ACTION: patch_same_pr  
TOP_FIXES:

- Add a new forward Supabase migration that drops/recreates the already-deployed v2 similarity functions with `price_tiers JSONB[]`; changing the existing `20260504` migration will not fix prod and `CREATE OR REPLACE` cannot change the return type of an existing function.
- Narrow legacy fallback in `src/lib/server/catalogSimilarity.ts`; fallback for missing/known preview schema drift is reasonable, but `permission denied` should surface instead of being masked by legacy RPCs.
- Regenerate or adjust DB type documentation for the v2 RPC result so `price_tiers` does not remain documented as scalar `Json` in generated function types.

## Scope reviewed

Read the required artifacts from `.verify-pr/20260506T021257Z-pr-332-comparison-fix`: `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff`. Inspected:

- `supabase/migrations/20260504_canonical_similarity_contract.sql`
- `src/lib/server/catalogSimilarity.ts`
- `src/routes/v1/catalog/[id]/similar/+server.ts`
- `src/routes/v1/catalog/[id]/similar/similar.test.ts`
- `src/lib/server/catalogSimilarity.test.ts`
- `src/lib/utils/pricing.ts` and tests
- `src/lib/components/catalog/SimilarCoffeePanel.svelte` and catalog page integration
- `src/lib/types/database.types.ts`

## Findings

### P1: The migration correction will not fix prod or any DB that already applied the original migration

**Evidence:** `origin/main` already contains `supabase/migrations/20260504_canonical_similarity_contract.sql` with both v2 RPCs returning `price_tiers JSONB`. This PR changes that existing file to `JSONB[]`.

There are two rollout problems:

1. Supabase migration runners track applied migration versions. If `20260504_canonical_similarity_contract.sql` already ran in prod/preview, editing that same file will not apply a new migration.
2. Even if the edited SQL is run manually against a DB that already has the wrong function, `CREATE OR REPLACE FUNCTION` cannot change an existing function's return type. PostgreSQL requires dropping and recreating the function when OUT/table return types change.

Given the stated live column fact, `coffee_catalog.price_tiers` is `data_type ARRAY`, `udt_name _jsonb`. The target return declaration should indeed be `price_tiers JSONB[]`, but this PR does not provide a deployable correction path for existing databases.

**Required fix:** Add a new migration with a later timestamp that drops and recreates at least:

- `find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN)`
- `find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN)`

The recreated functions should return `price_tiers JSONB[]`, retain the service-role grants, and revoke public/authenticated execution as intended. Consider reverting the historical migration edit to keep applied migration history immutable; fresh DBs can apply the old migration and then the corrective drop/recreate migration.

### P2: Legacy fallback is too broad and masks privilege or grant bugs

`isLikelyMissingCanonicalSimilarityRpc` currently treats these as fallback-eligible:

- exact/missing function style failures, which are reasonable for preview/schema drift
- `42804` and the exact `jsonb[]` vs `jsonb` mismatch, which is reasonable as a temporary compatibility bridge
- `permission denied for function find_similar_beans_aggregated_v2`
- `permission denied for function count_similar_beans_aggregated_v2`

The permission-denied cases are not missing schema. They indicate a broken grant, wrong role, or an admin-client/service-role configuration bug. Falling back to `find_similar_beans_aggregated` converts a hard deployment/security signal into a degraded 200 response with less precise dimensions. That is especially risky because the v2 functions are intentionally revoked from `PUBLIC`, `anon`, and `authenticated` and granted to `service_role` only.

**Recommended fix:** Keep fallback for `PGRST202`, `42883`, and the known pre-correction `42804` return-shape drift. Remove permission-denied fallback and let it surface as a server error so grants/admin-client issues are visible.

### P3: Generated DB function types still document `price_tiers` as scalar `Json`

`src/lib/types/database.types.ts` still declares both `find_similar_beans_v2` and `find_similar_beans_aggregated_v2` returns with `price_tiers: Json | null`. The server code uses local hand-rolled interfaces and `Json` can structurally contain arrays, so this is not a runtime blocker. It is still stale source-truth documentation for the DB contract after the migration is fixed.

**Recommended fix:** Regenerate Supabase types after applying the corrected migration, or add a note if generated types cannot represent `jsonb[]` precisely.

## Positive checks

- The SQL return declaration should be `JSONB[]` for the stated live column shape (`data_type ARRAY`, `udt_name _jsonb`).
- The app-side pricing normalization accepts arrays and preserves canonical pricing fields. `Json` is broad enough for the runtime array shape.
- The route performs entitlement checks before using the admin client for member/API access.
- Legacy fallback does not return legacy rows as `likely_same` without dimensional evidence; this avoids overclaiming confidence.
- `pnpm run check` passed with 0 errors and 0 warnings.
- `pnpm run lint` passed.
- Focused non-component tests passed with a temporary SvelteKit-only Vitest config: `pnpm exec vitest run --config .verify-pr/vitest.verify.config.ts src/lib/server/catalogSimilarity.test.ts 'src/routes/v1/catalog/[id]/similar/similar.test.ts' src/lib/utils/pricing.test.ts`, 87 tests passed. Temporary config was removed.

## Validation limits

The repo's default Vitest config failed in this detached worktree before collecting tests because the `@testing-library/svelte/vite` plugin tried to load `@testing-library/svelte/src/vitest.js` through the primary checkout's symlinked `node_modules`. A no-plugin config allowed server/helper tests to pass, but Svelte component tests require the testing-library plugin and could not be rerun conclusively in this worktree. `svelte-check` and lint passed, so this is reported as local test-harness/worktree resolution friction rather than a confirmed PR code failure.

## Verdict

This PR is not merge-ready because the DB correction is not deployable to existing prod/preview databases. Patch the same PR with a forward migration that drops/recreates the v2 RPCs, then re-run focused route/server tests and a migration sanity check.
