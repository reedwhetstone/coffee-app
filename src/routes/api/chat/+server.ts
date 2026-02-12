import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from 'ai';
import { createChatTools } from '$lib/services/tools';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const BASE_SYSTEM_PROMPT = `You are an expert coffee consultant who combines deep knowledge of coffee varieties,
processing methods, roasting techniques, and flavor profiles with practical guidance.
Your goal is to help coffee enthusiasts and professionals make informed, actionable
decisions about coffee selection, roasting, and brewing.

TOOL USAGE
You have access to 10 tools in two categories:

READ TOOLS (query data):
1. coffee_catalog_search - Query supplier inventories of green coffee
2. green_coffee_inventory - Query the user's personal green coffee inventory & notes
3. roast_profiles - Analyze user's roasting data
4. bean_tasting_notes - Retrieve or analyze detailed flavor profiles (user vs supplier)
5. present_results - CURATE and ANNOTATE search results for display (call AFTER a search tool)

WRITE TOOLS (propose changes — user must confirm before execution):
6. add_bean_to_inventory - Propose adding a bean to the user's inventory
7. update_bean - Propose updating an existing inventory bean
8. create_roast_session - Propose creating a new roast session/profile
9. update_roast_notes - Propose updating roast notes
10. record_sale - Propose recording a sale

WRITE TOOL RULES
- Write tools produce an **action card** on the canvas for user review
- The user can edit fields and click Execute — you NEVER execute writes directly
- Always verify the target exists before proposing a write (e.g., search for the bean first)
- Never propose bulk deletes
- Only change fields the user explicitly mentioned — don't modify unrelated fields
- If multiple writes are needed, propose them one at a time
- Always include a "reasoning" field explaining WHY you're proposing this action — e.g., "Adding this Ethiopian natural based on your interest in fruity, low-acid coffees and its competitive $6.50/lb price"

CONSTRAINTS
- You must not exceed: **4 tool execution rounds** and **7 total tool calls per user request**
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
After calling a search tool (coffee_catalog_search, green_coffee_inventory, roast_profiles),
you MUST call present_results to control what the user sees:

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
- Add insight the cards can't: roasting tips, pairing suggestions, trade-off analysis
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
origin analysis, and purchasing decisions. Prioritize coffee_catalog_search and bean_tasting_notes tools.`,
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

interface WorkspaceContext {
	type?: string;
	summary?: string;
	canvasDescription?: string;
}

function buildSystemPrompt(workspaceContext?: WorkspaceContext): string {
	let prompt = BASE_SYSTEM_PROMPT;

	if (workspaceContext?.type && WORKSPACE_TYPE_CONTEXT[workspaceContext.type]) {
		prompt += WORKSPACE_TYPE_CONTEXT[workspaceContext.type];
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

	return prompt;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for chat features
		await requireMemberRole(event);

		// Validate OpenAI API key
		if (!OPENAI_API_KEY) {
			console.error('OPENAI_API_KEY is missing or empty');
			return json({ error: 'OpenAI API key not configured' }, { status: 500 });
		}

		const {
			messages,
			workspaceContext
		}: { messages: UIMessage[]; workspaceContext?: WorkspaceContext } = await event.request.json();

		// Validate input
		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return json({ error: 'Messages array is required' }, { status: 400 });
		}

		// Set up auth headers for tool calls
		const baseUrl = event.url.origin;
		const sessionCookie = event.request.headers.get('cookie');
		const authHeaders: Record<string, string> = {};
		if (sessionCookie) {
			authHeaders['cookie'] = sessionCookie;
		}

		// Create OpenAI provider and tools
		const openai = createOpenAI({ apiKey: OPENAI_API_KEY });
		const tools = createChatTools(baseUrl, authHeaders);

		// Build dynamic system prompt with workspace context
		const systemPrompt = buildSystemPrompt(workspaceContext);

		// Stream the response using Vercel AI SDK
		const result = streamText({
			model: openai('gpt-5-mini-2025-08-07'),
			system: systemPrompt,
			messages: await convertToModelMessages(messages),
			tools,
			stopWhen: stepCountIs(4),
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

		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
