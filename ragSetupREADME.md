# Coffee RAG System - Complete Implementation Guide

This document describes our enhanced RAG (Retrieval-Augmented Generation) system that uses chunked embeddings for semantic coffee search and recommendations.

## 🎯 Overview

Our RAG system combines traditional single-embedding search with advanced chunked embeddings to provide:

- **Semantic Understanding**: Finds coffees based on meaning, not just keywords
- **Targeted Search**: Separate chunks for tasting notes, origin info, processing, etc.
- **Historical Context**: LLM can reference past trends and seasonal patterns
- **Better Recommendations**: More nuanced suggestions based on broader coffee knowledge
- **Scalable Performance**: Works efficiently with large datasets
- **Contextual Awareness**: Can explain why certain coffees work well together

## 🏗️ Architecture

### Database Schema

Our system uses two approaches:

1. **Legacy Single Embeddings**: `coffee_catalog.embedding` column
2. **Enhanced Chunked Embeddings**: `coffee_chunks` table

```sql
-- Main chunked embeddings table
CREATE TABLE coffee_chunks (
    id TEXT PRIMARY KEY,
    coffee_id INTEGER REFERENCES coffee_catalog(id) ON DELETE CASCADE,
    chunk_type TEXT NOT NULL, -- 'profile' | 'tasting' | 'origin' | 'commercial' | 'processing'
    content TEXT NOT NULL,
    metadata JSONB NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_coffee_chunks_coffee_id ON coffee_chunks(coffee_id);
CREATE INDEX idx_coffee_chunks_type ON coffee_chunks(chunk_type);
CREATE INDEX idx_coffee_chunks_embedding ON coffee_chunks USING ivfflat (embedding vector_cosine_ops);

-- Vector search function
CREATE OR REPLACE FUNCTION match_coffee_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  chunk_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  coffee_id integer,
  chunk_type text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    c.id,
    c.coffee_id,
    c.chunk_type,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM coffee_chunks c
  JOIN coffee_catalog cc ON c.coffee_id = cc.id
  WHERE 
    1 - (c.embedding <=> query_embedding) > match_threshold
    AND (chunk_types IS NULL OR c.chunk_type = ANY(chunk_types))
    AND cc.stocked = true
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Chunking Strategy

Each coffee is broken into semantic chunks:

1. **Profile Chunk**: Core identification, quality scores, grades
2. **Tasting Chunk**: Cupping notes, flavor descriptions, roast recommendations  
3. **Origin Chunk**: Region, variety, farm information, sourcing details
4. **Processing Chunk**: Processing methods, drying techniques, packaging
5. **Commercial Chunk**: Pricing, lot sizes, availability, arrival dates

## 🔧 Services

### EnhancedEmbeddingService

Handles chunked embedding generation with:
- Semantic chunking by content type
- Rate limiting (100ms between API calls)
- Error handling for individual chunks
- Rich metadata for each chunk

```typescript
// Example usage
const service = new EnhancedEmbeddingService(OPENAI_API_KEY);
const chunks = service.createSemanticChunks(coffeeData);
const chunksWithEmbeddings = await service.generateChunkEmbeddings(chunks);
```

### RAGService

Unified search service supporting both approaches:

```typescript
// Chunked search (default)
const result = await ragService.retrieveRelevantCoffees("fruity Ethiopian beans", {
  useChunkedSearch: true,
  chunkTypes: ['tasting', 'origin'], // Optional filtering
  maxCurrentInventory: 10,
  similarityThreshold: 0.7
});

// Legacy search (fallback)
const result = await ragService.retrieveRelevantCoffees("fruity Ethiopian beans", {
  useChunkedSearch: false
});
```

## 🚀 API Endpoints

### Generate Embeddings

**Chunked Embeddings (Recommended)**
```bash
# Generate chunked embeddings for all coffees
curl -X POST "http://localhost:5173/api/embeddings/populate?chunked=true"

# Force regenerate all chunks  
curl -X POST "http://localhost:5173/api/embeddings/populate?chunked=true&force=true"
```

**Legacy Embeddings**
```bash
# Generate single embeddings per coffee
curl -X POST "http://localhost:5173/api/embeddings/populate"

# Force regenerate existing embeddings
curl -X POST "http://localhost:5173/api/embeddings/populate?force=true"
```

### Search Capabilities

Our chunked approach enables targeted queries:

- **Tasting-focused**: "fruity and bright coffees" → matches tasting chunks
- **Origin-focused**: "Ethiopian highlands beans" → matches origin chunks  
- **Processing-focused**: "natural process coffees" → matches processing chunks
- **Commercial-focused**: "under $6 per pound" → matches commercial chunks

## 🎯 Search Quality Benefits

### Before (Single Embeddings)
- One embedding per coffee containing all information
- Limited precision for specific aspects
- Mixed relevance signals

### After (Chunked Embeddings)
- 3-5 focused embeddings per coffee
- Precise matching for specific queries
- Better ranking and relevance
- Chunk-type filtering capabilities

## 🔄 Implementation Workflow

### 1. Database Setup
```sql
-- Already implemented in your Supabase instance
-- coffee_chunks table and match_coffee_chunks function
```

### 2. Generate Initial Embeddings
```bash
# Start with chunked embeddings for better search quality
curl -X POST "http://localhost:5173/api/embeddings/populate?chunked=true"
```

### 3. Monitor Progress
```javascript
// API returns detailed progress information
{
  "success": true,
  "processed": { 
    "coffees": 150, 
    "chunks": 650 
  },
  "message": "Successfully processed 150 coffees with 650 chunks"
}
```

### 4. Test Search Quality
```javascript
// Test various query types
await ragService.retrieveRelevantCoffees("bright acidic coffee");
await ragService.retrieveRelevantCoffees("Ethiopian natural process");
await ragService.retrieveRelevantCoffees("chocolatey notes under $5");
```

## ⚙️ Configuration Options

### Chunked Search Options
```typescript
interface ChunkSearchOptions {
  maxCurrentInventory?: number;     // Default: 10
  similarityThreshold?: number;     // Default: 0.7
  chunkTypes?: string[];           // Optional: filter by chunk types
  useChunkedSearch?: boolean;      // Default: true
}
```

### Embedding Models
- **Current**: `text-embedding-3-small` (1536 dimensions)
- **Rate Limiting**: 100ms between API calls
- **Cost**: ~$0.02 per 1M tokens

## 📊 Performance Considerations

### Index Management
```sql
-- Monitor index performance
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE tablename = 'coffee_chunks';

-- Rebuild index if needed (after bulk data changes)
DROP INDEX idx_coffee_chunks_embedding;
CREATE INDEX idx_coffee_chunks_embedding ON coffee_chunks 
USING ivfflat (embedding vector_cosine_ops);
```

### Best Practices
1. **Bulk Load Then Index**: Load data first, create vector indexes after
2. **Monitor Similarity Thresholds**: Adjust based on search quality
3. **Periodic Index Rebuilds**: For changing data distributions
4. **Fallback Strategy**: Always maintain legacy search as backup

## 🔍 Search Examples

### Targeted Chunk Searches
```typescript
// Only search tasting notes
await ragService.retrieveRelevantCoffees("chocolate and caramel", {
  chunkTypes: ['tasting']
});

// Only search origin information
await ragService.retrieveRelevantCoffees("high altitude Colombian", {
  chunkTypes: ['origin']
});

// Commercial queries
await ragService.retrieveRelevantCoffees("budget friendly options", {
  chunkTypes: ['commercial']
});
```

### Multi-Aspect Queries
```typescript
// Let the system search all chunk types
await ragService.retrieveRelevantCoffees("bright Ethiopian with floral notes");
// → Matches both origin ('Ethiopian') and tasting ('bright', 'floral') chunks
```

## 🔧 Troubleshooting

### Common Issues

1. **No Search Results**
   - Check if embeddings exist: `SELECT COUNT(*) FROM coffee_chunks;`
   - Verify similarity threshold isn't too high
   - Ensure `stocked = true` in coffee_catalog

2. **Poor Search Quality**
   - Try lowering similarity threshold (0.6 instead of 0.7)
   - Check chunk content quality
   - Consider rebuilding embeddings

3. **Performance Issues**
   - Monitor vector index usage
   - Consider hybrid approach for large datasets
   - Adjust `match_count` parameter

### Debug Commands
```sql
-- Check chunk distribution
SELECT chunk_type, COUNT(*) FROM coffee_chunks GROUP BY chunk_type;

-- Test similarity function
SELECT * FROM match_coffee_chunks('[your_query_embedding]', 0.7, 5);

-- Check stocked coffees
SELECT COUNT(*) FROM coffee_catalog WHERE stocked = true;
```

## 🎯 Future Enhancements

1. **Hybrid Search**: Combine vector and keyword search
2. **User Preferences**: Personalized embeddings based on purchase history
3. **Seasonal Adjustment**: Time-weighted relevance scoring
4. **Multi-Modal**: Image embeddings for coffee bag photos
5. **Real-Time Updates**: Streaming embedding updates for new coffees

## 📈 Success Metrics

Monitor these to evaluate RAG performance:

- **Search Relevance**: User click-through rates on recommendations
- **Query Coverage**: Percentage of queries returning results
- **Response Time**: End-to-end search latency
- **Embedding Quality**: Manual evaluation of chunk relevance
- **User Satisfaction**: Feedback on recommendation quality

---

This RAG implementation provides a solid foundation for semantic coffee search while maintaining flexibility for future enhancements and optimizations.