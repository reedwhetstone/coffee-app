-- Bounded canonical similarity candidate retrieval for the v1 similar API.
-- v2 aggregated every target chunk against all candidate chunks before ordering, which can
-- hit statement timeouts on interactive requests. v3 asks the vector index for a bounded
-- nearest-neighbor pool per target chunk, then aggregates only that pool.

CREATE OR REPLACE FUNCTION find_similar_beans_aggregated_v3(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  stocked_only BOOLEAN DEFAULT true,
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
LANGUAGE sql
STABLE
AS $$
  WITH settings AS (
    SELECT
      LEAST(GREATEST(COALESCE(match_count, 10), 1), 1000) AS resolved_match_count,
      LEAST(GREATEST(COALESCE(candidate_pool, COALESCE(match_count, 10) * 40), 200), 1000) AS resolved_candidate_pool
  ),
  target_embeddings AS (
    SELECT cc.chunk_type, cc.embedding
    FROM coffee_chunks cc
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
  ),
  bounded_matches AS (
    SELECT
      candidate.coffee_id,
      te.chunk_type,
      candidate.similarity
    FROM target_embeddings te
    CROSS JOIN settings s
    CROSS JOIN LATERAL (
      SELECT
        cc.coffee_id,
        1 - (cc.embedding <=> te.embedding) AS similarity
      FROM coffee_chunks cc
      JOIN coffee_catalog c ON c.id = cc.coffee_id
      WHERE cc.coffee_id <> target_coffee_id
        AND cc.chunk_type = te.chunk_type
        AND (NOT stocked_only OR c.stocked IS true)
      ORDER BY cc.embedding <=> te.embedding
      LIMIT s.resolved_candidate_pool
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
  CROSS JOIN settings s
  ORDER BY a.avg_similarity DESC
  LIMIT s.resolved_match_count;
$$;

REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, INT) TO service_role;
