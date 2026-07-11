-- Re-apply public catalog visibility gates after the bounded v3 similarity RPC.
-- PR #334 added public_only to the v2 contract, then later migrations recreated
-- v2/v3 without that parameter while fixing price_tiers and latency. This forward
-- migration preserves the bounded v3 path and the JSONB[] price_tiers contract
-- while allowing trusted server code to restrict API-key callers to public rows.

DROP FUNCTION IF EXISTS find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, INT);
DROP FUNCTION IF EXISTS find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN);
DROP FUNCTION IF EXISTS count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN, BOOLEAN);

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
        AND (public_only IS false OR c.public_coffee IS true)
      ORDER BY cc.embedding <=> te.embedding
      LIMIT (SELECT resolved_candidate_pool FROM settings)
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
  LIMIT (SELECT resolved_match_count FROM settings);
$$;

CREATE FUNCTION find_similar_beans_aggregated_v2(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 10,
  stocked_only BOOLEAN DEFAULT TRUE,
  public_only BOOLEAN DEFAULT FALSE
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
  chunk_matches INT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH target_embeddings AS (
    SELECT cc.embedding, cc.chunk_type
    FROM coffee_chunks cc
    JOIN coffee_catalog target ON target.id = cc.coffee_id
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
      AND cc.embedding IS NOT NULL
      AND (public_only IS FALSE OR target.public_coffee IS TRUE)
  ),
  similarities AS (
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
      1 - (cc.embedding <=> te.embedding) AS similarity,
      cc.chunk_type
    FROM coffee_chunks cc
    JOIN coffee_catalog c ON c.id = cc.coffee_id
    CROSS JOIN target_embeddings te
    WHERE cc.coffee_id != target_coffee_id
      AND cc.chunk_type = te.chunk_type
      AND cc.embedding IS NOT NULL
      AND (stocked_only IS FALSE OR c.stocked IS TRUE)
      AND (public_only IS FALSE OR c.public_coffee IS TRUE)
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
  )
  SELECT
    s.coffee_id,
    s.coffee_name,
    s.source,
    s.origin,
    s.country,
    s.continent,
    s.processing,
    s.processing_base_method,
    s.fermentation_type,
    s.drying_method,
    s.cost_lb,
    s.price_per_lb,
    s.price_tiers,
    s.stocked,
    AVG(s.similarity)::FLOAT AS avg_similarity,
    MAX(s.similarity) FILTER (WHERE s.chunk_type = 'origin')::FLOAT AS origin_similarity,
    MAX(s.similarity) FILTER (WHERE s.chunk_type = 'processing')::FLOAT AS processing_similarity,
    MAX(s.similarity) FILTER (WHERE s.chunk_type = 'tasting')::FLOAT AS tasting_similarity,
    COUNT(DISTINCT s.chunk_type)::INT AS chunk_matches
  FROM similarities s
  GROUP BY s.coffee_id, s.coffee_name, s.source, s.origin, s.country,
           s.continent, s.processing, s.processing_base_method, s.fermentation_type,
           s.drying_method, s.cost_lb, s.price_per_lb, s.price_tiers, s.stocked
  ORDER BY AVG(s.similarity) DESC
  LIMIT match_count;
END;
$$;

CREATE FUNCTION count_similar_beans_aggregated_v2(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  stocked_only BOOLEAN DEFAULT TRUE,
  public_only BOOLEAN DEFAULT FALSE
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  match_total INT;
BEGIN
  WITH target_embeddings AS (
    SELECT cc.embedding, cc.chunk_type
    FROM coffee_chunks cc
    JOIN coffee_catalog target ON target.id = cc.coffee_id
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
      AND cc.embedding IS NOT NULL
      AND (public_only IS FALSE OR target.public_coffee IS TRUE)
  ),
  matched_coffees AS (
    SELECT cc.coffee_id
    FROM coffee_chunks cc
    JOIN coffee_catalog c ON c.id = cc.coffee_id
    CROSS JOIN target_embeddings te
    WHERE cc.coffee_id != target_coffee_id
      AND cc.chunk_type = te.chunk_type
      AND cc.embedding IS NOT NULL
      AND (stocked_only IS FALSE OR c.stocked IS TRUE)
      AND (public_only IS FALSE OR c.public_coffee IS TRUE)
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
    GROUP BY cc.coffee_id
  )
  SELECT COUNT(*)::INT INTO match_total FROM matched_coffees;

  RETURN COALESCE(match_total, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v3(INT, FLOAT, INT, BOOLEAN, BOOLEAN, INT) TO service_role;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN, BOOLEAN) TO service_role;
