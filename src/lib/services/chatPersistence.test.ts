import { describe, expect, it } from 'vitest';

import { buildPersistedChatMessages } from './chatPersistence';

describe('buildPersistedChatMessages', () => {
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
