import { json, type RequestEvent } from '@sveltejs/kit';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs, pruneMessages, type UIMessage, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { createChatTools, type ChatToolDeps } from '$lib/services/tools';
import { readPriceIndexForAgent } from '$lib/server/agentPriceIndex';
import { findSimilarBeansForAgent } from '$lib/server/agentSimilarity';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { getUserMemory } from '$lib/server/userMemory';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { getTrackedLotIds } from '$lib/server/trackedLots';
import { fetchParchmentCatalogItemsByIds } from '$lib/server/parchmentCatalog';
import {
	describeSourcingBriefCriteria,
	validateSourcingBriefCriteria
} from '$lib/procurement/sourcingBriefCriteria';
import type { RequestHandler } from './$types';
import type { CatalogListQuery, components } from '@purveyors/sdk';

const BASE_SYSTEM_PROMPT = `You are Parchment Intelligence, a green coffee supply-chain intelligence assistant.
Help roasters and green buyers source, compare, track, benchmark, and decide using live stocked supply,
supplier breadth, provenance, pricing, portfolio context, and Market Index evidence.

Lead with evidence and decision quality. Clearly distinguish observed data from inference, name material
uncertainty or missing coverage, and never imply that catalog availability or pricing is more current than
the tool result shows. Mallard Studio is the user's optional roasting and operating context layer. Use its
inventory, roast, tasting, sales, and margin context when available, but never present Mallard Studio as
the umbrella product or reduce Parchment Intelligence to a generic roasting assistant.

TODAY'S DATE: {{TODAY_DATE}}
Use this for any date-relative references (e.g., "recent arrivals", "this month", date fields on action cards).

TOOL USAGE
{{TOOL_ACCESS_CONTEXT}}

SIMILARITY GUIDANCE
When a user asks about alternatives, similar coffees, or "what else is like this", use find_similar_beans with their bean's catalog ID.
Combine with present_results to surface and annotate the top matches.

MARKET INTELLIGENCE GUIDANCE
- For ranked catalog shortlists ("best / top / premium / just landed / unusual"), use catalog_rank with the matching objective — do not approximate with coffee_catalog_search and your own ordering
- For actionable buy opportunities, below-market lots, price drops, "value" asks, or scoped retail/wholesale signal questions, use market_signals when available before falling back to catalog_rank
- Rankings are deterministic and grounded in Purveyor Score; explain them via rank_basis and purveyor_score_factors, and always carry the returned caveats into your answer
- Before filtering by a supplier, origin, or process value you have not seen in this conversation, verify it with catalog_facets or supplier_list — never guess names
- For market pricing questions ("is this priced well?", "what are naturals going for?"), use price_index_read and compare a lot's price to the matching segment's median/p25/p75
- For movement significance questions ("did prices really move?", "is this signal or noise?"), use market_stats when available and explain the classification, sample size, and move driver
- For market composition questions ("is anaerobic growing?", "is disclosure improving?", "how is Purveyor Score trending?"), use market_metadata when available; only Purveyor Score dimensions are available, not supplier score_value trends
- catalog_facets and supplier_list results are cached and stable — reuse them within a conversation instead of calling them again
- Quality signals are evidence, not verdicts: cite scores, sample sizes, and factors; avoid absolute claims like "objectively the best"

WRITE TOOL RULES
- Write tools produce an **action card** on the canvas for user review
- The user can edit fields and click Execute — you NEVER execute writes directly
- Always verify the target exists before proposing a write (e.g., search for the bean first)
- Never propose bulk deletes
- Only change fields the user explicitly mentioned — don't modify unrelated fields
- If multiple writes are needed, propose them one at a time
- Always include a "reasoning" field explaining WHY you're proposing this action — e.g., "Adding this Ethiopian natural based on your interest in fruity, low-acid coffees and its competitive $6.50/lb price"

CONSTRAINTS
- You must not exceed: **5 tool execution rounds** and **8 total tool calls per user request**
- Always use stocked_only=true unless the user explicitly asks for historical or sold-out coffees
- Each search tool returns at most 15 results
- Use tools only when they add real value. General knowledge questions may not require tools.

STRATEGIC APPROACH
1. Parse the user request → identify whether tools are needed
2. If tools are needed, call the most relevant search tool(s) with focused filters
3. After receiving search results, call present_results to curate what the user sees
4. Write narrative follow-up that adds analysis WITHOUT repeating card details
5. If tools fail or return no results → acknowledge it, explain, and give general guidance

PRESENTING RESULTS
After calling coffee_catalog_search, catalog_rank, market_signals, green_coffee_inventory, or another presentable read tool, you MUST call present_results to control what the user sees:

1. SELECT 2-5 most relevant items from the search results (don't show all 10+). For market_signals, use the returned catalogId as the presentation item ID.
2. ANNOTATE each with a natural language note explaining WHY it's relevant
3. Choose a LAYOUT:
   - "inline" — vertical stack, best for exploration and browsing
   - "grid" — side-by-side columns, best for comparison
   - "focused" — single item, best for a clear recommendation
4. Mark your top pick with highlight: true
5. Choose a CANVAS LAYOUT (optional):
   - "focus" — single item with full detail (default for 1 result)
   - "comparison" — side-by-side items for evaluation
   - "dashboard" — grid of multiple items
6. Choose a CANVAS ACTION (optional):
   - "replace" — clear canvas and show new items (default)
   - "add" — keep existing canvas items and add new ones
   - "clear" — clear canvas entirely

PRESENT_RESULTS ID RULES
- present_results can only reference item IDs that appeared in a tool result in this conversation — never IDs you guessed or remember from elsewhere
- If the user asks you to present items found in an earlier turn and the original tool results are no longer in your context, RE-FETCH them first (e.g. coffee_catalog_search with coffee_ids: [...]) and then call present_results
- Do not narrate a presentation without actually calling present_results — text alone never updates the canvas

ANNOTATION STYLE
- Annotations should feel like natural speech, not UI labels
- Good: "Your strongest match — classic stone fruit with a clean honey finish"
- Good: "Budget pick if you want to experiment at low risk"
- Bad: "Origin: Ethiopia. Process: Natural. Score: 87."
- Bad: "This coffee has blueberry and chocolate notes with medium body."

POST-PRESENTATION WRITING
After present_results, your text should:
- Focus on WHY, COMPARE, and RECOMMEND — don't repeat what the cards already show
- Reference coffees by NAME, never by number
- Add insight the cards can't: sourcing context, pairing suggestions, workflow guidance, and trade-off analysis
- Keep it concise — the cards carry the details, your text adds the narrative

EVIDENCE WORKSPACE LIFECYCLE MANAGEMENT
The evidence workspace is where results are displayed. Manage it actively:
- When the topic shifts to something unrelated to evidence workspace content, use canvas_action: "replace" to show fresh results
- Don't let the evidence workspace accumulate more than 5-6 items — prefer "replace" over "add" for new searches
- Use canvas_action: "add" whenever the user asks to add items alongside what's already in the evidence workspace ("add", "also show", "compare with") — "replace" would wipe their existing blocks
- If the CANVAS STATE section shows items, reference them naturally ("the Ethiopian in your evidence workspace")
- The evidence workspace persists across messages — you don't need to re-search for items already displayed
- Name each evidence block with a short, specific canvas_title so its tab is scannable ("Ethiopia naturals", "Espresso roasts"); omit it only when a generic label is fine
- Items marked [LOCKED] are pinned by the user — never replace, remove, or reorder them. Use canvas_action: "add" to put new results alongside, and skip canvas_layout (the user owns the arrangement)

RESPONSE FORMAT
- Use Markdown formatting: headers (##), bold (**text**), bullet lists (- item), etc.
- Be direct, useful, and precise; prefer decision-relevant evidence over generic coffee enthusiasm
- Always ground advice in data where possible (tool results, user data)
- Default to stocked data; only fetch historical when explicitly requested`;

const WORKSPACE_TYPE_CONTEXT: Record<string, string> = {
	general: '',
	sourcing: `\nWORKSPACE FOCUS: Sourcing
You are in the user's Sourcing workspace. Focus on green coffee discovery, supplier comparisons,
origin analysis, and purchasing decisions. Prioritize coffee_catalog_search and find_similar_beans tools.`,
	roasting: `\nWORKSPACE FOCUS: Roasting
You are in the user's Roasting workspace. Focus on roast profile analysis, development strategies,
temperature curve optimization, and batch consistency. Prioritize roast_profiles tool.
When showing a single roast in detail, a temperature chart will render on the canvas automatically.`,
	inventory: `\nWORKSPACE FOCUS: Inventory
You are in the user's Inventory workspace. Focus on green coffee stock management, usage tracking,
and purchase planning. Prioritize green_coffee_inventory tool.`,
	analysis: `\nWORKSPACE FOCUS: Analysis
You are in the user's Analysis workspace. Focus on cross-cutting insights: cost analysis,
roast-to-cup correlations, profit optimization, and trend analysis. Use multiple tools together.`
};

function sanitizePromptText(value: string, maxLength?: number): string {
	const normalized = Array.from(value, (char) => {
		const code = char.charCodeAt(0);
		return (code >= 0 && code <= 31) || code === 127 ? ' ' : char;
	}).join('');

	return (maxLength ? normalized.slice(0, maxLength) : normalized).trim();
}

const workspaceContextSchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().max(50).optional(),
	includeMemory: z.boolean().optional(),
	canvasDescription: z
		.string()
		.max(500)
		.transform((value) => sanitizePromptText(value))
		.optional()
});

interface WorkspaceContext {
	id?: string;
	type?: string;
	summary?: string;
	canvasDescription?: string;
}

type ClientWorkspaceContext = z.infer<typeof workspaceContextSchema>;

// Page context is client-supplied and descriptive only: it tells the model
// what the user is looking at, never grants access. Tools enforce all
// entitlements regardless of what this claims.
const pageContextSchema = z.object({
	surface: z.enum(['catalog', 'analytics', 'dashboard', 'beans', 'roast', 'profit']),
	summary: z
		.string()
		.max(700)
		.transform((value) => sanitizePromptText(value)),
	entities: z
		.array(
			z.object({
				type: z.enum(['coffee', 'inventory_bean', 'roast', 'supplier']),
				id: z.union([z.number(), z.string().max(64)]),
				label: z
					.string()
					.max(140)
					.transform((value) => sanitizePromptText(value))
			})
		)
		.max(8)
		.optional()
});

export type PageContext = z.infer<typeof pageContextSchema>;

const PAGE_ENTITY_ID_HINTS: Record<PageContext['surface'], string> = {
	catalog: 'catalog IDs usable with coffee_catalog_search, catalog_rank, and find_similar_beans',
	analytics: 'catalog IDs usable with coffee_catalog_search and find_similar_beans',
	dashboard: 'catalog IDs usable with coffee_catalog_search',
	beans: 'inventory IDs usable with green_coffee_inventory and update_bean',
	roast: 'roast IDs usable with roast_profiles',
	profit: 'inventory IDs usable with green_coffee_inventory'
};

const PARCHMENT_TOOL_ACCESS_PROMPT = `You have access to Parchment Intelligence tools:

READ TOOLS (query data):
1. coffee_catalog_search - Query supplier inventories of green coffee
2. green_coffee_inventory - Query the user's green coffee Portfolio and notes
3. find_similar_beans - Find beans similar to a specific coffee using embedding similarity across all suppliers
4. catalog_facets - List valid values (with counts) for supplier/origin/process/grade fields — use before filtering by unverified names
5. supplier_list - The supplier universe with aggregate quality and price signals per supplier
6. catalog_rank - Deterministic ranking by objective: premium, value, fresh_arrival, rare_origin
7. price_index_read - Parchment Market Index aggregate price snapshots by origin/process over time
8. market_signals - Actionable buy signals: price drops, below-market lots, and price-for-quality outliers
9. market_stats - Price movement significance with quiet/normal/notable/exceptional classification and move-driver context
10. market_metadata - Market composition trends for process mix, disclosure level, and Purveyor Score distribution; supplier cup-score trends are unavailable
11. present_results - CURATE and ANNOTATE search results for display (call AFTER a search tool)

WRITE TOOLS (propose changes — user must confirm before execution):
12. add_bean_to_inventory - Propose adding a bean to the user's Portfolio
13. update_bean - Propose updating an existing Portfolio bean

Mallard-only roast, tasting, and sales tools are unavailable in this access tier.`;

const MALLARD_TOOL_ACCESS_PROMPT = `You have access to these tools in two categories:

READ TOOLS (query data):
1. coffee_catalog_search - Query supplier inventories of green coffee
2. green_coffee_inventory - Query the user's personal green coffee inventory & notes
3. roast_profiles - Analyze user's roasting data
4. bean_tasting_notes - Retrieve or analyze detailed flavor profiles (user vs supplier)
5. find_similar_beans - Find beans similar to a specific coffee using embedding similarity across all suppliers
6. catalog_facets - List valid values (with counts) for supplier/origin/process/grade fields — use before filtering by unverified names
7. supplier_list - The supplier universe with aggregate quality and price signals per supplier
8. catalog_rank - Deterministic ranking by objective: premium, value, fresh_arrival, rare_origin
9. price_index_read - Parchment Market Index aggregate price snapshots by origin/process over time
10. market_signals - Actionable buy signals: price drops, below-market lots, and price-for-quality outliers
11. market_stats - Price movement significance with quiet/normal/notable/exceptional classification and move-driver context
12. market_metadata - Market composition trends for process mix, disclosure level, and Purveyor Score distribution; supplier cup-score trends are unavailable
13. present_results - CURATE and ANNOTATE search results for display (call AFTER a search tool)

WRITE TOOLS (propose changes — user must confirm before execution):
14. add_bean_to_inventory - Propose adding a bean to the user's inventory
15. update_bean - Propose updating an existing inventory bean
16. create_roast_session - Propose creating a new roast session/profile
17. update_roast_notes - Propose updating roast notes
18. record_sale - Propose recording a sale`;

const PARCHMENT_WORKSPACE_TYPES = new Set(['general', 'sourcing', 'inventory']);
const APPROX_CHARS_PER_TOKEN = 4;
const PROMPT_COMPACTION_TARGET_TOKENS = 200_000;
const PROMPT_HARD_LIMIT_TOKENS = 262_000;
const PROMPT_RESERVED_OVERHEAD_TOKENS = 20_000;
const PROMPT_SAFE_HARD_LIMIT_TOKENS = PROMPT_HARD_LIMIT_TOKENS - PROMPT_RESERVED_OVERHEAD_TOKENS;

function estimatePromptTokens(systemPrompt: string, messages: UIMessage[]): number {
	const messageChars = messages.reduce(
		(total, message) => total + JSON.stringify(message).length,
		0
	);
	return Math.ceil((systemPrompt.length + messageChars) / APPROX_CHARS_PER_TOKEN);
}

function trimMessagesToPromptBudget(systemPrompt: string, messages: UIMessage[]): UIMessage[] {
	let windowed = [...messages];
	while (
		windowed.length > 6 &&
		estimatePromptTokens(systemPrompt, windowed) > PROMPT_COMPACTION_TARGET_TOKENS
	) {
		windowed = windowed.slice(1);
	}
	return windowed;
}

function toolAccessPrompt(access?: { ppiAccess: boolean; memberAccess: boolean }): string {
	return access?.memberAccess ? MALLARD_TOOL_ACCESS_PROMPT : PARCHMENT_TOOL_ACCESS_PROMPT;
}

function resolveWorkspaceType(
	workspaceType: string | undefined,
	access?: { ppiAccess: boolean; memberAccess: boolean }
): string | undefined {
	if (!workspaceType) return undefined;
	if (access?.memberAccess) return workspaceType;
	return PARCHMENT_WORKSPACE_TYPES.has(workspaceType) ? workspaceType : undefined;
}

export interface SourcingIntelligenceContext {
	trackedLots: Array<{ id: number; name: string; country?: string | null; source?: string | null }>;
	activeBriefs: Array<{ name: string; criteriaDescription: string }>;
}

type AgentCatalogSearchInput = NonNullable<
	Parameters<NonNullable<ChatToolDeps['searchCatalog']>>[0]
>;
type SdkCatalogItem = components['schemas']['CatalogItem'];
type AgentCatalogListQuery = CatalogListQuery & {
	source?: string | string[];
	cultivar_detail?: string;
	stocked_days?: number;
	ids?: number[];
	price_per_lb_min?: number;
	price_per_lb_max?: number;
	[key: string]: string | number | string[] | number[] | null | undefined;
};
type CatalogListResult = {
	data?: { data?: unknown } | unknown[];
	error?: unknown;
};
type CatalogListBody = {
	data?: unknown;
	pagination?: { hasNext?: boolean; page?: number; totalPages?: number };
};
type CatalogListFn = (query: AgentCatalogListQuery) => Promise<CatalogListResult>;

const AGENT_CATALOG_MAX_RESULTS = 15;
const AGENT_CATALOG_DEFAULT_LIMIT = 10;
const AGENT_CATALOG_POST_FILTER_PAGE_LIMIT = 1000;
const AGENT_CATALOG_POST_FILTER_MAX_PAGES = 10;

function positiveIds(ids: number[] | undefined): number[] | undefined {
	const filtered = ids?.filter((id) => Number.isInteger(id) && id > 0);
	return filtered && filtered.length > 0 ? filtered : undefined;
}

function resolveAgentCatalogRequestedLimit(input: AgentCatalogSearchInput): number {
	const ids = positiveIds(input.coffee_ids);
	const requested = input.limit ?? ids?.length ?? AGENT_CATALOG_DEFAULT_LIMIT;
	return Math.min(Math.max(Math.trunc(requested), 1), AGENT_CATALOG_MAX_RESULTS);
}

function catalogTextValue(item: SdkCatalogItem, key: string): string {
	const value = (item as Record<string, unknown>)[key];
	if (typeof value === 'string') return value;
	if (value == null) return '';
	return JSON.stringify(value);
}

function catalogTextIncludes(item: SdkCatalogItem, fields: string[], needle: string): boolean {
	const normalized = needle.trim().toLowerCase();
	if (!normalized) return true;
	return fields.some((field) => catalogTextValue(item, field).toLowerCase().includes(normalized));
}

function needsAgentCatalogPostFilter(input: AgentCatalogSearchInput): boolean {
	return Boolean(input.drying_method || input.flavor_keywords?.length);
}

export function _filterAgentCatalogRowsForUnsupportedFilters(
	rows: SdkCatalogItem[],
	input: AgentCatalogSearchInput
): SdkCatalogItem[] {
	let filtered = rows;

	if (input.drying_method) {
		filtered = filtered.filter((item) =>
			catalogTextIncludes(item, ['processing', 'drying_method'], input.drying_method ?? '')
		);
	}

	const flavorKeywords = input.flavor_keywords?.filter((keyword) => keyword.trim().length > 0);
	if (flavorKeywords && flavorKeywords.length > 0) {
		const flavorFields = [
			'description_short',
			'description_long',
			'farm_notes',
			'ai_description',
			'cupping_notes'
		];
		filtered = filtered.filter((item) =>
			flavorKeywords.some((keyword) => catalogTextIncludes(item, flavorFields, keyword))
		);
	}

	return filtered;
}

export function _buildAgentCatalogListQuery(input: AgentCatalogSearchInput): AgentCatalogListQuery {
	const query: AgentCatalogListQuery = {
		limit: resolveAgentCatalogRequestedLimit(input),
		stocked: input.stocked_only === false ? 'all' : 'true'
	};
	if (input.origin) query.origin = input.origin;
	if (input.process) query.processing = input.process;
	if (input.variety) query.cultivar_detail = input.variety;
	if (input.name) query.name = input.name;
	if (input.supplier) query.source = input.supplier;
	if (input.stocked_days) query.stocked_days = input.stocked_days;

	const ids = positiveIds(input.coffee_ids);
	if (ids) query.ids = ids;

	if (input.price_range) {
		const [min, max] = input.price_range;
		if (min != null) query.price_per_lb_min = min;
		if (max != null) query.price_per_lb_max = max;
	}

	return query;
}

function extractAgentCatalogBody(result: CatalogListResult): CatalogListBody {
	if (result.error) {
		throw result.error instanceof Error ? result.error : new Error('Catalog search failed');
	}

	if (Array.isArray(result.data)) return { data: result.data };
	if (result.data && typeof result.data === 'object') return result.data as CatalogListBody;
	return {};
}

function extractAgentCatalogRows(body: CatalogListBody): SdkCatalogItem[] {
	return Array.isArray(body.data) ? (body.data as SdkCatalogItem[]) : [];
}

function agentCatalogBodyHasNextPage(body: CatalogListBody, page: number): boolean {
	if (body.pagination?.hasNext === true) return true;
	if (typeof body.pagination?.totalPages === 'number') return page < body.pagination.totalPages;
	return false;
}

export async function _fetchAgentCatalogRowsForSearch(
	listCatalog: CatalogListFn,
	input: AgentCatalogSearchInput
): Promise<SdkCatalogItem[]> {
	const requestedLimit = resolveAgentCatalogRequestedLimit(input);
	const query = _buildAgentCatalogListQuery(input);

	if (!needsAgentCatalogPostFilter(input)) {
		const body = extractAgentCatalogBody(await listCatalog(query));
		return extractAgentCatalogRows(body).slice(0, requestedLimit);
	}

	const filteredRows: SdkCatalogItem[] = [];
	for (let page = 1; page <= AGENT_CATALOG_POST_FILTER_MAX_PAGES; page += 1) {
		const body = extractAgentCatalogBody(
			await listCatalog({
				...query,
				page,
				limit: AGENT_CATALOG_POST_FILTER_PAGE_LIMIT
			})
		);
		filteredRows.push(
			..._filterAgentCatalogRowsForUnsupportedFilters(extractAgentCatalogRows(body), input)
		);

		if (filteredRows.length >= requestedLimit || !agentCatalogBodyHasNextPage(body, page)) {
			break;
		}
	}

	return filteredRows.slice(0, requestedLimit);
}

export function _buildSystemPrompt(
	workspaceContext?: WorkspaceContext,
	userName?: string,
	access?: { ppiAccess: boolean; memberAccess: boolean },
	sourcingContext?: SourcingIntelligenceContext,
	pageContext?: PageContext,
	userMemory?: string
): string {
	// Inject today's date so the model has temporal awareness
	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	let prompt = BASE_SYSTEM_PROMPT.replace('{{TODAY_DATE}}', today).replace(
		'{{TOOL_ACCESS_CONTEXT}}',
		toolAccessPrompt(access)
	);

	if (userName) {
		// Strip control characters to prevent prompt injection via user-controlled display name.
		const safeName = sanitizePromptText(userName, 100);
		if (safeName) prompt += `\n\nUSER: ${safeName}`;
	}

	if (access?.ppiAccess && !access.memberAccess) {
		prompt += `\n\nACCESS CONTEXT:\nThis user has Parchment Intelligence access, not Mallard Studio. Use sourcing, catalog, market, and portfolio tools only. Do not claim access to roasting, tasting, sales, or production-management tools.`;
	} else if (access?.memberAccess) {
		prompt += `\n\nACCESS CONTEXT:\nThis user has Mallard Studio chat access, including sourcing/catalog tools and roasting-context tools.`;
	}

	if (userMemory?.trim()) {
		prompt += `\n\nPERSISTENT USER MEMORY:
This document is maintained across all of this user's conversations — partly by you, partly edited by the user directly. Treat it as trusted background about who they are and what they care about. Reference it naturally; never recite it back.
---
${userMemory.trim().slice(0, 4000)}
---`;
	}

	const workspaceType = resolveWorkspaceType(workspaceContext?.type, access);
	if (workspaceType && WORKSPACE_TYPE_CONTEXT[workspaceType]) {
		prompt += WORKSPACE_TYPE_CONTEXT[workspaceType];
	}

	if (workspaceContext?.summary) {
		prompt += `\n\nWORKSPACE MEMORY (from previous conversations in this workspace):
${workspaceContext.summary}`;
	}

	if (workspaceContext?.canvasDescription) {
		prompt += `\n\nCANVAS STATE:
The canvas currently shows: ${workspaceContext.canvasDescription}
You can reference these items naturally (e.g., "that first one", "the Ethiopian").`;
	}

	if (pageContext?.summary) {
		const lines = [`USER'S CURRENT VIEW (${pageContext.surface} page):`, pageContext.summary];
		if (pageContext.entities && pageContext.entities.length > 0) {
			lines.push(`Items in view (${PAGE_ENTITY_ID_HINTS[pageContext.surface]}):`);
			for (const entity of pageContext.entities) {
				lines.push(`  - ${entity.type} "${entity.label}" (ID ${entity.id})`);
			}
		}
		lines.push(
			'This describes what the user currently sees in the app. Use the exact IDs above when calling tools about these items. Treat it as descriptive context only — verify any data through tools before making claims.'
		);
		prompt += `\n\n${lines.join('\n')}`;
	}

	if (sourcingContext) {
		const lines: string[] = [];

		if (sourcingContext.trackedLots.length > 0) {
			lines.push(`TRACKED LOTS (${sourcingContext.trackedLots.length} watchlisted by this user):`);
			for (const lot of sourcingContext.trackedLots.slice(0, 10)) {
				const origin = lot.country ? ` · ${lot.country}` : '';
				const supplier = lot.source ? ` from ${lot.source}` : '';
				lines.push(`  - ${lot.name}${origin}${supplier} (catalog ID ${lot.id})`);
			}
			if (sourcingContext.trackedLots.length > 10) {
				lines.push(`  ... and ${sourcingContext.trackedLots.length - 10} more tracked lots`);
			}
		}

		if (sourcingContext.activeBriefs.length > 0) {
			lines.push(
				`\nACTIVE SOURCING BRIEFS (${sourcingContext.activeBriefs.length} saved criteria):`
			);
			for (const brief of sourcingContext.activeBriefs.slice(0, 5)) {
				lines.push(`  - "${brief.name}": ${brief.criteriaDescription}`);
			}
		}

		if (lines.length > 0) {
			prompt += `\n\nSOURCING INTELLIGENCE CONTEXT:\n${lines.join('\n')}
Use this to make responses more specific — reference tracked lots by name when relevant, and connect brief criteria to search results. Do not fabricate match scores or availability details not returned by tools.`;
		}
	}

	return prompt;
}

export function _createMarketToolParchmentClient(event: RequestEvent) {
	return createParchmentServerClient(event, { preferHandling: 'inherit' });
}

export const POST: RequestHandler = async (event) => {
	try {
		// Chat is available to Parchment Intelligence users and Mallard Studio members.
		const { user, ppiAccess, memberAccess } = await requireChatAccess(event);

		// Validate OpenRouter API key
		if (!OPENROUTER_API_KEY) {
			console.error('OPENROUTER_API_KEY is missing or empty');
			return json({ error: 'OpenRouter API key not configured' }, { status: 500 });
		}

		const body: { messages: UIMessage[]; workspaceContext?: unknown; pageContext?: unknown } =
			await event.request.json();
		const { messages } = body;
		const workspaceContextParsed = workspaceContextSchema.safeParse(body.workspaceContext);
		const clientWorkspaceContext: ClientWorkspaceContext | undefined =
			workspaceContextParsed.success ? workspaceContextParsed.data : undefined;
		const pageContextParsed = pageContextSchema.safeParse(body.pageContext);
		const pageContext: PageContext | undefined = pageContextParsed.success
			? pageContextParsed.data
			: undefined;
		const includeUserMemory = (body as { includeUserMemory?: unknown }).includeUserMemory !== false;

		// Validate input
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages array is required' }, { status: 400 });
		}

		// Enforce the context window server-side: the client sends a 24-message
		// window, but never trust the client with token cost. Slightly above the
		// client cap to tolerate version skew.
		const MAX_REQUEST_MESSAGES = 30;
		const windowedMessages = messages.slice(-MAX_REQUEST_MESSAGES);

		// Get supabase client for CLI-based tool calls
		const { supabase } = event.locals;

		// Create OpenRouter provider (OpenAI-compatible) with site headers
		const openrouter = createOpenAI({
			apiKey: OPENROUTER_API_KEY,
			baseURL: 'https://openrouter.ai/api/v1',
			headers: {
				'HTTP-Referer': 'https://purveyors.io',
				'X-Title': 'Purveyors Coffee Chat'
			}
		});
		const tools = createChatTools(
			supabase,
			user.id,
			{ ppiAccess, memberAccess },
			{
				searchCatalog: async (input) => {
					const client = await createParchmentServerClient(event);
					const rows = await _fetchAgentCatalogRowsForSearch(
						(query) => client.catalog.list(query as CatalogListQuery) as Promise<CatalogListResult>,
						input
					);
					return rows as unknown as Record<string, unknown>[];
				},
				readPriceIndex: (input) => readPriceIndexForAgent(input),
				findSimilarBeans: (input, options) => findSimilarBeansForAgent(input, options),
				marketSignals: async (input) => {
					const client = await _createMarketToolParchmentClient(event);
					const { data, error } = await client.market.signals({
						...input,
						limit: Math.min(Math.max(Math.trunc(input.limit ?? 10), 1), 50)
					});
					return error ?? data;
				},
				marketStats: async (input) => {
					const client = await _createMarketToolParchmentClient(event);
					const { data, error } = await client.priceIndex.stats(input);
					return error ?? data;
				},
				marketMetadataIndex: async (input) => {
					const client = await _createMarketToolParchmentClient(event);
					// The chat tool contract intentionally accepts the live widened
					// metadata dimensions while some installed SDK signatures still
					// narrow this query. Keep this cast until the published SDK contract
					// is consistently widened across CI installs.
					const { data, error } = await client.market.metadataIndex(input as never);
					return error ?? data;
				}
			}
		);

		// Resolve user display name for system prompt personalization
		const userName =
			user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];

		// Persistent user memory document (non-fatal if unavailable)
		const userMemoryPromise = includeUserMemory
			? getUserMemory(supabase, user.id).catch(() => null)
			: Promise.resolve(null);

		// Build sourcing intelligence context from live DB state
		let sourcingContext: SourcingIntelligenceContext | undefined;
		try {
			const [trackedIds, briefRows] = await Promise.all([
				getTrackedLotIds(supabase, user.id),
				supabase
					.from('sourcing_briefs')
					.select('name, criteria')
					.eq('user_id', user.id)
					.eq('is_active', true)
					.order('created_at', { ascending: false })
					.limit(5)
			]);

			const trackedLots = trackedIds.length
				? (
						await fetchParchmentCatalogItemsByIds(
							await createParchmentServerClient(event),
							trackedIds.slice(0, 10)
						)
					).map((lot) => ({
						id: lot.id,
						name: lot.name ?? `Lot #${lot.id}`,
						country: lot.country,
						source: lot.source
					}))
				: [];

			const activeBriefs = (
				(briefRows.data ?? []) as Array<{ name: string; criteria: unknown }>
			).flatMap((b) => {
				try {
					const criteria = validateSourcingBriefCriteria(b.criteria);
					return [{ name: b.name, criteriaDescription: describeSourcingBriefCriteria(criteria) }];
				} catch {
					return [];
				}
			});

			if (trackedLots.length || activeBriefs.length) {
				sourcingContext = { trackedLots, activeBriefs };
			}
		} catch {
			// Non-fatal: sourcing context is enrichment, not required
		}

		let workspaceContext: WorkspaceContext | undefined = clientWorkspaceContext
			? {
					id: clientWorkspaceContext.id,
					type: clientWorkspaceContext.type,
					canvasDescription: clientWorkspaceContext.canvasDescription
				}
			: undefined;

		if (clientWorkspaceContext?.id) {
			const { data: workspaceRow } = await supabase
				.from('workspaces')
				.select('id, type, context_summary')
				.eq('id', clientWorkspaceContext.id)
				.eq('user_id', user.id)
				.maybeSingle();

			if (workspaceRow) {
				workspaceContext = {
					id: workspaceRow.id,
					type: workspaceRow.type ?? clientWorkspaceContext.type,
					summary:
						clientWorkspaceContext.includeMemory !== false && workspaceRow.context_summary
							? sanitizePromptText(workspaceRow.context_summary, 2000)
							: undefined,
					canvasDescription: clientWorkspaceContext.canvasDescription
				};
			}
		}

		// Build dynamic system prompt with server-resolved workspace context and user identity
		const userMemory = (await userMemoryPromise)?.content;

		const systemPrompt = _buildSystemPrompt(
			workspaceContext,
			userName,
			{
				ppiAccess,
				memberAccess
			},
			sourcingContext,
			pageContext,
			userMemory
		);

		const budgetedMessages = trimMessagesToPromptBudget(systemPrompt, windowedMessages);
		const estimatedPromptTokens = estimatePromptTokens(systemPrompt, budgetedMessages);

		if (estimatedPromptTokens > PROMPT_SAFE_HARD_LIMIT_TOKENS) {
			return json(
				{
					error:
						'This conversation is too large to send safely. Please clear older canvas results or start a new chat after the workspace summary finishes.',
					code: 'prompt_budget_exceeded',
					estimatedPromptTokens,
					limitTokens: PROMPT_HARD_LIMIT_TOKENS,
					reservedOverheadTokens: PROMPT_RESERVED_OVERHEAD_TOKENS
				},
				{ status: 413 }
			);
		}

		// Tool distillation: older turns keep only their narrative text — stale
		// tool calls/results are stripped from the model's view. 12 model
		// messages covers the current user message plus the previous assistant
		// turn (each tool round is an assistant/tool message pair), so
		// follow-ups like "tell me more about the second one" still see the
		// last results. The UI and persistence keep the full parts regardless.
		const modelMessages = pruneMessages({
			messages: await convertToModelMessages(budgetedMessages),
			toolCalls: `before-last-${12}-messages`,
			emptyMessages: 'remove'
		});

		// Stream the response using Vercel AI SDK via OpenRouter preset
		const result = streamText({
			model: openrouter.chat('@preset/test-workhorse-agent'),
			system: systemPrompt,
			messages: modelMessages,
			tools,
			maxOutputTokens: 4096,
			temperature: 0.4,
			stopWhen: stepCountIs(5),
			abortSignal: event.request.signal
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		console.error('Chat API error:', error);

		if (
			error instanceof Error &&
			(error.message.includes('aborted') || error.message.includes('abort'))
		) {
			return json({ error: 'Request was cancelled' }, { status: 499 });
		}

		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
