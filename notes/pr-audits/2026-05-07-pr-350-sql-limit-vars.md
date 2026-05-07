# PR #350 Verify: SQL LIMIT scalar subquery fix

**Verdict:** ready

## Contract

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:
- None

## Rationale

PR #350 changes only `supabase/migrations/20260507_bounded_similarity_candidates.sql`, replacing the two illegal CTE column references in `LIMIT` clauses with scalar subqueries against the one-row `settings` CTE.

- `LIMIT (SELECT resolved_candidate_pool FROM settings)` at line 65 preserves the bounded candidate pool per target embedding while avoiding PostgreSQL's restriction on direct variable/column references inside `LIMIT`.
- `LIMIT (SELECT resolved_match_count FROM settings)` at line 113 preserves the returned match-count cap with the same sanitized bounds from `settings` lines 37-41.
- The stale `CROSS JOIN settings s` aliases at lines 54 and 111 are now redundant but harmless; they still keep the one-row settings relation in scope and do not alter cardinality.

## Validation

A local PostgreSQL 16.11 scratch transaction with minimal compatible `coffee_chunks`, `coffee_catalog`, Supabase roles, and a dummy `<=>` operator successfully applied the full migration through `CREATE FUNCTION`, `REVOKE`, and `GRANT`, then rolled back. A separate execution smoke test called `find_similar_beans_aggregated_v3(1, 0.0, 1, true, 200)` and returned one bounded result, confirming the scalar `LIMIT` subqueries execute as well as compile.

## Migration-order assessment

Editing the existing failed migration is the right repair. A new later migration would not help fresh or previously blocked environments because migration application would still stop at the broken `20260507_bounded_similarity_candidates.sql` before reaching any follow-up file. Since the previous version failed during function definition, it should not have been recorded as successfully applied in Supabase migration history.

## Product/architecture alignment

The fix preserves PR #347's bounded semantic similarity behavior and aligns with `notes/PRODUCT_VISION.md` by keeping the catalog similarity data layer operational for API and agentic consumers. It does not change entitlement, API shape, or product positioning from ADR-002/ADR-005.
