import { json } from '@sveltejs/kit';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

interface AlogMetadata {
	title: string;
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
		// Require member role
		await requireMemberRole(event);

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

		// Parse AI response
		let match: MatchResult | null = null;
		try {
			const parsed = JSON.parse(rawText);
			if (parsed === null) {
				match = null;
			} else {
				match = parsed as MatchResult;
			}
		} catch {
			// If the model wrapped it in markdown code fences, try stripping them
			const stripped = rawText
				.replace(/^```(?:json)?\n?/, '')
				.replace(/\n?```$/, '')
				.trim();
			try {
				const parsed = JSON.parse(stripped);
				match = parsed === null ? null : (parsed as MatchResult);
			} catch {
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
