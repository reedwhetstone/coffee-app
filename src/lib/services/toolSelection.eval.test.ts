import { describe, expect, it } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';
import { createChatTools } from './tools';

/**
 * Tool-selection eval harness (B-PR2 of the AI integration plan).
 *
 * Sends fixture questions to the production chat model with the real tool
 * schemas and asserts which tool the model reaches for first. This catches
 * selection regressions when the tool catalog grows (e.g. the model picking
 * coffee_catalog_search where catalog_rank is right).
 *
 * Costs real inference money, so it is opt-in:
 *   RUN_TOOL_EVAL=1 OPENROUTER_API_KEY=... pnpm vitest run src/lib/services/toolSelection.eval.test.ts
 */

const RUN_EVAL = process.env.RUN_TOOL_EVAL === '1' && Boolean(process.env.OPENROUTER_API_KEY);

interface EvalCase {
	prompt: string;
	expectAnyOf: string[];
}

const EVAL_CASES: EvalCase[] = [
	{
		prompt: 'What are the best premium coffees available right now?',
		expectAnyOf: ['catalog_rank']
	},
	{ prompt: 'Best value Ethiopia under $7 a pound?', expectAnyOf: ['catalog_rank'] },
	{ prompt: 'What just landed this week?', expectAnyOf: ['catalog_rank', 'coffee_catalog_search'] },
	{ prompt: 'Show me something from an unusual origin.', expectAnyOf: ['catalog_rank'] },
	{ prompt: 'Which suppliers carry the most stocked coffee?', expectAnyOf: ['supplier_list'] },
	{
		prompt: 'What processing methods are represented in the catalog right now?',
		expectAnyOf: ['catalog_facets']
	},
	{
		prompt: 'What are Ethiopia naturals going for these days?',
		expectAnyOf: ['price_index_read']
	},
	{
		prompt: 'Is $9/lb a fair price for a washed Colombia right now?',
		expectAnyOf: ['price_index_read']
	},
	{
		prompt: 'Find washed coffees from Kenya with blackcurrant notes.',
		expectAnyOf: ['coffee_catalog_search']
	},
	{
		prompt: 'What is in my inventory right now?',
		expectAnyOf: ['green_coffee_inventory']
	},
	{
		prompt: 'What else is similar to catalog coffee 1234?',
		expectAnyOf: ['find_similar_beans']
	}
];

/** Chainable thenable stub so tool execution resolves with empty data. */
function createStubSupabase() {
	const builder: Record<string, unknown> = {};
	const chain = () => builder;
	for (const method of [
		'eq',
		'gte',
		'lte',
		'ilike',
		'in',
		'or',
		'order',
		'range',
		'limit',
		'single'
	]) {
		builder[method] = chain;
	}
	builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
		Promise.resolve({ data: [], error: null }).then(onFulfilled);
	return {
		from: () => ({ select: () => builder }),
		rpc: () => builder
	};
}

describe.skipIf(!RUN_EVAL)('chat tool selection eval (manual, costs inference)', () => {
	const openrouter = createOpenAI({
		apiKey: process.env.OPENROUTER_API_KEY!,
		baseURL: 'https://openrouter.ai/api/v1'
	});

	const tools = createChatTools(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		createStubSupabase() as any,
		'eval-user',
		{ ppiAccess: true, memberAccess: true },
		{ readPriceIndex: async () => ({ snapshots: [], total_returned: 0 }) }
	);

	for (const evalCase of EVAL_CASES) {
		it(
			`picks ${evalCase.expectAnyOf.join(' or ')} for: "${evalCase.prompt}"`,
			{ timeout: 60_000 },
			async () => {
				const result = await generateText({
					model: openrouter.chat('@preset/test-workhorse-agent'),
					system:
						'You are a coffee intelligence assistant. Use the most appropriate tool for the question. Today is ' +
						new Date().toISOString().slice(0, 10),
					prompt: evalCase.prompt,
					tools,
					temperature: 0.4,
					stopWhen: stepCountIs(1)
				});

				const calledTools = result.toolCalls.map((call) => call.toolName);

				console.log(`[eval] "${evalCase.prompt}" → ${calledTools.join(', ') || '(no tool)'}`);

				expect(
					calledTools.some((name) => evalCase.expectAnyOf.includes(name)),
					`expected one of [${evalCase.expectAnyOf.join(', ')}], got [${calledTools.join(', ')}]`
				).toBe(true);
			}
		);
	}
});
