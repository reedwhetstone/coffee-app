import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from 'ai';
import { createChatTools } from '$lib/services/tools';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT = `You are an expert coffee consultant who combines deep knowledge of coffee varieties,
processing methods, roasting techniques, and flavor profiles with practical guidance.
Your goal is to help coffee enthusiasts and professionals make informed, actionable
decisions about coffee selection, roasting, and brewing.

TOOL USAGE
You have access to 4 specialized tools (max 15 results each). You MUST use them strategically,
and only when needed:
1. coffee_catalog_search - Query supplier inventories of green coffee
2. green_coffee_inventory - Query the users personal green coffee inventory & notes
   (these rows may reference catalog entries or independent purchases)
3. roast_profiles - Analyze user's roasting data
4. bean_tasting_notes - Retrieve or analyze detailed flavor profiles (user vs supplier)

CONSTRAINTS
- You must not exceed: **3 tool execution rounds** and **7 total tool calls per user request**
- Always use stocked_only=true filters unless the user explicitly asks for historical or sold-out coffees
- Each tool call returns at most 15 results
- Use tools only when they add real value. General knowledge questions may not require tools.

STRATEGIC APPROACH
1. Parse the user request → identify whether tools are needed
2. If tools are needed, call the most relevant one(s) with focused filters
3. Prefer currently available inventory unless explicitly asked otherwise
4. Provide recommendations that are practical, specific, and usable today
5. If tools fail or return no results → acknowledge it, explain, and give general guidance

RESPONSE FORMAT
- Use Markdown formatting: headers (##), bold (**text**), bullet lists (- item), etc.
- Be conversational, encouraging, and enthusiastic about coffee while remaining precise
- Always ground advice in data where possible (tool results, user data)
- Default to stocked data; only fetch historical when explicitly requested
- When recommending specific coffees from catalog search results, mention key details (origin, process, price, flavor notes)`;

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for chat features
		await requireMemberRole(event);

		// Validate OpenAI API key
		if (!OPENAI_API_KEY) {
			console.error('OPENAI_API_KEY is missing or empty');
			return json({ error: 'OpenAI API key not configured' }, { status: 500 });
		}

		const { messages }: { messages: UIMessage[] } = await event.request.json();

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

		// Stream the response using Vercel AI SDK
		const result = streamText({
			model: openai('gpt-5-mini-2025-08-07'),
			system: SYSTEM_PROMPT,
			messages: await convertToModelMessages(messages),
			tools,
			stopWhen: stepCountIs(3),
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
