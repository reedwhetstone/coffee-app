-- ============================================================
-- PURVEYORS ANALYTICS: pgvector Similarity Infrastructure
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Date: 2026-03-21
-- ============================================================

-- 1. Verify pgvector is enabled (should already be)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. INDEXES for similarity performance
-- ============================================================

-- Vector similarity index (ivfflat for our scale ~5K-10K chunks)
-- Switch to HNSW if >100K chunks
CREATE INDEX IF NOT EXISTS idx_coffee_chunks_embedding
ON coffee_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- Filter index on chunk_type
CREATE INDEX IF NOT EXISTS idx_coffee_chunks_type
ON coffee_chunks (chunk_type);

-- Join index on coffee_id
CREATE INDEX IF NOT EXISTS idx_coffee_chunks_coffee_id
ON coffee_chunks (coffee_id);

-- ============================================================
-- 3. SIMILARITY SEARCH: Per-chunk-type matches
-- Given a coffee_catalog ID, find similar beans using
-- cosine similarity on specified chunk types.
-- Returns one row per (coffee, chunk_type) pair.
-- ============================================================

CREATE OR REPLACE FUNCTION find_similar_beans(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 10,
  chunk_types TEXT[] DEFAULT ARRAY['origin', 'processing']
)
RETURNS TABLE (
  coffee_id INT,
  coffee_name TEXT,
  source TEXT,
  origin TEXT,
  processing TEXT,
  cost_lb NUMERIC,
  stocked BOOLEAN,
  similarity FLOAT,
  chunk_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH target_embeddings AS (
    -- Get embeddings for the target coffee
    SELECT cc.embedding, cc.chunk_type
    FROM coffee_chunks cc
    WHERE cc.coffee_id = target_coffee_id
      AND cc.chunk_type = ANY(chunk_types)
      AND cc.embedding IS NOT NULL
  ),
  similarities AS (
    -- Find similar chunks from OTHER coffees
    SELECT DISTINCT ON (c.id, cc.chunk_type)
      c.id AS coffee_id,
      c.name AS coffee_name,
      c.source,
      c.region AS origin,
      c.processing,
      c.cost_lb,
      c.stocked,
      1 - (cc.embedding <=> te.embedding) AS similarity,
      cc.chunk_type
    FROM coffee_chunks cc
    JOIN coffee_catalog c ON c.id = cc.coffee_id
    CROSS JOIN target_embeddings te
    WHERE cc.coffee_id != target_coffee_id
      AND cc.chunk_type = te.chunk_type
      AND cc.embedding IS NOT NULL
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
    ORDER BY c.id, cc.chunk_type, 1 - (cc.embedding <=> te.embedding) DESC
  )
  SELECT
    s.coffee_id,
    s.coffee_name,
    s.source,
    s.origin,
    s.processing,
    s.cost_lb,
    s.stocked,
    s.similarity,
    s.chunk_type
  FROM similarities s
  ORDER BY s.similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 4. AGGREGATED SIMILARITY
-- Averages similarity across origin + processing + tasting
-- chunks. Returns one row per similar bean with avg score.
-- This is the primary function for CLI and UI.
-- ============================================================

CREATE OR REPLACE FUNCTION find_similar_beans_aggregated(
  target_coffee_id INT,
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  coffee_id INT,
  coffee_name TEXT,
  source TEXT,
  origin TEXT,
  processing TEXT,
  cost_lb NUMERIC,
  stocked BOOLEAN,
  avg_similarity FLOAT,
  chunk_matches INT
)
LANGUAGE plpgsql
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
      c.processing,
      c.cost_lb,
      c.stocked,
      1 - (cc.embedding <=> te.embedding) AS similarity,
      cc.chunk_type
    FROM coffee_chunks cc
    JOIN coffee_catalog c ON c.id = cc.coffee_id
    CROSS JOIN target_embeddings te
    WHERE cc.coffee_id != target_coffee_id
      AND cc.chunk_type = te.chunk_type
      AND cc.embedding IS NOT NULL
      AND 1 - (cc.embedding <=> te.embedding) > match_threshold
  )
  SELECT
    s.coffee_id,
    s.coffee_name,
    s.source,
    s.origin,
    s.processing,
    s.cost_lb,
    s.stocked,
    AVG(s.similarity)::FLOAT AS avg_similarity,
    COUNT(DISTINCT s.chunk_type)::INT AS chunk_matches
  FROM similarities s
  GROUP BY s.coffee_id, s.coffee_name, s.source, s.origin,
           s.processing, s.cost_lb, s.stocked
  ORDER BY AVG(s.similarity) DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 5. RLS POLICIES for coffee_chunks
-- Public read (supports public analytics page)
-- Service role write (scraper inserts)
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE coffee_chunks ENABLE ROW LEVEL SECURITY;

-- Public read access for similarity queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coffee_chunks'
      AND policyname = 'Public read access for coffee_chunks'
  ) THEN
    CREATE POLICY "Public read access for coffee_chunks"
    ON coffee_chunks FOR SELECT
    USING (true);
  END IF;
END
$$;

-- Service role full access (scraper uses service key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coffee_chunks'
      AND policyname = 'Service role full access for coffee_chunks'
  ) THEN
    CREATE POLICY "Service role full access for coffee_chunks"
    ON coffee_chunks FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- ============================================================
-- 6. TEST QUERIES (run after embedding backfill)
-- Uncomment and run manually to verify.
-- Replace 1182 with any coffee_catalog ID that has embeddings.
-- ============================================================

-- Per-chunk similarity:
-- SELECT * FROM find_similar_beans(1182, 0.70, 10);

-- Aggregated similarity (primary query for CLI/UI):
-- SELECT * FROM find_similar_beans_aggregated(1182, 0.70, 10);

-- Check embedding coverage:
-- SELECT
--   COUNT(DISTINCT coffee_id) as beans_with_embeddings,
--   COUNT(*) as total_chunks,
--   COUNT(*) FILTER (WHERE chunk_type = 'origin') as origin_chunks,
--   COUNT(*) FILTER (WHERE chunk_type = 'processing') as processing_chunks,
--   COUNT(*) FILTER (WHERE chunk_type = 'tasting') as tasting_chunks,
--   COUNT(*) FILTER (WHERE chunk_type = 'profile') as profile_chunks,
--   COUNT(*) FILTER (WHERE chunk_type = 'commercial') as commercial_chunks
-- FROM coffee_chunks;

-- Verify indexes exist:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'coffee_chunks';
