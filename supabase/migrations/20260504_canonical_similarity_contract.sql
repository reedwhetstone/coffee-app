-- Canonical similarity contract v2
-- Adds canonical pricing and dimension-score fields without changing the legacy RPC
-- signatures consumed by older CLI/app clients.

CREATE OR REPLACE FUNCTION find_similar_beans_v2(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 10,
  chunk_types TEXT[] DEFAULT ARRAY['origin', 'processing', 'tasting'],
  stocked_only BOOLEAN DEFAULT TRUE
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
  similarity FLOAT,
  chunk_type TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH target_embeddings AS (
    SELECT cc.embedding, cc.chunk_type
    FROM coffee_chunks cc
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type = ANY(chunk_types)
      AND cc.embedding IS NOT NULL
  ),
  similarities AS (
    SELECT DISTINCT ON (c.id, cc.chunk_type)
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
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
    ORDER BY c.id, cc.chunk_type, 1 - (cc.embedding <=> te.embedding) DESC
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
    s.similarity,
    s.chunk_type
  FROM similarities s
  ORDER BY s.similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION find_similar_beans_aggregated_v2(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 10,
  stocked_only BOOLEAN DEFAULT TRUE
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
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
      AND cc.embedding IS NOT NULL
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

CREATE OR REPLACE FUNCTION count_similar_beans_aggregated_v2(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  stocked_only BOOLEAN DEFAULT TRUE
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
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type IN ('origin', 'processing', 'tasting')
      AND cc.embedding IS NOT NULL
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
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
    GROUP BY cc.coffee_id
  )
  SELECT COUNT(*)::INT INTO match_total FROM matched_coffees;

  RETURN COALESCE(match_total, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- The v2 functions are a premium contract and must only be called through
-- trusted server routes that enforce member/API entitlements. Legacy v1 RPCs
-- remain available for compatibility until CLI/tool callers migrate.
GRANT EXECUTE ON FUNCTION find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN) TO service_role;
