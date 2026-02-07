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

| Feature             | Current Implementation            | MCP-First Implementation                       |
| ------------------- | --------------------------------- | ---------------------------------------------- |
| **Coffee Search**   | `/api/catalog` + RAGService       | `search_coffees` tool with embedded RAG        |
| **Inventory CRUD**  | `/api/beans` REST endpoints       | `get/add/update/delete_inventory` tools        |
| **Roast Profiles**  | `/api/roast-profiles` + D3 charts | `get/log_roast` tools + `roast_chart` resource |
| **Profit Analysis** | `/api/profit` calculations        | `analyze_profitability` tool                   |
| **AI Chat**         | LangChain → calls REST APIs       | Native MCP tool calling (no HTTP hop)          |
| **Artisan Import**  | `/api/artisan-import`             | `import_artisan_profile` tool                  |

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
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							count: results.length,
							coffees: results.map((c) => ({
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
						},
						null,
						2
					)
				}
			]
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
		profile_log: z
			.array(
				z.object({
					time: z.number(),
					bean_temp: z.number(),
					env_temp: z.number().optional(),
					fan_setting: z.number().optional()
				})
			)
			.optional()
			.describe('Detailed temperature log (for Artisan imports)')
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
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							success: true,
							roast_id: roast.id,
							metrics: {
								weight_loss_pct: metrics.weight_loss_pct,
								development_pct: metrics.development_pct,
								maillard_pct: metrics.maillard_pct,
								avg_ror: metrics.avg_ror
							},
							message: `Roast logged successfully. Weight loss: ${metrics.weight_loss_pct}%, Development: ${metrics.development_pct}%`
						},
						null,
						2
					)
				}
			]
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
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
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
						},
						null,
						2
					)
				}
			]
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
		return regions.map((region) => ({
			uri: `purveyors://catalog/region/${region.slug}`,
			name: region.name,
			description: `${region.coffeeCount} coffees from ${region.name}`
		}));
	},

	// Content at this level
	read: async () => {
		const summary = await catalogService.getSummary();
		return {
			contents: [
				{
					uri: 'purveyors://catalog',
					mimeType: 'application/json',
					text: JSON.stringify(summary, null, 2)
				}
			]
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
			contents: [
				{
					uri: 'purveyors://my/inventory',
					mimeType: 'application/json',
					text: JSON.stringify(inventory, null, 2)
				}
			]
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
		const inventory = context.userId ? await inventoryService.getForUser(context.userId) : null;
		const recentRoasts = context.userId ? await roastService.getRecent(context.userId, 5) : null;

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

## Critical Concerns: Why MCP-First May Be Wrong

Before proceeding, we must honestly address fundamental problems with using MCP as a web app data layer. **These are not minor tradeoffs—they are architectural mismatches.**

### 1. The Shape Mismatch (JSON vs. Context)

**The Problem**: MCP was designed to return **text or blobs** meant for an LLM's context window, not structured JSON for UI components.

| Protocol         | Returns                                            | Designed For      |
| ---------------- | -------------------------------------------------- | ----------------- |
| **REST/GraphQL** | `[{ "id": 1, "name": "Ethiopia", "price": 8.50 }]` | Direct UI binding |
| **MCP**          | `{ content: [{ type: 'text', text: '...' }] }`     | LLM consumption   |

**Real Impact**:

```typescript
// REST - Clean, direct mapping
const coffees = await fetch('/api/catalog').then(r => r.json());
coffees.forEach(c => render(<CoffeeCard coffee={c} />));

// MCP - Awkward parsing required
const result = await mcpClient.callTool('search_coffees', {});
const parsed = JSON.parse(result.content[0].text); // 🚩 Extra step
const coffees = parsed.coffees; // 🚩 Nested extraction
coffees.forEach(c => render(<CoffeeCard coffee={c} />));
```

**Verdict**: MCP adds a serialization layer that provides zero value for traditional UI rendering. You're essentially using a semi-truck to deliver a pizza.

### 2. Client-Side Complexity (Massive Plumbing)

**The Problem**: MCP is a **stateful protocol**. To use it in a browser, your frontend must:

1. Implement a full MCP Client SDK (~50KB+ gzipped)
2. Perform protocol handshake on connection
3. Negotiate capabilities (prompts, resources, tools)
4. Maintain persistent SSE connection
5. Handle reconnection, state sync, and timeouts

**Comparison**:

```typescript
// REST - Native browser capability
const data = await fetch('/api/beans').then((r) => r.json());

// MCP - Requires shipping significant plumbing
import { MCPClient } from '@anthropic/mcp-sdk'; // Heavy dependency
import { SSETransport } from '@anthropic/mcp-sdk/transports';

const client = new MCPClient({
	transport: new SSETransport('/mcp/sse'),
	auth: { token: session.access_token }
});

await client.connect(); // Handshake
await client.negotiateCapabilities(); // Capability exchange
const result = await client.callTool('get_inventory', {});
// Plus: reconnection handlers, state management, error recovery...
```

**Verdict**: You're shipping kilobytes of protocol code to the client for something `fetch()` does natively.

### 3. Security Risks (The "God Mode" Problem)

**The Problem**: MCP servers expose **Tools** designed to give AI agents agency. These often include powerful operations:

- `execute_sql_query` - Run arbitrary SQL
- `read_file_system` - Access files
- `update_inventory` - Write operations

**The Risk**: Exposing an MCP server directly to a browser is effectively handing every user a command-line interface to your backend.

```
Traditional REST:
  GET /api/user/profile → Specific, scoped endpoint
  POST /api/beans → Validates, sanitizes, rate limits

MCP in Browser:
  callTool('execute_query', { sql: 'SELECT * FROM users' }) → 🚨 God mode
  callTool('update_inventory', { ... }) → Direct DB access
```

**Mitigation Attempt**: Build a proxy layer to strip sensitive tools...
**Reality**: You've just reinvented a bad REST API with extra steps.

**Verdict**: The security model of MCP assumes a trusted client (AI assistant with user oversight), not an untrusted browser environment.

### 4. Caching and Performance (Session vs. Stateless)

**The Problem**: MCP is designed for **conversational sessions**, not high-traffic web applications.

| Feature            | REST/HTTP                      | MCP                      |
| ------------------ | ------------------------------ | ------------------------ |
| **Caching**        | ETags, Cache-Control, CDN      | None native              |
| **Stateless**      | Yes - each request independent | No - session-based       |
| **Connection**     | Per-request or keep-alive      | Persistent SSE required  |
| **CDN Support**    | Full edge caching              | Not applicable           |
| **Load Balancing** | Simple round-robin             | Sticky sessions required |

**Real Impact**:

- Your `/api/catalog` can be cached at the CDN edge for 1 hour
- An MCP tool call cannot—it's a dynamic session interaction
- 1000 users loading catalog = 1000 MCP sessions vs. 1 CDN hit

**Verdict**: MCP's session model is fundamentally incompatible with web-scale caching strategies.

### 5. Debugging and Observability

**The Problem**: REST calls are easy to trace in browser DevTools. MCP interactions are opaque.

```
REST debugging:
  Network tab → /api/beans → 200 OK → Response JSON → Done

MCP debugging:
  SSE connection → Binary frames → Tool call → Response frame → Parse → ???
  Where did it fail? Which tool? What was the context?
```

**Verdict**: Your team's debugging productivity drops significantly.

---

## The Fundamental Question

> "Should my web app use MCP as its data layer?"

**Answer: Almost certainly NO.**

MCP excels at one thing: **enabling AI assistants to interact with your data**.

Using MCP for browser-to-server communication is like using a language translation API to talk to someone who speaks the same language as you. It works, but why?

---

## Revised Architecture: The Correct Approach

Given these concerns, here's the architecture that actually makes sense:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PURVEYORS.IO                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                          ┌─────────────┐       │
│  │   Web App   │────── REST/Supabase ────▶│  Database   │       │
│  │  (SvelteKit)│         (FAST)           │  (Postgres) │       │
│  └─────────────┘                          └─────────────┘       │
│         │                                        ▲              │
│         │ (Chat/GenUI only)                      │              │
│         ▼                                        │              │
│  ┌─────────────┐     ┌─────────────┐            │              │
│  │  LLM Layer  │────▶│  MCP Server │────────────┘              │
│  │  (Claude)   │     │  (AI only)  │                           │
│  └─────────────┘     └─────────────┘                           │
│                             ▲                                   │
│                             │                                   │
│  ┌─────────────┐            │                                   │
│  │   Claude    │────────────┘                                   │
│  │   Desktop   │  (External AI clients)                         │
│  └─────────────┘                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight**:

- **Web app** → REST/Supabase (what it's designed for)
- **AI clients** → MCP (what it's designed for)
- **Shared business logic** → Service layer (called by both)

---

## Tradeoffs and Challenges (Revised)

### 1. **Learning Curve**

- Team needs to learn MCP concepts
- Different mental model than REST APIs
- Tooling ecosystem still maturing

### 2. **Performance Overhead**

- MCP adds protocol overhead vs direct Supabase calls
- Serialization/deserialization for every operation
- **Mitigation**: Only use MCP for AI paths, not web app

### 3. **Web App Complexity**

- Need MCP client in browser (or thin wrapper)
- Real-time updates more complex
- **Mitigation**: **DON'T use MCP for web app data layer**

### 4. **Migration Effort**

- Existing REST endpoints need conversion
- Client code needs updates
- **Mitigation**: Keep REST for web, add MCP as parallel AI interface

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

## Generative UI: Where MCP Actually Shines

There is one architectural pattern where MCP in the web app makes perfect sense: **Generative UI (GenUI)**.

### What is Generative UI?

Instead of hard-coded components fetching data from APIs, the **LLM generates the UI itself** based on user intent and available data.

```
Traditional Web App:
  User clicks "View Inventory" → Route to /beans → Fetch /api/beans → Render <InventoryTable />

Generative UI:
  User types "Show me my Ethiopian coffees sorted by roast date"
         ↓
  LLM receives prompt + MCP tools
         ↓
  LLM calls search_inventory tool via MCP
         ↓
  LLM generates: <CoffeeGrid coffees={[...]} sortBy="roast_date" highlight="Ethiopian" />
         ↓
  Frontend renders the generated component
```

**Why MCP works here**: The consumer of MCP data is still the LLM, not your JavaScript. The LLM understands the text/context format natively.

### GenUI Architecture for Purveyors.io

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GENERATIVE UI ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                         WEB APP                               │  │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     │  │
│  │  │   Static    │     │   GenUI     │     │  Component  │     │  │
│  │  │   Pages     │     │   Chat      │     │   Library   │     │  │
│  │  │  (REST)     │     │ Interface   │     │  (Render)   │     │  │
│  │  └─────────────┘     └──────┬──────┘     └──────▲──────┘     │  │
│  │                             │                   │             │  │
│  └─────────────────────────────┼───────────────────┼─────────────┘  │
│                                │                   │                │
│                                ▼                   │                │
│  ┌─────────────────────────────────────────────────┼─────────────┐  │
│  │                     SERVER                      │             │  │
│  │  ┌─────────────┐     ┌─────────────┐           │             │  │
│  │  │   Claude    │────▶│  MCP Server │           │             │  │
│  │  │   (LLM)     │     │   (Tools)   │           │             │  │
│  │  └──────┬──────┘     └─────────────┘           │             │  │
│  │         │                                       │             │  │
│  │         ▼                                       │             │  │
│  │  ┌─────────────┐                               │             │  │
│  │  │  Component  │───────────────────────────────┘             │  │
│  │  │  Generator  │  (Returns Svelte/React component code)      │  │
│  │  └─────────────┘                                             │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### How It Works: Step by Step

**1. User Input**

```
User: "Compare my last 5 roasts of the Yirgacheffe - show me a chart
       of development time vs weight loss, and highlight any outliers"
```

**2. Server Processing**

```typescript
// /api/genui/+server.ts
export async function POST({ request, locals }) {
	const { prompt } = await request.json();
	const { user } = await locals.safeGetSession();

	// Claude with MCP tools
	const response = await claude.messages.create({
		model: 'claude-sonnet-4-20250514',
		system: `You are a coffee roasting assistant with access to the user's data.
      When asked to display information, generate a Svelte component using
      the available component library. Return valid JSON with:
      - component: the component name to render
      - props: the props to pass
      - explanation: brief text explanation`,
		messages: [{ role: 'user', content: prompt }],
		tools: mcpTools // MCP tools for data access
	});

	// Claude calls MCP tools, gets data, generates component spec
	return json(response.content);
}
```

**3. LLM Tool Calls (via MCP)**

```typescript
// Claude's internal reasoning:
// 1. Call get_inventory to find Yirgacheffe
// 2. Call get_roast_profiles filtered to that coffee
// 3. Calculate statistics
// 4. Generate component specification

// MCP tool call:
{
  name: 'get_roast_profiles',
  arguments: {
    coffee_name: 'Yirgacheffe',
    limit: 5,
    include_metrics: true
  }
}

// MCP returns (text for LLM):
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      roasts: [
        { id: 1, date: '2026-01-15', dev_pct: 18.5, weight_loss: 14.2 },
        { id: 2, date: '2026-01-20', dev_pct: 19.1, weight_loss: 14.8 },
        // ...
      ]
    })
  }]
}
```

**4. LLM Generates Component Spec**

```json
{
	"component": "RoastComparisonChart",
	"props": {
		"title": "Yirgacheffe Roast Comparison",
		"data": [
			{ "date": "Jan 15", "development": 18.5, "weightLoss": 14.2, "outlier": false },
			{ "date": "Jan 20", "development": 19.1, "weightLoss": 14.8, "outlier": false },
			{ "date": "Jan 22", "development": 22.3, "weightLoss": 16.1, "outlier": true },
			{ "date": "Jan 25", "development": 18.8, "weightLoss": 14.5, "outlier": false },
			{ "date": "Jan 28", "development": 19.0, "weightLoss": 14.6, "outlier": false }
		],
		"xAxis": "date",
		"yAxes": ["development", "weightLoss"],
		"highlightOutliers": true
	},
	"explanation": "I found 5 roasts of your Yirgacheffe. The January 22nd roast shows significantly higher development (22.3%) and weight loss (16.1%) - this appears to be an outlier, possibly indicating a longer or hotter roast than usual."
}
```

**5. Frontend Renders**

```svelte
<!-- GenUIRenderer.svelte -->
<script lang="ts">
	import RoastComparisonChart from '$lib/components/charts/RoastComparisonChart.svelte';
	import CoffeeGrid from '$lib/components/CoffeeGrid.svelte';
	import InventoryTable from '$lib/components/InventoryTable.svelte';
	import ProfitSummary from '$lib/components/ProfitSummary.svelte';
	// ... all available GenUI components

	const componentMap = {
		RoastComparisonChart,
		CoffeeGrid,
		InventoryTable,
		ProfitSummary
		// ... registry of allowed components
	};

	let { componentSpec } = $props<{ componentSpec: GenUISpec }>();

	let Component = $derived(componentMap[componentSpec.component]);
</script>

{#if Component}
	<div class="genui-container">
		<p class="explanation">{componentSpec.explanation}</p>
		<svelte:component this={Component} {...componentSpec.props} />
	</div>
{:else}
	<p>Unknown component: {componentSpec.component}</p>
{/if}
```

### Component Library for GenUI

The LLM can only generate components from a **pre-defined library**. This is crucial for security and consistency.

```typescript
// /src/lib/genui/registry.ts
export const genUIComponents = {
	// Data Display
	CoffeeCard: {
		description: 'Display a single coffee with image, name, origin, and tasting notes',
		props: z.object({
			coffee: CoffeeSchema,
			showPrice: z.boolean().optional(),
			showScore: z.boolean().optional()
		})
	},

	CoffeeGrid: {
		description: 'Grid of coffee cards, good for browsing and comparison',
		props: z.object({
			coffees: z.array(CoffeeSchema),
			columns: z.number().min(1).max(4).optional(),
			sortBy: z.enum(['name', 'price', 'score', 'region']).optional()
		})
	},

	InventoryTable: {
		description: 'Tabular view of inventory with sorting and filtering',
		props: z.object({
			items: z.array(InventoryItemSchema),
			columns: z.array(z.string()).optional(),
			sortable: z.boolean().optional()
		})
	},

	// Charts
	RoastComparisonChart: {
		description: 'Compare roast profiles over time with D3 visualization',
		props: z.object({
			data: z.array(RoastMetricSchema),
			xAxis: z.string(),
			yAxes: z.array(z.string()),
			highlightOutliers: z.boolean().optional()
		})
	},

	RoastCurveChart: {
		description: 'Temperature curve visualization for a single roast',
		props: z.object({
			profileLog: z.array(ProfileLogSchema),
			showPhases: z.boolean().optional()
		})
	},

	ProfitChart: {
		description: 'Revenue and profit visualization over time',
		props: z.object({
			data: z.array(ProfitDataSchema),
			period: z.enum(['daily', 'weekly', 'monthly'])
		})
	},

	// Business
	ProfitSummary: {
		description: 'KPI cards showing revenue, costs, and margins',
		props: z.object({
			revenue: z.number(),
			costs: z.number(),
			margin: z.number(),
			period: z.string(),
			comparison: z
				.object({
					previousRevenue: z.number(),
					previousMargin: z.number()
				})
				.optional()
		})
	},

	// Interactive
	CoffeeRecommendations: {
		description: 'AI-powered coffee recommendations with explanations',
		props: z.object({
			recommendations: z.array(
				z.object({
					coffee: CoffeeSchema,
					reason: z.string(),
					confidence: z.number()
				})
			),
			basedOn: z.string()
		})
	}
};

// Generate system prompt for Claude
export function generateComponentPrompt(): string {
	return Object.entries(genUIComponents)
		.map(([name, def]) => `- ${name}: ${def.description}`)
		.join('\n');
}
```

### Security Considerations for GenUI

**1. Component Allowlist**

```typescript
// Only render known components
const allowedComponents = new Set(Object.keys(genUIComponents));

if (!allowedComponents.has(componentSpec.component)) {
	throw new Error('Unauthorized component');
}
```

**2. Props Validation**

```typescript
// Validate props against schema before rendering
const schema = genUIComponents[componentSpec.component].props;
const validatedProps = schema.parse(componentSpec.props);
```

**3. No Arbitrary Code Execution**

```typescript
// ❌ NEVER do this - executing LLM-generated code
eval(llmResponse.code);

// ✅ Only select from pre-built components
const Component = componentMap[validatedName];
```

**4. Data Sanitization**

```typescript
// Sanitize any text content from LLM
import DOMPurify from 'dompurify';
const safeExplanation = DOMPurify.sanitize(componentSpec.explanation);
```

### GenUI User Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  ☕ Purveyors.io                                    [Reed] ▼    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 💬 Ask me anything about your coffee...                   │  │
│  │                                                           │  │
│  │ "Show me my Ethiopian naturals sorted by when I bought    │  │
│  │  them, and highlight any that are running low"            │  │
│  │                                                     [Ask] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ I found 4 Ethiopian natural process coffees in your       │  │
│  │ inventory. The Guji Uraga is running low (0.5 lbs left).  │  │
│  │                                                           │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │ │ Sidamo  │ │ Yirga   │ │ Guji    │ │ Harrar  │          │  │
│  │ │ Natural │ │ cheffe  │ │ Uraga   │ │ Natural │          │  │
│  │ │         │ │ Natural │ │ ⚠️ LOW  │ │         │          │  │
│  │ │ 2.5 lbs │ │ 1.8 lbs │ │ 0.5 lbs │ │ 3.2 lbs │          │  │
│  │ │ Jan 5   │ │ Jan 12  │ │ Dec 28  │ │ Jan 20  │          │  │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │  │
│  │                                                           │  │
│  │ [🛒 Reorder Guji Uraga]  [📊 Compare Roast Profiles]     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### When to Use GenUI vs Static UI

| Use GenUI When               | Use Static UI When      |
| ---------------------------- | ----------------------- |
| Query is open-ended          | Fixed navigation paths  |
| Data needs vary by context   | Same data every time    |
| Comparisons and analysis     | Simple CRUD operations  |
| "Show me..." / "Compare..."  | "Edit my profile"       |
| Insights and recommendations | Form submissions        |
| Exploratory data discovery   | Transactional workflows |

### Implementation Phases for GenUI

**Phase 1: Chat-Only GenUI (4-6 weeks)**

- Add GenUI chat interface alongside existing pages
- Build component library (10-15 core components)
- LLM generates components in response to queries
- Existing pages remain static

**Phase 2: Hybrid Interface (4-6 weeks)**

- Add "Ask AI" button to existing pages
- Context-aware: AI knows what page you're on
- Can modify/filter current view via natural language
- Static pages remain primary navigation

**Phase 3: GenUI-Primary (6-8 weeks)**

- GenUI becomes default interface for power users
- Static pages for onboarding and simple tasks
- Full natural language interaction with all data
- Voice input support

### GenUI + MCP Integration

```typescript
// The MCP server provides tools specifically designed for GenUI
export const genUITools = {
	// Data retrieval tools (same as before)
	search_coffees: searchCoffeesTool,
	get_inventory: getInventoryTool,
	get_roast_profiles: getRoastProfilesTool,
	analyze_profitability: analyzeProfitabilityTool,

	// GenUI-specific tools
	get_component_options: {
		name: 'get_component_options',
		description: 'Get available UI components and their capabilities',
		handler: async () => ({
			content: [
				{
					type: 'text',
					text: generateComponentPrompt()
				}
			]
		})
	},

	suggest_visualization: {
		name: 'suggest_visualization',
		description: 'Given data, suggest the best component to display it',
		inputSchema: z.object({
			dataType: z.enum(['coffees', 'inventory', 'roasts', 'sales', 'metrics']),
			count: z.number(),
			userIntent: z.string()
		}),
		handler: async (params) => {
			// Logic to recommend best component
			const suggestion = suggestComponent(params);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(suggestion)
					}
				]
			};
		}
	}
};
```

### Benefits of GenUI Approach

1. **MCP Used Correctly**: LLM consumes MCP data, not browser JavaScript
2. **Natural Language Interface**: Users describe what they want, not how to get it
3. **Dynamic Dashboards**: Every user gets personalized views
4. **Reduced Development**: New queries don't require new endpoints
5. **AI-Native UX**: The platform feels intelligent, not just data-driven

### Risks and Mitigations

| Risk                            | Mitigation                                   |
| ------------------------------- | -------------------------------------------- |
| LLM generates invalid component | Strict schema validation before render       |
| Slow response times             | Streaming responses, loading states          |
| Hallucinated data               | MCP tools return real data; LLM only formats |
| Cost per interaction            | Caching, smaller models for simple queries   |
| User confusion                  | Clear affordances, fallback to static UI     |

---

## Revised Recommendation

Given the critical concerns with MCP-as-data-layer and the promise of Generative UI:

### DON'T Do:

❌ Replace REST APIs with MCP for web app data fetching
❌ Ship MCP client to browser for general data operations
❌ Use MCP tools directly from Svelte components

### DO:

✅ Keep REST/Supabase for traditional web app pages
✅ Build MCP server for external AI clients (Claude Desktop, partners)
✅ Implement GenUI chat interface where LLM calls MCP on server
✅ Use same MCP tools for both external AI and internal GenUI

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     PURVEYORS.IO                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STATIC PAGES (REST)          GENUI (MCP on server)         │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │  /catalog       │          │  /chat          │          │
│  │  /beans         │          │  AI-powered     │          │
│  │  /roast         │          │  Natural lang   │          │
│  │  /profit        │          │  Dynamic UI     │          │
│  └────────┬────────┘          └────────┬────────┘          │
│           │                            │                    │
│           ▼                            ▼                    │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │  REST APIs      │          │  Claude + MCP   │          │
│  │  (Supabase)     │          │  (Server-side)  │          │
│  └────────┬────────┘          └────────┬────────┘          │
│           │                            │                    │
│           └────────────┬───────────────┘                    │
│                        ▼                                    │
│               ┌─────────────────┐                          │
│               │    Supabase     │                          │
│               │   (Postgres)    │                          │
│               └─────────────────┘                          │
│                        ▲                                    │
│                        │                                    │
│  EXTERNAL AI ──────────┴────────────────────────────────   │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │  Claude Desktop │          │  Partner Apps   │          │
│  │  (stdio MCP)    │          │  (HTTP MCP)     │          │
│  └─────────────────┘          └─────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The original vision of "MCP-First" was flawed in its assumption that MCP could replace REST for web app data fetching. It cannot and should not.

**However**, MCP is the right choice for:

1. **External AI clients** (Claude Desktop, third-party agents)
2. **Generative UI** (LLM-powered interfaces on your server)
3. **Developer APIs** (AI-native integrations)

The revised approach:

1. **Keep REST** for traditional web pages (fast, cacheable, native)
2. **Build MCP server** for AI clients and GenUI
3. **Implement GenUI** as the innovative user experience layer
4. **Share business logic** between REST handlers and MCP tools

This positions purveyors.io as an AI-native platform while respecting the fundamental architecture of the web.

---

_Document generated: January 2026_
_Revised: January 2026 (addressing critical concerns)_
_Related: MCP-SERVER-PROPOSAL.md, API-strategy.md_
