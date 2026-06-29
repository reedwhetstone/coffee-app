# Migration runbook: similarity RPC HNSW performance hardening

**Date:** 2026-06-29
**Migration:** `supabase/migrations/20260629_similarity_hnsw_perf.sql`
**Apply via:** Supabase Dashboard > SQL Editor (manual, against prod)
**Affects:** `coffee_chunks` indexes + `find_similar_beans_aggregated_v3` RPC

## Why

The pre-existing `catalogSimilar` live integration test (parchment-api) intermittently
fails with a Postgres `statement timeout` on `find_similar_beans_aggregated_v3` under
prod load. `main` passes the same test minutes earlier and it clears on rerun, so this
is latency-under-load in the RPC, not a code regression.

### Root cause

The RPC runs a per-dimension KNN (`ORDER BY embedding <=> target LIMIT candidate_pool`)
for each of `origin` / `processing` / `tasting`, filtered by `chunk_type` and joined to
`coffee_catalog.stocked`. The only ANN index is a single `ivfflat (lists = 100)` on
`coffee_chunks.embedding`. When the filters drop the index's candidates, the scan
over-fetches / falls back, and under concurrent prod load it tips past
`statement_timeout`.

## What this migration does

Two independent items (this is the "1 + 3" pair; the third option, adding
`skip-on-timeout` resilience to the live test itself, is non-SQL and is tracked
separately for the parchment-api test):

1. **HNSW index.** Add an HNSW index on `coffee_chunks.embedding`
   (`m = 16, ef_construction = 64`), built `CONCURRENTLY`. HNSW is the canonical index
   for filtered ANN: better recall/latency than ivfflat, and with iterative scans
   (item 3, pgvector >= 0.8) it keeps pulling from the graph when filters drop
   candidates instead of bailing to a seq scan. **Additive** -- it sits next to the
   existing ivfflat index; ivfflat is dropped later, only once EXPLAIN confirms the
   planner uses HNSW.

3. **Function rewrite.** Convert `find_similar_beans_aggregated_v3` from `LANGUAGE sql`
   to `plpgsql` so it can bound its own work with `SET LOCAL`. Same signature, same
   result shape, same query body -- the only change is the four guards:
   - `statement_timeout = '4s'` -- hard ceiling; cancel rather than hang
   - `hnsw.ef_search = resolved_candidate_pool` -- aligned with the per-dimension
     candidate-pool size (set via `set_config`) so the LATERAL `LIMIT` is not
     silently truncated; capped at pgvector's max of 1000
   - `hnsw.iterative_scan = 'relaxed_order'` -- keep pulling past dropped filters
   - `hnsw.max_scan_tuples = 20000` -- cap total tuples an iterative scan visits

   All `SET LOCAL`, scoped to the call's transaction. Fail fast and degrade instead of
   hanging.

No data is modified. No row reads/writes. Function grants preserved (`service_role` only).

## How to apply

**Run PART 1 and PART 2 as two separate executions.**

1. **PART 1 first, by itself.** `CREATE INDEX CONCURRENTLY` cannot run inside a
   transaction block, so it must be the only statement you run. The catalog is a few
   thousand chunks, so the concurrent build is cheap and does not block writes.
2. **PART 2 after PART 1 completes.** Drops + recreates the function and re-applies grants.

### pgvector version gate

```sql
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

- `>= 0.5.0` required for the HNSW index (PART 1).
- `>= 0.8.0` required for `hnsw.iterative_scan` / `hnsw.max_scan_tuples` (PART 2).
- If prod is `< 0.8.0`: drop the two iterative-scan `SET LOCAL` lines in PART 2 (keep
  `ef_search` + `statement_timeout`) and rely on plain HNSW. Supabase ships a current
  build, so this should be satisfied -- just confirm before running.

## Verify

Pick a `coffee_id` that has `origin`/`processing`/`tasting` chunks (e.g. 1182):

```sql
EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM find_similar_beans_aggregated_v3(1182, 0.7, 10, true, false, 400);
```

- Expect `Index Scan using idx_coffee_chunks_embedding_hnsw` on the inner per-dimension
  scans (not a seq scan, not the old ivfflat index). **If the planner still picks
  ivfflat, that's the signal to drop the ivfflat index** in a follow-up:
  `DROP INDEX IF EXISTS idx_coffee_chunks_embedding;`
- Total execution time should be well under the previous timeout (and now hard-capped
  at 4s).

Confirm the index exists and spot-check that results are unchanged versus the prior RPC
(same top matches and similarity ordering) for a couple of known coffees:

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'coffee_chunks';
```

## Rollback

- **Function:** re-run the `CREATE FUNCTION find_similar_beans_aggregated_v3` block from
  `supabase/migrations/20260507_similarity_public_visibility_after_bounded_candidates.sql`
  (the prior `LANGUAGE sql` definition).
- **Index:** `DROP INDEX IF EXISTS idx_coffee_chunks_embedding_hnsw;` (the ivfflat index
  was never removed, so nothing else to restore).
