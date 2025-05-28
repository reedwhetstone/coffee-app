To implement true RAG with your entire coffee dataset (both current inventory and historical data), you'd need to set up a vector database and semantic search system. Here's how you could approach this:

## 1. Vector Database Setup

First, you'd need to choose a vector database. For your use case, I'd recommend:

- **Supabase Vector/pgvector** (since you're already using Supabase)
- **Pinecone** (managed service)
- **Weaviate** (open source)

## 2. Data Preparation & Embedding

Search files...
Perfect! Now I can see your data structure. Here's how you'd implement true RAG with both current inventory and historical coffee data:

## Implementation Plan

### 1. **Database Schema Extension**

First, add a vector column to store embeddings:

```sql:supabase/migrations/add_vector_embeddings.sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to coffee_catalog (your main historical data)
ALTER TABLE coffee_catalog
ADD COLUMN embedding vector(1536); -- OpenAI ada-002 dimension


-- Create indexes for vector similarity search
CREATE INDEX ON coffee_catalog USING ivfflat (embedding vector_cosine_ops);

-- Only create this index
CREATE INDEX coffee_catalog_embedding_idx
ON coffee_catalog
USING ivfflat (embedding vector_cosine_ops);

⚠️ But Here’s the Catch with ivfflat (Approximate Vector Indexing):
Unlike standard B-tree indexes, IVFFlat uses a clustering approach, and new vectors may be poorly indexed unless conditions are right.

Key Implications:
Insertions after index creation go into a fixed set of clusters.

If the original clustering (done during index creation) doesn't suit the new data well, query performance or accuracy can degrade.

Best practice: bulk insert → create index

It’s better to:

Load most of your data

Then run CREATE INDEX

This allows the clustering algorithm to build a good representation of your dataset.

For optimal performance over time:

You may need to periodically drop and recreate the index if your data distribution changes significantly.

Or consider a hybrid approach: use IVFFlat for historical data + brute force for recent entries.


```

### 2. **Embedding Generation Service**

```typescript:src/lib/services/embeddingService.ts
// src/lib/services/embeddingService.ts
import { OPENAI_API_KEY } from '$env/static/private';

interface CoffeeData {
  id: number;
  name: string;
  cupping_notes?: string;
  description_short?: string;
  description_long?: string;
  farm_notes?: string;
  region?: string;
  processing?: string;
  cultivar_detail?: string;
  score_value?: number;
}

export class EmbeddingService {
  private openaiApiKey: string;

  constructor(apiKey: string) {
    this.openaiApiKey = apiKey;
  }

  /**
   * Create a rich text representation for embedding
   */
  private createEmbeddingText(coffee: CoffeeData): string {
    const parts = [
      `Coffee: ${coffee.name}`,
      coffee.region && `Region: ${coffee.region}`,
      coffee.processing && `Processing: ${coffee.processing}`,
      coffee.cultivar_detail && `Variety: ${coffee.cultivar_detail}`,
      coffee.score_value && `Score: ${coffee.score_value}`,
      coffee.cupping_notes && `Cupping Notes: ${coffee.cupping_notes}`,
      coffee.description_short && `Description: ${coffee.description_short}`,
      coffee.description_long && `Details: ${coffee.description_long}`,
      coffee.farm_notes && `Farm Notes: ${coffee.farm_notes}`
    ].filter(Boolean);

    return parts.join('. ');
  }

  /**
   * Generate embedding for a single coffee
   */
  async generateEmbedding(coffee: CoffeeData): Promise<number[]> {
    const text = this.createEmbeddingText(coffee);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate embedding for user query
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: query,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

### 3. **RAG Service**

```typescript:src/lib/services/ragService.ts
// src/lib/services/ragService.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { EmbeddingService } from './embeddingService';

interface RetrievalResult {
  currentInventory: any[];
  historicalData: any[];
  similarCoffees: any[];
}

export class RAGService {
  private supabase: SupabaseClient;
  private embeddingService: EmbeddingService;

  constructor(supabase: SupabaseClient, openaiApiKey: string) {
    this.supabase = supabase;
    this.embeddingService = new EmbeddingService(openaiApiKey);
  }

  /**
   * Retrieve relevant coffee data using semantic search
   */
  async retrieveRelevantCoffees(
    query: string,
    options: {
      maxCurrentInventory?: number;
      maxHistorical?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<RetrievalResult> {
    const {
      maxCurrentInventory = 10,
      maxHistorical = 20,
      similarityThreshold = 0.7
    } = options;

    // Generate embedding for the user query
    const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

    // Search current inventory (stocked items)
    const { data: currentInventory } = await this.supabase
      .from('coffee_catalog')
      .select('*')
      .eq('stocked', true)
      .not('embedding', 'is', null)
      .order(
        this.supabase.rpc('similarity', {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold
        }),
        { ascending: false }
      )
      .limit(maxCurrentInventory);

    // Search historical data (all coffees for context)
    const { data: historicalData } = await this.supabase
      .from('coffee_catalog')
      .select('*')
      .not('embedding', 'is', null)
      .order(
        this.supabase.rpc('similarity', {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold
        }),
        { ascending: false }
      )
      .limit(maxHistorical);

    // Also search user's personal inventory for additional context
    const { data: personalInventory } = await this.supabase
      .from('green_coffee_inv')
      .select('*')
      .not('embedding', 'is', null)
      .order(
        this.supabase.rpc('similarity_personal', {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold
        }),
        { ascending: false }
      )
      .limit(5);

    return {
      currentInventory: currentInventory || [],
      historicalData: historicalData || [],
      similarCoffees: personalInventory || []
    };
  }
}
```

### 4. **Database Functions for Similarity Search**

```sql:supabase/migrations/similarity_functions.sql
-- Function for coffee_catalog similarity search
CREATE OR REPLACE FUNCTION similarity(query_embedding vector(1536), match_threshold float)
RETURNS float
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1 - (embedding <=> query_embedding);
END;
$$;

-- Function for green_coffee_inv similarity search
CREATE OR REPLACE FUNCTION similarity_personal(query_embedding vector(1536), match_threshold float)
RETURNS float
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1 - (embedding <=> query_embedding);
END;
$$;
```

### 5. **Updated LLM API with RAG**

```typescript:src/routes/api/LLM/+server.ts
import { json } from '@sveltejs/kit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_API_KEY, OPENAI_API_KEY } from '$env/static/private';
import { RAGService } from '$lib/services/ragService';
import type { RequestHandler } from './$types';

const genAI = new GoogleGenerativeAI(AI_API_KEY);

export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
  try {
    const { prompt, coffeeData } = await request.json();

    // Initialize RAG service
    const ragService = new RAGService(supabase, OPENAI_API_KEY);

    // Retrieve relevant coffee data using semantic search
    const retrievalResult = await ragService.retrieveRelevantCoffees(prompt, {
      maxCurrentInventory: 15,
      maxHistorical: 25,
      similarityThreshold: 0.6
    });

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192
      }
    });

    let chatSession = model.startChat({
      history: [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert coffee consultant with deep knowledge of contemporary coffee best practices, Cup of Excellence, Specialty Coffee Association Q-Grading, varieties, processing methods, flavor profiles, and more.

Your task is to analyze coffee data and make personalized recommendations based on the user's query. You have access to:

1. CURRENT INVENTORY: Currently stocked coffees available for purchase
2. HISTORICAL DATA: Past coffees for context, trends, and comparison
3. SIMILAR COFFEES: Related coffees from our database

Use the same scoring rubric as before, but now you can reference historical patterns, seasonal availability, and make more informed recommendations based on the broader context.

When making recommendations:
- Prioritize CURRENT INVENTORY for actual recommendations
- Use HISTORICAL DATA to provide context, explain trends, or suggest alternatives
- Reference SIMILAR COFFEES to explain why certain characteristics work well

[Same scoring rubric as before...]`
            }
          ]
        },
        {
          role: 'model',
          parts: [
            {
              text: "I understand my enhanced role as a coffee expert with access to both current inventory and historical context. I'll use semantic search results to provide more informed recommendations, drawing on patterns from historical data while prioritizing currently available coffees."
            }
          ]
        }
      ]
    });

    const contextualPrompt = `
CURRENT INVENTORY (Available for Purchase):
${JSON.stringify(retrievalResult.currentInventory, null, 2)}

HISTORICAL CONTEXT (For Reference & Trends):
${JSON.stringify(retrievalResult.historicalData, null, 2)}

SIMILAR COFFEES (Additional Context):
${JSON.stringify(retrievalResult.similarCoffees, null, 2)}

USER QUERY: ${prompt}

Please provide recommendations prioritizing CURRENT INVENTORY, but use the historical and similar coffee data to provide richer context and explanations.
`;

    const result = await chatSession.sendMessage(contextualPrompt);
    const response = await result.response;

    return json({
      text: response.text(),
      metadata: {
        currentInventoryCount: retrievalResult.currentInventory.length,
        historicalDataCount: retrievalResult.historicalData.length,
        similarCoffeesCount: retrievalResult.similarCoffees.length
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
```

### 6. **Embedding Population Script**

```typescript:src/routes/api/embeddings/populate/+server.ts
// src/routes/api/embeddings/populate/+server.ts
import { json } from '@sveltejs/kit';
import { EmbeddingService } from '$lib/services/embeddingService';
import { OPENAI_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals: { supabase } }) => {
  try {
    const embeddingService = new EmbeddingService(OPENAI_API_KEY);

    // Process coffee_catalog
    const { data: catalogCoffees } = await supabase
      .from('coffee_catalog')
      .select('*')
      .is('embedding', null);

    let processedCatalog = 0;
    for (const coffee of catalogCoffees || []) {
      const embedding = await embeddingService.generateEmbedding(coffee);

      await supabase
        .from('coffee_catalog')
        .update({ embedding })
        .eq('id', coffee.id);

      processedCatalog++;

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process green_coffee_inv
    const { data: inventoryCoffees } = await supabase
      .from('green_coffee_inv')
      .select('*')
      .is('embedding', null);

    let processedInventory = 0;
    for (const coffee of inventoryCoffees || []) {
      const embedding = await embeddingService.generateEmbedding(coffee);

      await supabase
        .from('green_coffee_inv')
        .update({ embedding })
        .eq('id', coffee.id);

      processedInventory++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return json({
      success: true,
      processed: {
        catalog: processedCatalog,
        inventory: processedInventory
      }
    });
  } catch (error) {
    console.error('Embedding population error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
```

## Benefits of This RAG Implementation

1. **Semantic Understanding**: Finds coffees based on meaning, not just keywords
2. **Historical Context**: LLM can reference past trends and seasonal patterns
3. **Better Recommendations**: More nuanced suggestions based on broader coffee knowledge
4. **Scalable**: Works efficiently even with large datasets
5. **Contextual Awareness**: Can explain why certain coffees work well together

## Usage

1. Run the embedding population script once to generate initial embeddings

curl -X POST http://localhost:5173/api/embeddings/populate \
 -H "Content-Type: application/json"

2. Set up a cron job to generate embeddings for new coffees
3. Your LLM will now have access to semantically relevant coffee data rather than the entire dataset

This gives you true RAG with rich historical context while maintaining performance and relevance!
