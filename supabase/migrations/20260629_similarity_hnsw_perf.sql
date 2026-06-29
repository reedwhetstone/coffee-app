-- ============================================================
-- PURVEYORS ANALYTICS: similarity RPC performance hardening
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Date: 2026-06-29
--
-- Motivation:
--   The pre-existing catalogSimilar live test (parchment-api) intermittently
--   hits a Postgres `statement timeout` on find_similar_beans_aggregated_v3
--   under prod load. Root cause: the per-dimension KNN inside the RPC filters
--   on `chunk_type` and joins `coffee_catalog.stocked`, but the only ANN index
--   is a single ivfflat(lists=100) on coffee_chunks.embedding. When the filters
--   drop the index's candidates, the scan over-fetches / falls back, and under
--   concurrent load it tips past statement_timeout.
--
-- Two independent items (the third option, skip-on-timeout resilience in the
-- live test itself, is non-SQL and is tracked separately for parchment-api):
--   PART 1 (index)    -- add an HNSW index CONCURRENTLY, additive
--   PART 2 (function) -- plpgsql rewrite that bounds work via SET LOCAL
--
-- !!! RUN PART 1 AND PART 2 AS SEPARATE EXECUTIONS !!!
-- PART 1 uses CREATE INDEX CONCURRENTLY, which cannot run inside a transaction
-- block. Run the single PART 1 statement on its own first, then run PART 2.
--
-- pgvector requirement:
--   - HNSW index        : pgvector >= 0.5.0
--   - iterative_scan /  : pgvector >= 0.8.0   (PART 2 SET LOCALs)
--     max_scan_tuples
--   Verify: SELECT extversion FROM pg_extension WHERE extname = 'vector';
--   If prod is < 0.8.0, drop the two iterative-scan SET LOCAL lines in PART 2
--   (keep ef_search + statement_timeout) and rely on plain HNSW.
-- ============================================================


-- ============================================================
-- PART 1: HNSW INDEX  (item "1")  -- run this statement BY ITSELF
-- ------------------------------------------------------------
-- HNSW is the canonical index for filtered ANN: better recall/latency than
-- ivfflat and, with iterative scans (PART 2, pgvector >= 0.8), it keeps pulling
-- from the graph when filters drop candidates instead of bailing to a seq scan.
--
-- Additive: this sits NEXT TO the existing ivfflat index. Once EXPLAIN confirms
-- the planner uses HNSW, the ivfflat index can be dropped in a follow-up:
--   DROP INDEX IF EXISTS idx_coffee_chunks_embedding;
--
-- The catalog is only a few thousand chunks, so a CONCURRENT build is cheap and
-- does not block writes. CONCURRENTLY must run outside a transaction block.
-- ============================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coffee_chunks_embedding_hnsw
ON coffee_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);


-- ============================================================
-- PART 2: FUNCTION REWRITE  (item "3")  -- run after PART 1 completes
-- ------------------------------------------------------------
-- Same signature, same result shape, same query body as the current v3. The
-- only change is LANGUAGE sql -> plpgsql so the function can bound its own work
-- with SET LOCAL: fail fast and degrade instead of hanging under load. PostgreSQL
-- forbids SET / SET LOCAL inside a non-volatile (STABLE/IMMUTABLE) function, so the
-- function is declared VOLATILE. That is correct here regardless: hnsw.ef_search is
-- set per-call from a runtime-computed value (v_candidate_pool), which a function-
-- level SET clause (literals only) cannot express, and as a top-level service_role
-- RPC the function gains nothing from STABLE planner caching.
--   - statement_timeout '4s' : hard ceiling; cancel rather than hang
--   - hnsw.ef_search         : recall/latency knob for the graph search
--   - hnsw.iterative_scan    : keep pulling from the graph past dropped filters
--   - hnsw.max_scan_tuples   : cap total tuples an iterative scan will visit
-- All are SET LOCAL, so they are scoped to this call's transaction only.
-- ============================================================

DROP FUNCTION IF EXISTS find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, BOOLEAN, INT);

CREATE FUNCTION find_similar_beans_aggregated_v3(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  stocked_only BOOLEAN DEFAULT true,
  public_only BOOLEAN DEFAULT false,
  candidate_pool INT DEFAULT 400
)
RETURNS TABLE (
  coffee_id INT,
  coffee_name TEXT,
  source TEXT,
  origin TEXT,
  country TEXT,
  continent TEXT,
  processing TEXT,
  processing_base_method TEXT,
  fermentation_type TEXT,
  drying_method TEXT,
  cost_lb NUMERIC,
  price_per_lb NUMERIC,
  price_tiers JSONB[],
  stocked BOOLEAN,
  avg_similarity FLOAT,
  origin_similarity FLOAT,
  processing_similarity FLOAT,
  tasting_similarity FLOAT,
  chunk_matches BIGINT
)
LANGUAGE plpgsql
-- VOLATILE (not STABLE): the body issues SET LOCAL, which PostgreSQL rejects in a
-- non-volatile function ("SET is not allowed in a non-volatile function").
VOLATILE
AS $$
DECLARE
  -- Single source of truth for the result + candidate-pool sizes (replaces the
  -- old `settings` CTE). Held as plpgsql variables so they can drive both the
  -- LIMIT clauses (substituted as bound parameters, never outer-query Vars,
  -- which PostgreSQL rejects in LIMIT) and the ef_search alignment below.
  v_match_count    INT := LEAST(GREATEST(COALESCE(match_count, 10), 1), 1000);
  v_candidate_pool INT := LEAST(GREATEST(COALESCE(candidate_pool, COALESCE(match_count, 10) * 40), 200), 1000);
BEGIN
  -- Bound the work: fail fast and degrade instead of hanging under load.
  SET LOCAL statement_timeout = '4s';
  -- Keep HNSW's candidate list aligned with the per-dimension candidate pool so
  -- the LATERAL LIMIT below is not silently truncated by a smaller ef_search.
  -- pgvector caps hnsw.ef_search at 1000, which matches resolved_candidate_pool's
  -- own cap, so this stays in range for every input.
  PERFORM set_config('hnsw.ef_search', v_candidate_pool::text, true);
  -- pgvector >= 0.8 only. If prod is older, remove these two lines.
  SET LOCAL hnsw.iterative_scan = 'relaxed_order';
  SET LOCAL hnsw.max_scan_tuples = 20000;

  RETURN QUERY
  WITH target_embeddings AS (
    SELECT cc.chunk_type, cc.embedding
    FROM coffee_chunks cc
    JOIN coffee_catalog target ON target.id = cc.coffee_id
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
      AND (public_only IS false OR target.public_coffee IS true)
  ),
  bounded_matches AS (
    SELECT
      candidate.coffee_id,
      te.chunk_type,
      candidate.similarity
    FROM target_embeddings te
    CROSS JOIN LATERAL (
      SELECT
        cc.coffee_id,
        1 - (cc.embedding <=> te.embedding) AS similarity
      FROM coffee_chunks cc
      JOIN coffee_catalog c ON c.id = cc.coffee_id
      WHERE cc.coffee_id <> target_coffee_id
        AND cc.chunk_type = te.chunk_type
        AND (NOT stocked_only OR c.stocked IS true)
        AND (public_only IS false OR c.public_coffee IS true)
      ORDER BY cc.embedding <=> te.embedding
      LIMIT v_candidate_pool
    ) candidate
    WHERE candidate.similarity >= match_threshold
  ),
  best_per_dimension AS (
    SELECT DISTINCT ON (bm.coffee_id, bm.chunk_type)
      bm.coffee_id,
      bm.chunk_type,
      bm.similarity
    FROM bounded_matches bm
    ORDER BY bm.coffee_id, bm.chunk_type, bm.similarity DESC
  ),
  aggregated AS (
    SELECT
      bpd.coffee_id,
      AVG(bpd.similarity)::FLOAT AS avg_similarity,
      MAX(bpd.similarity) FILTER (WHERE bpd.chunk_type = 'origin')::FLOAT AS origin_similarity,
      MAX(bpd.similarity) FILTER (WHERE bpd.chunk_type = 'processing')::FLOAT AS processing_similarity,
      MAX(bpd.similarity) FILTER (WHERE bpd.chunk_type = 'tasting')::FLOAT AS tasting_similarity,
      COUNT(DISTINCT bpd.chunk_type)::BIGINT AS chunk_matches
    FROM best_per_dimension bpd
    GROUP BY bpd.coffee_id
    HAVING AVG(bpd.similarity) >= match_threshold
  )
  SELECT
    c.id AS coffee_id,
    c.name AS coffee_name,
    c.source,
    c.region AS origin,
    c.country,
    c.continent,
    c.processing,
    c.processing_base_method,
    c.fermentation_type,
    c.drying_method,
    c.cost_lb,
    c.price_per_lb,
    c.price_tiers,
    c.stocked,
    a.avg_similarity,
    a.origin_similarity,
    a.processing_similarity,
    a.tasting_similarity,
    a.chunk_matches
  FROM aggregated a
  JOIN coffee_catalog c ON c.id = a.coffee_id
  ORDER BY a.avg_similarity DESC
  LIMIT v_match_count;
END;
$$;

-- Re-apply the access contract (CREATE resets grants).
REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, BOOLEAN, INT) TO service_role;


-- ============================================================
-- VERIFICATION (run manually after applying; replace 1182 with a coffee_id
-- that has origin/processing/tasting chunks)
-- ============================================================
-- EXPLAIN (ANALYZE, BUFFERS)
--   SELECT * FROM find_similar_beans_aggregated_v3(1182, 0.7, 10, true, false, 400);
--
-- Expect: Index Scan using idx_coffee_chunks_embedding_hnsw on the inner
-- per-dimension scans (NOT a seq scan, NOT the old ivfflat index). If the
-- planner still chooses ivfflat, that is the signal to drop the ivfflat index.
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'coffee_chunks';
