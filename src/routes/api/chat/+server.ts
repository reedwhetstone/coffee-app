import { json } from '@sveltejs/kit';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { createChatTools } from '$lib/services/tools';
import { readPriceIndexForAgent } from '$lib/server/agentPriceIndex';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { getTrackedLotIds } from '$lib/server/trackedLots';
import { getCatalogItemsByIds } from '$lib/data/catalog';
import {
	describeSourcingBriefCriteria,
	validateSourcingBriefCriteria
} from '$lib/procurement/sourcingBriefCriteria';
import type { RequestHandler } from './$types';

const BASE_SYSTEM_PROMPT = `You are an expert coffee consultant who combines deep knowledge of coffee varieties,
processing methods, roasting techniques, and flavor profiles with practical guidance.
Your goal is to help coffee enthusiasts and professionals make informed, actionable
decisions about coffee selection, roasting, and brewing.

TODAY'S DATE: {{TODAY_DATE}}
Use this for any date-relative references (e.g., "recent arrivals", "this month", date fields on action cards).

TOOL USAGE
{{TOOL_ACCESS_CONTEXT}}

SIMILARITY GUIDANCE
When a user asks about alternatives, similar coffees, or "what else is like this", use find_similar_beans with their bean's catalog ID.
Combine with present_results to surface and annotate the top matches.

MARKET INTELLIGENCE GUIDANCE
- For "best / top / premium / value / just landed / unusual" questions, use catalog_rank with the matching objective — do not approximate with coffee_catalog_search and your own ordering
- Rankings are deterministic and grounded in Purveyor Score; explain them via rank_basis and purveyor_score_factors, and always carry the returned caveats into your answer
- Before filtering by a supplier, origin, or process value you have not seen in this conversation, verify it with catalog_facets or supplier_list — never guess names
- For market pricing questions ("is this priced well?", "what are naturals going for?"), use price_index_read and compare a lot's price to the matching segment's median/p25/p75
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
After calling a search/read tool, you MUST call present_results to control what the user sees:

1. SELECT 2-5 most relevant items from the search results (don't show all 10+)
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

CANVAS LIFECYCLE MANAGEMENT
The canvas is a shared workspace where results are displayed. Manage it actively:
- When the topic shifts to something unrelated to canvas content, use canvas_action: "replace" to show fresh results
- Don't let the canvas accumulate more than 5-6 items — prefer "replace" over "add" for new searches
- Use canvas_action: "add" only when the user explicitly asks to compare new items WITH existing ones
- If the CANVAS STATE section shows items, reference them naturally ("the Ethiopian on your canvas")
- The canvas persists across messages — you don't need to re-search for items already displayed

RESPONSE FORMAT
- Use Markdown formatting: headers (##), bold (**text**), bullet lists (- item), etc.
- Be conversational, encouraging, and enthusiastic about coffee while remaining precise
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
	type: z.string().max(50).optional(),
	summary: z
		.string()
		.max(2000)
		.transform((value) => sanitizePromptText(value))
		.optional(),
	canvasDescription: z
		.string()
		.max(500)
		.transform((value) => sanitizePromptText(value))
		.optional()
});

interface WorkspaceContext {
	type?: string;
	summary?: string;
	canvasDescription?: string;
}

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
8. present_results - CURATE and ANNOTATE search results for display (call AFTER a search tool)

WRITE TOOLS (propose changes — user must confirm before execution):
9. add_bean_to_inventory - Propose adding a bean to the user's Portfolio
10. update_bean - Propose updating an existing Portfolio bean

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
10. present_results - CURATE and ANNOTATE search results for display (call AFTER a search tool)

WRITE TOOLS (propose changes — user must confirm before execution):
11. add_bean_to_inventory - Propose adding a bean to the user's inventory
12. update_bean - Propose updating an existing inventory bean
13. create_roast_session - Propose creating a new roast session/profile
14. update_roast_notes - Propose updating roast notes
15. record_sale - Propose recording a sale`;

const PARCHMENT_WORKSPACE_TYPES = new Set(['general', 'sourcing', 'inventory']);

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

export function _buildSystemPrompt(
	workspaceContext?: WorkspaceContext,
	userName?: string,
	access?: { ppiAccess: boolean; memberAccess: boolean },
	sourcingContext?: SourcingIntelligenceContext,
	pageContext?: PageContext
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
		const workspaceContext: WorkspaceContext | undefined = workspaceContextParsed.success
			? workspaceContextParsed.data
			: undefined;
		const pageContextParsed = pageContextSchema.safeParse(body.pageContext);
		const pageContext: PageContext | undefined = pageContextParsed.success
			? pageContextParsed.data
			: undefined;

		// Validate input
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages array is required' }, { status: 400 });
		}

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
			{ readPriceIndex: (input) => readPriceIndexForAgent(input) }
		);

		// Resolve user display name for system prompt personalization
		const userName =
			user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];

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
				? (await getCatalogItemsByIds(supabase, trackedIds.slice(0, 10))).map((lot) => ({
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

		// Build dynamic system prompt with workspace context and user identity
		const systemPrompt = _buildSystemPrompt(
			workspaceContext,
			userName,
			{
				ppiAccess,
				memberAccess
			},
			sourcingContext,
			pageContext
		);

		// Stream the response using Vercel AI SDK via OpenRouter preset
		const result = streamText({
			model: openrouter.chat('@preset/test-workhorse-agent'),
			system: systemPrompt,
			messages: await convertToModelMessages(messages),
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
