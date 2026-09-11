import { describe, expect, it } from 'vitest';
import { classifyChatFailure, rollbackFailedTurn } from './chatRecovery';

describe('rollbackFailedTurn', () => {
	it('removes the failed user turn so a revised prompt replaces it', () => {
		const messages = [
			{ id: 'assistant-1', role: 'assistant' },
			{ id: 'user-failed', role: 'user' },
			{ id: 'assistant-partial', role: 'assistant' }
		];

		expect(rollbackFailedTurn(messages, 1)).toEqual([messages[0]]);
	});

	it('leaves messages unchanged when no submission is being tracked', () => {
		const messages = [{ id: 'user-1', role: 'user' }];
		expect(rollbackFailedTurn(messages, null)).toBe(messages);
	});
});

describe('classifyChatFailure', () => {
	it('makes timeouts recoverable', () => {
		expect(classifyChatFailure(new Error('request timed out'))).toMatchObject({
			kind: 'timeout',
			retryable: true
		});
	});

	it('does not offer blind retries for access failures', () => {
		expect(classifyChatFailure(new Error('403 forbidden'))).toMatchObject({
			kind: 'access',
			retryable: false
		});
	});

	it('distinguishes tool, persistence, and no-results failures', () => {
		expect(classifyChatFailure(new Error('tool execution failed')).kind).toBe('tool');
		expect(classifyChatFailure(new Error('workspace save failed')).kind).toBe('persistence');
		expect(classifyChatFailure(new Error('no results found')).kind).toBe('no-results');
	});
});

// These fixtures use real UI-message tool states so recovery also exercises the
// same validation and model-message conversion used by the upstream runtime.
import { convertToModelMessages, validateUIMessages, type UIMessage } from 'ai';
import {
	finalizedMessagesForUnload,
	getInterruptedTurnStatus,
	prepareChatRequestMessages,
	recoverInterruptedTurn
} from './chatRecovery';

const user: UIMessage = {
	id: 'request',
	role: 'user',
	parts: [{ type: 'text', text: 'Find coffee' }]
};
const prior: UIMessage = {
	id: 'prior',
	role: 'assistant',
	parts: [{ type: 'text', text: 'Earlier answer' }]
};
const coffee = { id: 42, name: 'Ethiopia Test Lot' };
function tool(name: string, output: unknown, id = name): UIMessage['parts'][number] {
	return { type: `tool-${name}`, toolCallId: id, input: {}, state: 'output-available', output };
}
function assistant(parts: UIMessage['parts']): UIMessage {
	return { id: 'partial', role: 'assistant', parts };
}
const read = tool('coffee_catalog_search', { coffees: [coffee] });
const presentation = tool('present_results', {
	presentation: {
		source_tool: 'coffee_catalog_search',
		items: [{ id: 42 }],
		canvas_action: 'replace'
	}
});
const unfinished: UIMessage['parts'][number] = {
	type: 'tool-propose_inventory',
	toolCallId: 'incomplete',
	state: 'input-streaming',
	input: { name: 'Test' }
};
const proposal = tool('propose_inventory', { action_card: { executionId: 'do-not-execute' } });

describe('recoverInterruptedTurn', () => {
	it.each(['stopped', 'error'] as const)(
		'retains completed reads on %s, with finalized text and no proposals',
		(status) => {
			const messages = [
				prior,
				user,
				assistant([
					{ type: 'text', text: 'A partial recommendation', state: 'streaming' },
					read,
					unfinished,
					proposal,
					{ type: 'reasoning', text: 'incomplete', state: 'streaming' }
				])
			];
			const original = structuredClone(messages);
			const result = recoverInterruptedTurn(messages, 1, status);
			expect(result[0]).toBe(prior);
			expect(result[1]).toBe(user);
			expect(result[2].id).toBe('partial');
			expect(result[2].parts).toEqual([
				{ type: 'text', text: 'A partial recommendation', state: 'done' },
				read,
				{ type: 'data-cherry-turn-status', data: { version: 1, status } }
			]);
			expect(messages).toEqual(original);
			expect(recoverInterruptedTurn(result, 1, status)).toEqual(result);
		}
	);

	it('rolls back errors with no usable read evidence and access failures even with evidence', () => {
		for (const output of [
			null,
			{ coffees: [] },
			{ coffees: [null] },
			{ coffees: [{ id: 42 }] },
			{ coffees: [coffee], success: false }
		]) {
			expect(
				recoverInterruptedTurn(
					[prior, user, assistant([tool('coffee_catalog_search', output)])],
					1,
					'error'
				)
			).toEqual([prior]);
		}
		expect(
			recoverInterruptedTurn([prior, user, assistant([read])], 1, 'error', {
				allowRetention: false
			})
		).toEqual([prior]);
	});

	it('preserves stopped prompt/text even without evidence and removes incomplete presentation suppression', () => {
		const incompletePresentation = {
			...unfinished,
			type: 'tool-present_results'
		} as UIMessage['parts'][number];
		const result = recoverInterruptedTurn(
			[prior, user, assistant([{ type: 'text', text: 'Started' }, incompletePresentation])],
			1,
			'stopped'
		);
		expect(result).toHaveLength(3);
		expect(result[2].parts.map((part) => part.type)).toEqual(['text', 'data-cherry-turn-status']);
	});

	it('retains a completed presentation using prior saved coffee evidence, without looking ahead', () => {
		const savedSearch = { ...assistant([read]), id: 'saved-search' };
		const result = recoverInterruptedTurn(
			[savedSearch, user, assistant([presentation])],
			1,
			'error'
		);
		expect(result[0]).toBe(savedSearch);
		expect(result[2].parts).toContain(presentation);
		const outOfOrder = recoverInterruptedTurn(
			[prior, user, assistant([presentation, read])],
			1,
			'error'
		);
		expect(outOfOrder[2].parts).not.toContain(presentation);
		expect(outOfOrder[2].parts).toContain(read);
	});

	it('does not resolve malformed, missing or future sources, or non-coffee presentations', () => {
		const invalidSource = {
			...assistant([tool('coffee_catalog_search', { coffees: [null] })]),
			id: 'bad-source'
		};
		expect(
			recoverInterruptedTurn([invalidSource, user, assistant([presentation])], 1, 'error')
		).toEqual([invalidSource]);
		for (const value of [
			{ source_tool: 'coffee_catalog_search', items: [{ id: 999 }] },
			{ source_tool: 'coffee_catalog_search', items: [null] },
			{ source_tool: 'coffee_catalog_search', items: [{ id: 42 }], canvas_action: 'clear' },
			{ source_tool: 'green_coffee_inventory', items: [{ id: 42 }] }
		]) {
			const bad = tool('present_results', { presentation: value });
			const result = recoverInterruptedTurn([prior, user, assistant([read, bad])], 1, 'error');
			expect(result[2].parts).not.toContain(bad);
		}
	});

	it('does not change an already finalized prefix when a retry fails', () => {
		const first = recoverInterruptedTurn([prior, user, assistant([read])], 1, 'error');
		const payload = JSON.stringify(first);
		const retry = { ...user, id: 'retry-user' };
		const result = recoverInterruptedTurn(
			[...first, retry, { ...assistant([unfinished]), id: 'retry-assistant' }],
			first.length,
			'error'
		);
		expect(JSON.stringify(result)).toBe(payload);
		expect(result.every((message, index) => message === first[index])).toBe(true);
		expect(recoverInterruptedTurn(first, null, 'error')).toBe(first);
	});
});

describe('interrupted message request and unload projections', () => {
	it('validates and converts recovered history without incomplete calls, proposals or data markers', async () => {
		const recovered = recoverInterruptedTurn(
			[prior, user, assistant([read, presentation, unfinished, proposal])],
			1,
			'error'
		);
		const snapshot = JSON.stringify(recovered);
		const projected = prepareChatRequestMessages(recovered);
		const validated = await validateUIMessages({ messages: projected });
		const model = await convertToModelMessages(validated);
		const serialized = JSON.stringify(model);
		expect(serialized).toContain('coffee_catalog_search');
		expect(serialized).toContain('tool-call');
		expect(serialized).toContain('tool-result');
		expect(serialized).toContain('interrupted by an error');
		expect(serialized).not.toContain('propose_inventory');
		expect(serialized).not.toContain('data-cherry-turn-status');
		expect(JSON.stringify(recovered)).toBe(snapshot);
		// Generic data parts themselves are also compatible with the current upstream validator.
		await expect(validateUIMessages({ messages: recovered })).resolves.toHaveLength(3);
	});

	it('keeps complete normal tool history but removes incomplete legacy tools', async () => {
		const messages = [user, assistant([read, proposal, unfinished])];
		const projected = prepareChatRequestMessages(messages);
		expect(projected[1].parts).toEqual([read, proposal]);
		await expect(
			convertToModelMessages(await validateUIMessages({ messages: projected }))
		).resolves.toBeDefined();
		expect(messages[1].parts).toHaveLength(3);
	});

	it('excludes the entire active attempt from unload, including conservative missing-boundary handling', () => {
		const messages = [prior, user, assistant([read, unfinished])];
		expect(finalizedMessagesForUnload(messages, 1, true)).toEqual([prior]);
		expect(finalizedMessagesForUnload(messages, null, true)).toEqual([]);
		expect(finalizedMessagesForUnload(messages, 1, false)).toBe(messages);
	});

	it('recognizes only the supported versioned terminal statuses', () => {
		expect(
			getInterruptedTurnStatus([
				null,
				{},
				{ type: 'data-cherry-turn-status', data: { version: 2, status: 'error' } }
			])
		).toBeNull();
		expect(
			getInterruptedTurnStatus([
				{ type: 'data-cherry-turn-status', data: { version: 1, status: 'stopped' } }
			])
		).toBe('stopped');
	});
});
