import { describe, expect, it } from 'vitest';

import { buildPersistedChatMessages } from './chatPersistence';

describe('buildPersistedChatMessages', () => {
	it('bounds a large tool result without losing the turn or action identity', () => {
		const payload = buildPersistedChatMessages([
			{
				id: 'action-turn',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'I found the lot.' },
					{
						type: 'tool-coffee_catalog_search',
						toolCallId: 'lookup',
						state: 'output-available',
						output: { coffees: [{ notes: 'x'.repeat(250_000) }] }
					},
					{
						type: 'tool-propose_action',
						toolCallId: 'proposal',
						state: 'output-available',
						output: {
							action_card: {
								executionId: 'action-turn:proposal',
								actionType: 'add_bean_to_inventory',
								summary: 'Add bean',
								fields: [],
								status: 'success'
							}
						}
					}
				]
			}
		]);

		expect(JSON.stringify(payload[0].parts).length).toBeLessThan(200_000);
		expect(payload[0].client_message_id).toBe('action-turn');
		expect(payload[0].content).toBe('I found the lot.');
		expect(payload[0].parts[1].output).toEqual({
			summary: 'Large result is available on the canvas.'
		});
		expect(
			(payload[0].parts[2].output as { action_card: { executionId: string } }).action_card
				.executionId
		).toBe('action-turn:proposal');
	});
	it('omits synthetic client timestamps when messages do not carry real createdAt values', () => {
		const payload = buildPersistedChatMessages([
			{ id: 'msg-user', role: 'user', parts: [{ type: 'text', text: 'Find naturals' }] },
			{ id: 'msg-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Here are some.' }] }
		]);

		expect(payload).toEqual([
			expect.objectContaining({
				client_message_id: 'msg-user',
				content: 'Find naturals'
			}),
			expect.objectContaining({
				client_message_id: 'msg-assistant',
				content: 'Here are some.'
			})
		]);
		expect(payload[0]).not.toHaveProperty('client_created_at');
		expect(payload[1]).not.toHaveProperty('client_created_at');
	});

	it('preserves real message creation timestamps when present', () => {
		const payload = buildPersistedChatMessages([
			{
				id: 'msg-user',
				role: 'user',
				parts: [{ type: 'text', text: 'Find naturals' }],
				createdAt: new Date('2026-06-14T17:18:39.123Z')
			}
		]);

		expect(payload[0].client_created_at).toBe('2026-06-14T17:18:39.123Z');
	});
});

import type { UIMessage } from 'ai';
import {
	getInterruptedTurnStatus,
	recoverInterruptedTurn
} from '$lib/components/chat/chatRecovery';

describe('interrupted evidence persistence', () => {
	it.each(['stopped', 'error'] as const)(
		'round-trips %s evidence and identity with no canvas replay',
		(status) => {
			const search: UIMessage = {
				id: 'saved-search',
				role: 'assistant',
				parts: [
					{
						type: 'tool-coffee_catalog_search',
						toolCallId: 'search-call',
						state: 'output-available',
						input: {},
						output: { coffees: [{ id: 42, name: 'Test Lot' }] }
					}
				]
			};
			const attempt: UIMessage[] = [
				search,
				{ id: 'request', role: 'user', parts: [{ type: 'text', text: 'Compare that coffee' }] },
				{
					id: 'answer',
					role: 'assistant',
					parts: [
						{ type: 'text', text: 'Initial comparison', state: 'streaming' },
						{
							type: 'tool-present_results',
							toolCallId: 'presentation-call',
							state: 'output-available',
							input: {},
							output: {
								presentation: {
									source_tool: 'coffee_catalog_search',
									items: [{ id: 42 }],
									canvas_action: 'replace',
									canvas_layout: 'comparison'
								}
							}
						}
					]
				}
			];
			const recovered = recoverInterruptedTurn(attempt, 1, status);
			const payload = buildPersistedChatMessages(recovered.slice(1));
			expect(payload[1].canvas_mutations).toEqual([]);
			expect(payload[1].client_message_id).toBe('answer');
			const restored = JSON.parse(JSON.stringify(payload));
			expect(restored).toEqual(payload);
			expect(restored[1].parts).toEqual(recovered[2].parts);
			expect(getInterruptedTurnStatus(restored[1].parts)).toBe(status);
			// Retrying the append uses an identical immutable payload.
			expect(buildPersistedChatMessages(recovered.slice(1))).toEqual(payload);
		}
	);
});
