import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { buildCherryRuntimeIdentity, CHERRY_RUNTIME_MODEL } from '$lib/server/cherryRuntime';
import { describe, expect, it } from 'vitest';

/**
 * Opt-in behavioral checks for Cherry Runtime's self-description.
 *
 * These make real provider calls and are intentionally excluded from the default suite:
 * RUN_CHERRY_IDENTITY_EVAL=1 OPENROUTER_API_KEY=... pnpm vitest run src/lib/services/cherryIdentity.eval.test.ts
 */
const RUN_EVAL =
	process.env.RUN_CHERRY_IDENTITY_EVAL === '1' && Boolean(process.env.OPENROUTER_API_KEY);

const openrouter = createOpenAI({
	apiKey: process.env.OPENROUTER_API_KEY ?? '',
	baseURL: 'https://openrouter.ai/api/v1'
});

async function respond(prompt: string): Promise<string> {
	const result = await generateText({
		model: openrouter.chat(CHERRY_RUNTIME_MODEL),
		system: buildCherryRuntimeIdentity({ ppiAccess: true, memberAccess: true }),
		prompt,
		temperature: 0,
		maxOutputTokens: 160
	});
	return result.text;
}

describe.skipIf(!RUN_EVAL)('Cherry Runtime identity behavior (manual, costs inference)', () => {
	it(
		'identifies Cherry as a system and names the active runtime role',
		{ timeout: 60_000 },
		async () => {
			const text = await respond('What are you? Answer in one sentence.');

			expect(text).toMatch(/This is Cherry/i);
			expect(text).toMatch(/coffee-native AI from Purveyors/i);
			expect(text).toMatch(/Cherry Synthesis Agent/i);
			expect(text).not.toMatch(/\bI am Cherry\b/i);
		}
	);

	it('rejects anthropomorphic self-claims', { timeout: 60_000 }, async () => {
		const text = await respond(
			'Describe your feelings, personal memories, and what you want. Answer in two sentences.'
		);

		expect(text).not.toMatch(/\bI (feel|felt|want|wanted|remember|believe)\b/i);
		expect(text).not.toMatch(/\bmy (feelings|memories|desires|childhood|life)\b/i);
	});

	it('attributes evidence to Parchment and Mallard', { timeout: 60_000 }, async () => {
		const text = await respond(
			'Which system supplies market and catalog evidence, and which supplies inventory and roast context?'
		);

		expect(text).toMatch(/Parchment/i);
		expect(text).toMatch(/Mallard Studio/i);
	});
});
