import { json } from '@sveltejs/kit';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireAuth } from '$lib/server/auth';
import { createAdminClient } from '$lib/supabase-admin';
import type { RequestHandler } from './$types';

interface AlogMetadata {
	title: string;
	filename?: string;
	roastertype?: string;
	beans?: string;
	roastingnotes?: string;
	weight?: [number, number, string];
}

interface InventoryItem {
	id: number;
	coffee_name: string;
	origin?: string;
	processing?: string;
}

interface ClassifyRoastRequest {
	alogMetadata: AlogMetadata;
	inventory: InventoryItem[];
}

interface MatchResult {
	inventoryId: number;
	coffeeName: string;
	confidence: number;
	reasoning: string;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require auth via Bearer token (CLI sends Authorization header, not cookies)
		const user = await requireAuth(event);

		// Check member role using admin client (bypass RLS — user already validated by requireAuth)
		const adminClient = createAdminClient();
		const { data: roleData } = await adminClient
			.from('user_roles')
			.select('user_role')
			.eq('id', user.id)
			.single();
		const userRoles: string[] = (roleData?.user_role as string[]) ?? [];
		// Use hyphens to match actual DB values (api-member, api-enterprise)
		const allowed = ['member', 'admin', 'api-member', 'api-enterprise'];
		if (!userRoles.some((r) => allowed.includes(r))) {
			return json({ error: 'Member role required' }, { status: 403 });
		}

		// Validate OpenRouter API key
		if (!OPENROUTER_API_KEY) {
			console.error('OPENROUTER_API_KEY is missing or empty');
			return json({ error: 'OpenRouter API key not configured' }, { status: 500 });
		}

		// Parse request body
		const body: ClassifyRoastRequest = await event.request.json();
		const { alogMetadata, inventory } = body;

		if (!alogMetadata || !alogMetadata.title) {
			return json({ error: 'alogMetadata.title is required' }, { status: 400 });
		}

		if (!inventory || !Array.isArray(inventory)) {
			return json({ error: 'inventory must be an array' }, { status: 400 });
		}

		if (inventory.length === 0) {
			return json({ match: null });
		}

		// Build OpenRouter provider
		const openrouter = createOpenAI({
			apiKey: OPENROUTER_API_KEY,
			baseURL: 'https://openrouter.ai/api/v1',
			headers: {
				'HTTP-Referer': 'https://purveyors.io',
				'X-Title': 'Purveyors CLI Agent'
			}
		});

		// Build prompt lines conditionally to avoid blank lines for missing fields
		const promptLines: string[] = ['Roast metadata:', `Title: ${alogMetadata.title}`];
		if (alogMetadata.filename) promptLines.push(`Filename: ${alogMetadata.filename}`);
		if (alogMetadata.roastertype) promptLines.push(`Roaster: ${alogMetadata.roastertype}`);
		if (alogMetadata.beans) promptLines.push(`Bean name: ${alogMetadata.beans}`);
		if (alogMetadata.roastingnotes) promptLines.push(`Notes: ${alogMetadata.roastingnotes}`);
		if (alogMetadata.weight) {
			promptLines.push(
				`Weight: ${alogMetadata.weight[0]}${alogMetadata.weight[2]} in, ${alogMetadata.weight[1]}${alogMetadata.weight[2]} out`
			);
		}

		promptLines.push('', "User's inventory beans:");
		for (const b of inventory) {
			const origin = b.origin ? ` (${b.origin})` : '';
			const processing = b.processing ? ` [${b.processing}]` : '';
			promptLines.push(`- ID ${b.id}: ${b.coffee_name}${origin}${processing}`);
		}

		const result = await generateText({
			model: openrouter.chat('@preset/cli-agent'),
			system: `You are a coffee roast classifier. Given metadata from an Artisan .alog roast file and a list of the user's inventory beans, determine which inventory bean this roast most likely corresponds to.

MATCHING PRIORITY:
1. Filename — users typically name .alog files after the bean (e.g. "Sweet classic 3-16.alog" = Sweet/Classic bean)
2. Bean name field — explicit bean name from the .alog XML
3. Roast notes — may mention the bean
4. Title — often a generic profile name, least reliable for matching

IGNORE GENERIC/DEFAULT VALUES — these are Artisan defaults, not user data:
- Titles: "Roaster Scope", "Untitled", "Default", "Profile", "New Profile", "My Roast"
- Bean names that match the title exactly (copy-paste artifact)
- Weight "0g out" means the user didn't record output weight — don't infer from it
- Empty or placeholder notes

Focus on fields that contain specific coffee terminology (origin names, variety names, processing methods, roaster shorthand).

Respond with a JSON object containing:
- inventoryId: the ID of the best matching bean
- coffeeName: the name of the matched bean
- confidence: 0-100 confidence score
- reasoning: brief explanation of why this match was chosen

If no bean is a reasonable match (confidence below 30), respond with null.

IMPORTANT: Respond with ONLY the JSON object, no markdown formatting.`,
			prompt: promptLines.join('\n'),
			maxOutputTokens: 200,
			temperature: 0.1
		});

		const rawText = result.text.trim();

		// Parse AI response with runtime shape validation
		let match: MatchResult | null = null;

		function isValidMatchResult(obj: unknown): obj is MatchResult {
			if (typeof obj !== 'object' || obj === null) return false;
			const m = obj as Record<string, unknown>;
			return (
				typeof m.inventoryId === 'number' &&
				typeof m.coffeeName === 'string' &&
				typeof m.confidence === 'number' &&
				m.confidence >= 0 &&
				m.confidence <= 100 &&
				typeof m.reasoning === 'string'
			);
		}

		function tryParseMatch(text: string): MatchResult | null | undefined {
			try {
				const parsed = JSON.parse(text);
				if (parsed === null) return null;
				if (isValidMatchResult(parsed)) return parsed;
				console.warn('classify-roast: AI response has invalid shape:', parsed);
				return undefined; // signal parse failure
			} catch {
				return undefined;
			}
		}

		const directParse = tryParseMatch(rawText);
		if (directParse !== undefined) {
			match = directParse;
		} else {
			// Try stripping markdown code fences
			const stripped = rawText
				.replace(/^```(?:json)?\n?/, '')
				.replace(/\n?```$/, '')
				.trim();
			const strippedParse = tryParseMatch(stripped);
			if (strippedParse !== undefined) {
				match = strippedParse;
			} else {
				console.warn('classify-roast: failed to parse AI response:', rawText);
				return json({ match: null, warning: 'AI response could not be parsed' });
			}
		}

		return json({ match });
	} catch (error) {
		// Pass through rate limit errors from OpenRouter
		if (error instanceof Error && error.message.includes('429')) {
			return json({ error: 'Rate limit exceeded' }, { status: 429 });
		}

		// Auth errors (thrown by requireMemberRole) have a status property
		const authError = error as { status?: number; message?: string };
		if (authError.status === 401 || authError.status === 403) {
			return json({ error: authError.message ?? 'Unauthorized' }, { status: authError.status });
		}

		console.error('classify-roast API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
