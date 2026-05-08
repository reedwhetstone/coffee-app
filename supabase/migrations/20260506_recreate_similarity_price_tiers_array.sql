-- Recreate canonical similarity RPCs with the live coffee_catalog.price_tiers type.
--
-- The original 20260504 migration declared price_tiers as JSONB, but prod has
-- coffee_catalog.price_tiers as JSONB[] (information_schema: data_type ARRAY,
-- udt_name _jsonb). PostgreSQL cannot change a TABLE-returning function's
-- return type with CREATE OR REPLACE, so this forward migration drops and
-- recreates the v2 functions before restoring the intended grants.

DROP FUNCTION IF EXISTS find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN);
DROP FUNCTION IF EXISTS find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN);

CREATE FUNCTION find_similar_beans_v2(
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

CREATE FUNCTION find_similar_beans_aggregated_v2(
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

REVOKE EXECUTE ON FUNCTION find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION find_similar_beans_v2(INT, FLOAT, INT, TEXT[], BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN) TO service_role;
