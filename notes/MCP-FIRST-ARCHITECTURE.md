# MCP-First Architecture for Purveyors.io

## What Does "MCP-First" Actually Mean?

**Traditional Architecture** (current):
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │────▶│  REST APIs  │────▶│  Supabase   │
│  (SvelteKit)│     │ (+server.ts)│     │  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │    ┌─────────────┐│
       └───▶│  LangChain  │┘ (calls back to REST APIs)
            │   Tools     │
            └─────────────┘
```

**MCP-First Architecture** (proposed):
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web App   │────▶│             │────▶│  Supabase   │
│  (SvelteKit)│     │             │     │  (Postgres) │
└─────────────┘     │             │     └─────────────┘
                    │  MCP Server │
┌─────────────┐     │  (Tools +   │
│   Claude    │────▶│  Resources) │
│   Desktop   │     │             │
└─────────────┘     │             │
                    │             │
┌─────────────┐     │             │
│  3rd Party  │────▶│             │
│  AI Agents  │     └─────────────┘
└─────────────┘
```

**The Key Shift**: MCP tools become the **primary interface** to all business logic. The web app becomes just another client consuming these tools, alongside AI assistants and third-party integrations.

---

## Current vs MCP-First: Side-by-Side Comparison

### Data Access Layer

**Current Approach**:
```typescript
// /api/beans/+server.ts - Each endpoint builds its own queries
export async function GET({ locals }) {
  const { session, user } = await locals.safeGetSession();

  const { data } = await locals.supabase
    .from('green_coffee_inv')
    .select(`*, coffee_catalog!catalog_id(*)`)
    .eq('user', user.id);

  return json(data);
}
```

**MCP-First Approach**:
```typescript
// /mcp/tools/inventory.ts - Tool definition is the source of truth
export const getInventoryTool: MCPTool = {
  name: 'get_inventory',
  description: 'Get user green coffee inventory with catalog details',
  inputSchema: {
    type: 'object',
    properties: {
      stocked_only: { type: 'boolean', description: 'Filter to stocked items only' },
      region: { type: 'string', description: 'Filter by coffee region' },
      limit: { type: 'number', description: 'Max items to return' }
    }
  },
  handler: async (params, context) => {
    // Business logic lives HERE, once
    const inventory = await inventoryService.getForUser(context.userId, params);
    return { content: [{ type: 'text', text: JSON.stringify(inventory) }] };
  }
};

// Web app calls the same tool via MCP client
// Claude Desktop calls the same tool via MCP protocol
// Third-party apps call the same tool via MCP
```

### Authentication Flow

**Current Approach**:
```
Web App:     Cookie → safeGetSession() → Supabase JWT → user_roles lookup
API Keys:    Header → apiAuth.ts → bcrypt verify → tier lookup
LangChain:   Cookie passthrough → same as web app
```

**MCP-First Approach**:
```
All Clients → MCP Auth Layer → Unified Identity Resolution
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
      OAuth      API Key    Service Token
    (Web/Claude)  (Devs)    (Partners)
         │          │          │
         └──────────┼──────────┘
                    ▼
            Context Object
         { userId, orgId, role, tier, scopes }
                    │
                    ▼
              MCP Tool Execution
         (all tools receive same context)
```

### Feature Comparison

| Feature | Current Implementation | MCP-First Implementation |
|---------|----------------------|-------------------------|
| **Coffee Search** | `/api/catalog` + RAGService | `search_coffees` tool with embedded RAG |
| **Inventory CRUD** | `/api/beans` REST endpoints | `get/add/update/delete_inventory` tools |
| **Roast Profiles** | `/api/roast-profiles` + D3 charts | `get/log_roast` tools + `roast_chart` resource |
| **Profit Analysis** | `/api/profit` calculations | `analyze_profitability` tool |
| **AI Chat** | LangChain → calls REST APIs | Native MCP tool calling (no HTTP hop) |
| **Artisan Import** | `/api/artisan-import` | `import_artisan_profile` tool |

---

## Detailed Architecture

### Layer 1: MCP Server Core

```
/src/mcp/
├── server.ts              # MCP server initialization
├── auth/
│   ├── oauth.ts           # OAuth 2.0 handler
│   ├── apiKey.ts          # API key validation
│   └── context.ts         # Unified context builder
├── tools/
│   ├── catalog/
│   │   ├── search.ts      # search_coffees
│   │   ├── details.ts     # get_coffee_details
│   │   └── recommend.ts   # recommend_coffees
│   ├── inventory/
│   │   ├── list.ts        # get_inventory
│   │   ├── add.ts         # add_to_inventory
│   │   ├── update.ts      # update_inventory_item
│   │   └── delete.ts      # remove_from_inventory
│   ├── roasting/
│   │   ├── profiles.ts    # get_roast_profiles
│   │   ├── log.ts         # log_roast
│   │   ├── analyze.ts     # analyze_roast
│   │   └── import.ts      # import_artisan_profile
│   ├── business/
│   │   ├── profit.ts      # analyze_profitability
│   │   ├── sales.ts       # track_sale
│   │   └── inventory.ts   # inventory_valuation
│   └── ai/
│       ├── chat.ts        # coffee_assistant (meta-tool)
│       └── recommend.ts   # personalized_recommendations
├── resources/
│   ├── catalog.ts         # Coffee catalog as browseable resource
│   ├── inventory.ts       # User inventory as resource
│   └── charts.ts          # Roast chart data as resource
├── prompts/
│   ├── coffee-expert.ts   # Pre-built prompts for coffee queries
│   └── roast-advisor.ts   # Roasting guidance prompts
└── services/
    ├── database.ts        # Supabase abstraction
    ├── embeddings.ts      # OpenAI embeddings
    └── analytics.ts       # Business calculations
```

### Layer 2: Transport Adapters

```
/src/mcp/transports/
├── stdio.ts               # For Claude Desktop (local)
├── sse.ts                 # For web app (Server-Sent Events)
├── websocket.ts           # For real-time applications
└── http.ts                # For REST-like access (compatibility)
```

### Layer 3: Web App Integration

**Option A: MCP Client in Browser**
```typescript
// Web app uses MCP client to call tools
import { MCPClient } from '@anthropic/mcp-sdk';

const client = new MCPClient({
  transport: new SSETransport('/mcp/sse'),
  auth: { token: session.access_token }
});

// Instead of fetch('/api/beans')
const inventory = await client.callTool('get_inventory', {
  stocked_only: true
});
```

**Option B: Thin REST Wrapper (Hybrid)**
```typescript
// REST endpoints become thin wrappers around MCP tools
// /api/beans/+server.ts
import { mcpServer } from '$lib/mcp/server';

export async function GET({ locals, url }) {
  const context = await buildContext(locals);
  const params = Object.fromEntries(url.searchParams);

  // Delegate to MCP tool
  const result = await mcpServer.callTool('get_inventory', params, context);

  return json(result);
}
```

**Option C: Full MCP Native (Ambitious)**
```typescript
// SvelteKit app mounts MCP transport directly
// /src/hooks.server.ts
import { mcpServer } from '$lib/mcp/server';
import { handleMCPRequest } from '$lib/mcp/transports/sse';

export const handle = sequence(
  handleSupabase,
  handleMCPRequest(mcpServer), // /mcp/* routes handled by MCP
  handleRoutes
);
```

---

## Tool Definitions: What They Would Look Like

### Example: Search Coffees Tool

```typescript
// /src/mcp/tools/catalog/search.ts
import { z } from 'zod';
import { defineTool } from '../utils';
import { ragService } from '$lib/services/ragService';

export const searchCoffeesTool = defineTool({
  name: 'search_coffees',
  description: `Search the coffee catalog using natural language or filters.
    Supports semantic search ("bright Ethiopian naturals") and structured
    filters (region, processing, price range). Returns matching coffees
    with full details including tasting notes, origin info, and availability.`,

  inputSchema: z.object({
    query: z.string().optional().describe('Natural language search query'),
    region: z.string().optional().describe('Filter by region (e.g., "Ethiopia", "Colombia")'),
    country: z.string().optional().describe('Filter by country'),
    processing: z.string().optional().describe('Processing method (washed, natural, honey, etc.)'),
    min_price: z.number().optional().describe('Minimum price per lb'),
    max_price: z.number().optional().describe('Maximum price per lb'),
    min_score: z.number().optional().describe('Minimum quality score (0-100)'),
    in_stock: z.boolean().optional().describe('Only show available coffees'),
    limit: z.number().default(10).describe('Max results to return'),
    include_embeddings: z.boolean().default(false).describe('Include vector embeddings in response')
  }),

  // Scopes required to call this tool
  scopes: ['catalog:read'], // Public scope, no auth required for basic access

  handler: async (params, context) => {
    let results;

    if (params.query) {
      // Semantic search path
      results = await ragService.search(params.query, {
        limit: params.limit,
        filters: {
          region: params.region,
          processing: params.processing,
          minPrice: params.min_price,
          maxPrice: params.max_price,
          minScore: params.min_score,
          inStock: params.in_stock
        }
      });
    } else {
      // Structured filter path
      results = await catalogService.filter(params);
    }

    // Format for MCP response
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          count: results.length,
          coffees: results.map(c => ({
            id: c.id,
            name: c.name,
            region: c.region,
            country: c.country,
            processing: c.processing,
            price_lb: c.cost_lb,
            score: c.score,
            tasting_notes: c.ai_tasting_notes,
            description: c.ai_description,
            available: c.in_stock,
            ...(params.include_embeddings && { embedding: c.embedding })
          }))
        }, null, 2)
      }]
    };
  }
});
```

### Example: Log Roast Tool (Authenticated)

```typescript
// /src/mcp/tools/roasting/log.ts
export const logRoastTool = defineTool({
  name: 'log_roast',
  description: `Record a new roasting session. Captures all roast parameters
    including temperatures, timing, weight loss, and development metrics.
    Automatically calculates derived metrics (RoR, development %, Maillard %).`,

  inputSchema: z.object({
    coffee_id: z.string().describe('ID of the green coffee from inventory'),
    batch_size_g: z.number().describe('Starting batch weight in grams'),

    // Temperature readings
    charge_temp: z.number().describe('Charge temperature (°F)'),
    dry_end_temp: z.number().optional().describe('Dry end temperature'),
    fc_start_temp: z.number().optional().describe('First crack start temperature'),
    fc_rolling_temp: z.number().optional().describe('First crack rolling temperature'),
    sc_start_temp: z.number().optional().describe('Second crack start temperature'),
    drop_temp: z.number().describe('Drop temperature'),

    // Timing (seconds from charge)
    dry_end_time: z.number().optional(),
    fc_start_time: z.number().optional(),
    fc_rolling_time: z.number().optional(),
    sc_start_time: z.number().optional(),
    drop_time: z.number().describe('Total roast time in seconds'),

    // Results
    end_weight_g: z.number().describe('Final roasted weight in grams'),
    roast_level: z.enum(['light', 'medium-light', 'medium', 'medium-dark', 'dark']).optional(),

    // Optional detailed log
    profile_log: z.array(z.object({
      time: z.number(),
      bean_temp: z.number(),
      env_temp: z.number().optional(),
      fan_setting: z.number().optional()
    })).optional().describe('Detailed temperature log (for Artisan imports)')
  }),

  scopes: ['roasts:write'], // Requires authenticated member

  handler: async (params, context) => {
    // Verify user owns this inventory item
    const coffee = await inventoryService.getById(params.coffee_id, context.userId);
    if (!coffee) {
      throw new MCPError('INVALID_PARAMS', 'Coffee not found in your inventory');
    }

    // Calculate derived metrics
    const metrics = calculateRoastMetrics(params);

    // Create roast profile
    const roast = await roastService.create({
      ...params,
      ...metrics,
      user: context.userId,
      roast_date: new Date().toISOString()
    });

    // If detailed log provided, store it
    if (params.profile_log) {
      await roastService.saveProfileLog(roast.id, params.profile_log);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          roast_id: roast.id,
          metrics: {
            weight_loss_pct: metrics.weight_loss_pct,
            development_pct: metrics.development_pct,
            maillard_pct: metrics.maillard_pct,
            avg_ror: metrics.avg_ror
          },
          message: `Roast logged successfully. Weight loss: ${metrics.weight_loss_pct}%, Development: ${metrics.development_pct}%`
        }, null, 2)
      }]
    };
  }
});
```

### Example: Analyze Profitability Tool

```typescript
// /src/mcp/tools/business/profit.ts
export const analyzeProfitabilityTool = defineTool({
  name: 'analyze_profitability',
  description: `Analyze profit margins and business performance. Can analyze
    by coffee, time period, customer, or overall business. Returns cost
    breakdown, revenue, margins, and actionable insights.`,

  inputSchema: z.object({
    analysis_type: z.enum(['overall', 'by_coffee', 'by_customer', 'by_period']),
    coffee_id: z.string().optional().describe('Specific coffee to analyze'),
    start_date: z.string().optional().describe('Start date (ISO format)'),
    end_date: z.string().optional().describe('End date (ISO format)'),
    include_recommendations: z.boolean().default(true)
  }),

  scopes: ['sales:read', 'inventory:read'], // Requires member with sales access

  handler: async (params, context) => {
    const analysis = await profitService.analyze({
      userId: context.userId,
      ...params
    });

    let recommendations = [];
    if (params.include_recommendations) {
      recommendations = await generateProfitRecommendations(analysis, context);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: {
            total_revenue: analysis.totalRevenue,
            total_cost: analysis.totalCost,
            gross_profit: analysis.grossProfit,
            margin_pct: analysis.marginPct,
            period: analysis.period
          },
          breakdown: analysis.breakdown,
          top_performers: analysis.topPerformers,
          recommendations
        }, null, 2)
      }]
    };
  }
});
```

---

## MCP Resources: Browseable Data

MCP Resources are different from Tools - they're **browseable data** that AI can explore without executing a function.

```typescript
// /src/mcp/resources/catalog.ts
export const catalogResource: MCPResource = {
  uri: 'purveyors://catalog',
  name: 'Coffee Catalog',
  description: 'Browse the complete coffee catalog organized by region and origin',
  mimeType: 'application/json',

  // Resource can have child resources (hierarchical)
  children: async () => {
    const regions = await catalogService.getRegions();
    return regions.map(region => ({
      uri: `purveyors://catalog/region/${region.slug}`,
      name: region.name,
      description: `${region.coffeeCount} coffees from ${region.name}`
    }));
  },

  // Content at this level
  read: async () => {
    const summary = await catalogService.getSummary();
    return {
      contents: [{
        uri: 'purveyors://catalog',
        mimeType: 'application/json',
        text: JSON.stringify(summary, null, 2)
      }]
    };
  }
};

// User's inventory as a resource
export const inventoryResource: MCPResource = {
  uri: 'purveyors://my/inventory',
  name: 'My Coffee Inventory',
  description: 'Your personal green coffee inventory',

  // Scoped to authenticated user
  scopes: ['inventory:read'],

  read: async (context) => {
    const inventory = await inventoryService.getForUser(context.userId);
    return {
      contents: [{
        uri: 'purveyors://my/inventory',
        mimeType: 'application/json',
        text: JSON.stringify(inventory, null, 2)
      }]
    };
  }
};
```

---

## MCP Prompts: Pre-built Interactions

```typescript
// /src/mcp/prompts/coffee-expert.ts
export const coffeeExpertPrompt: MCPPrompt = {
  name: 'coffee_expert',
  description: 'Get expert coffee advice tailored to your inventory and preferences',
  arguments: [
    {
      name: 'question',
      description: 'Your coffee question',
      required: true
    },
    {
      name: 'context',
      description: 'Additional context (optional)',
      required: false
    }
  ],

  generate: async (args, context) => {
    // Pull user's data to personalize the prompt
    const inventory = context.userId
      ? await inventoryService.getForUser(context.userId)
      : null;
    const recentRoasts = context.userId
      ? await roastService.getRecent(context.userId, 5)
      : null;

    return {
      messages: [
        {
          role: 'system',
          content: `You are a specialty coffee expert with deep knowledge of
            sourcing, roasting, and flavor development. You have access to
            the user's inventory and roasting history to provide personalized advice.

            ${inventory ? `User's current inventory: ${JSON.stringify(inventory)}` : ''}
            ${recentRoasts ? `Recent roasts: ${JSON.stringify(recentRoasts)}` : ''}

            Provide specific, actionable advice based on their actual coffees and
            roasting patterns. Reference specific coffees by name when relevant.`
        },
        {
          role: 'user',
          content: args.question + (args.context ? `\n\nContext: ${args.context}` : '')
        }
      ]
    };
  }
};
```

---

## How Current Features Would Transform

### 1. Coffee Catalog Page (`/catalog`)

**Current Flow**:
```
+page.server.ts → Supabase query → Return to page → Client renders
                      ↓
              RAGService for search
```

**MCP-First Flow**:
```svelte
<!-- +page.svelte -->
<script>
  import { mcpClient } from '$lib/mcp/client';

  let coffees = $state([]);
  let searchQuery = $state('');

  // Initial load via MCP resource
  const catalogResource = await mcpClient.readResource('purveyors://catalog');
  coffees = JSON.parse(catalogResource.text);

  // Search via MCP tool
  async function handleSearch() {
    const result = await mcpClient.callTool('search_coffees', {
      query: searchQuery,
      limit: 20
    });
    coffees = JSON.parse(result.content[0].text).coffees;
  }
</script>
```

**Benefit**: Same search logic works in web app AND Claude Desktop AND third-party integrations.

### 2. Roast Profiles Page (`/roast`)

**Current Flow**:
```
Page → /api/roast-profiles → Supabase → D3 chart rendering
         ↓
/api/artisan-import for file uploads
```

**MCP-First Flow**:
```svelte
<script>
  // Get roast data via MCP
  const roasts = await mcpClient.callTool('get_roast_profiles', {
    limit: 50,
    include_logs: true
  });

  // Artisan import via MCP
  async function handleArtisanImport(file) {
    const content = await file.text();
    await mcpClient.callTool('import_artisan_profile', {
      file_content: content,
      file_name: file.name
    });
  }

  // Log new roast via MCP
  async function saveRoast(roastData) {
    await mcpClient.callTool('log_roast', roastData);
  }
</script>
```

**Benefit**: User in Claude Desktop can say "Import my latest Artisan roast and tell me how it compares to last week's roast of the same coffee."

### 3. AI Chat (`/chat`)

**Current Flow**:
```
Chat input → /api/chat → LangChain → Tools call /api/tools/* → Response
```

**MCP-First Flow**:
```
Chat input → Claude (native) → MCP tools directly → Response
                                    ↓
                            No HTTP hop needed
                            Tools are first-class
```

**The chat becomes optional** - users can interact with their data through any MCP-compatible AI assistant, not just the embedded chat.

### 4. Profit Analysis (`/profit`)

**Current Flow**:
```
Page → /api/profit → Complex SQL calculations → Return aggregates
```

**MCP-First Flow**:
```
User in Claude: "What's my profit margin on Ethiopian coffees
                this quarter compared to last quarter?"
         ↓
Claude calls: analyze_profitability tool
         ↓
Tool returns: Structured data + AI-generated insights
         ↓
Claude synthesizes: Natural language response with recommendations
```

**Benefit**: Business intelligence becomes conversational, not dashboard-only.

---

## Benefits of MCP-First

### 1. **Write Once, Use Everywhere**
- Same tool definition serves web app, Claude Desktop, third-party apps
- No duplication of business logic across endpoints
- Single source of truth for data operations

### 2. **AI-Native from the Start**
- Tools designed for LLM consumption (good descriptions, typed schemas)
- Resources provide browseable context
- Prompts encode domain expertise

### 3. **Automatic Multi-Modal Support**
- Web app: HTTP/SSE transport
- Claude Desktop: stdio transport
- Mobile apps: WebSocket transport
- Partners: REST compatibility layer

### 4. **Better Developer Experience**
- Self-documenting tools (schemas + descriptions)
- Type-safe clients generated from tool definitions
- Consistent authentication across all access patterns

### 5. **Future-Proof Architecture**
- MCP is becoming industry standard (Anthropic, OpenAI, Google, Microsoft)
- Easy to add new AI integrations as they emerge
- Protocol handles transport complexity

---

## Tradeoffs and Challenges

### 1. **Learning Curve**
- Team needs to learn MCP concepts
- Different mental model than REST APIs
- Tooling ecosystem still maturing

### 2. **Performance Overhead**
- MCP adds protocol overhead vs direct Supabase calls
- Serialization/deserialization for every operation
- **Mitigation**: Caching layer, batch operations

### 3. **Web App Complexity**
- Need MCP client in browser (or thin wrapper)
- Real-time updates more complex
- **Mitigation**: SSE transport, hybrid approach for real-time

### 4. **Migration Effort**
- Existing REST endpoints need conversion
- Client code needs updates
- **Mitigation**: Gradual migration, compatibility layer

### 5. **Debugging Complexity**
- Tool chains harder to trace than REST calls
- Multiple transports to support
- **Mitigation**: Comprehensive logging, MCP Inspector tool

---

## Migration Strategy

### Phase 1: Parallel MCP Server (4-6 weeks)
- Build MCP server alongside existing APIs
- Implement core tools (catalog, inventory, roasts)
- Test with Claude Desktop
- No changes to web app

### Phase 2: Hybrid Integration (4-6 weeks)
- Add MCP client to web app (SSE transport)
- Migrate one feature at a time (start with catalog search)
- REST endpoints become thin wrappers calling MCP tools
- Both paths work simultaneously

### Phase 3: Full Migration (6-8 weeks)
- Migrate remaining features to MCP tools
- Deprecate direct REST endpoints
- Add MCP resources and prompts
- Full feature parity via MCP

### Phase 4: Optimization (Ongoing)
- Performance tuning
- Advanced caching
- Real-time subscriptions via MCP
- Partner/embedded SDK

---

## Decision Framework

### Go MCP-First If:
- You believe AI assistants are the future interface
- You want third-party AI integrations as a core feature
- You're willing to invest in architecture for long-term gains
- Developer/API revenue is a priority

### Stay REST-First If:
- Web app performance is paramount
- AI features are supplementary, not core
- Team is more comfortable with REST patterns
- Faster time-to-market is critical

### Hybrid Approach (Recommended):
- MCP server as primary interface for AI tools
- Thin REST wrappers for web app (calling MCP internally)
- Gradual migration as MCP ecosystem matures
- Best of both worlds with clear upgrade path

---

## Conclusion

Converting purveyors.io to MCP-first is a significant architectural decision with real tradeoffs. The hybrid approach offers the best balance:

1. **Build MCP server** with comprehensive tools
2. **Keep REST endpoints** as thin wrappers initially
3. **Migrate gradually** as you validate the pattern
4. **Optimize later** based on real usage data

This positions purveyors.io as an AI-native platform while maintaining web app performance and allowing iterative improvements.

---

*Document generated: January 2026*
*Related: MCP-SERVER-PROPOSAL.md, API-strategy.md*
