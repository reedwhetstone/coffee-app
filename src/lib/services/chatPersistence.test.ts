import { describe, expect, it } from 'vitest';
import { convertToModelMessages, validateUIMessages } from 'ai';

import { buildPersistedChatMessages, compactPersistedMessageForRetry } from './chatPersistence';
import { prepareChatRequestMessages } from '$lib/components/chat/chatRecovery';

describe('buildPersistedChatMessages', () => {
	it('keeps a 413 fallback action receipt valid for the next request after reload', async () => {
		const [message] = buildPersistedChatMessages([
			{
				id: 'fallback-action-turn',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'Review this inventory action.' },
					{
						type: 'tool-propose_action',
						toolCallId: 'proposal',
						input: { coffee: 'Ethiopia' },
						state: 'output-available',
						output: {
							action_card: {
								executionId: 'fallback-action-turn:proposal',
								actionType: 'add_bean_to_inventory',
								summary: 'Add Ethiopia',
								fields: [],
								status: 'success'
							}
						}
					}
				]
			}
		]);
		const saved = compactPersistedMessageForRetry(message);
		const restored = JSON.parse(JSON.stringify(saved));
		const validated = await validateUIMessages({
			messages: prepareChatRequestMessages([
				{ id: restored.client_message_id, role: restored.role, parts: restored.parts } as never,
				{ id: 'next-turn', role: 'user', parts: [{ type: 'text', text: 'What next?' }] }
			])
		});

		expect(restored.parts[1]).toMatchObject({
			type: 'tool-propose_action',
			toolCallId: 'proposal',
			input: {},
			state: 'output-available',
			output: { action_card: { executionId: 'fallback-action-turn:proposal' } }
		});
		await expect(convertToModelMessages(validated)).resolves.toBeDefined();
	});

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

	it('hard-bounds a turn with several oversized text parts', () => {
		const [message] = buildPersistedChatMessages([
			{
				id: 'long-turn',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'a'.repeat(130_000) },
					{ type: 'text', text: 'b'.repeat(130_000) }
				]
			}
		]);
		expect(JSON.stringify(message.parts).length).toBeLessThan(120_000);
		expect(message.content.length).toBeLessThanOrEqual(120_000);
	});

	it('reduces oversized action cards before persisting a bounded receipt', () => {
		const [message] = buildPersistedChatMessages([
			{
				id: 'large-action-card',
				role: 'assistant',
				parts: [
					{
						type: 'tool-propose_action',
						toolCallId: 'proposal',
						input: {},
						state: 'output-available',
						output: {
							action_card: {
								executionId: 'large-action-card:proposal',
								actionType: 'add_bean_to_inventory',
								summary: 'Add a bean',
								fields: [{ key: 'options', options: ['x'.repeat(130_000)] }],
								status: 'proposed'
							}
						}
					}
				]
			}
		]);
		const serializedParts = JSON.stringify(message.parts);
		const actionCard = (message.parts[0].output as { action_card: Record<string, unknown> })
			.action_card;

		expect(serializedParts.length).toBeLessThan(120_000);
		expect(actionCard).toMatchObject({
			executionId: 'large-action-card:proposal',
			actionType: 'add_bean_to_inventory',
			status: 'proposed',
			fields: []
		});
	});

	it('keeps compacted tool interactions valid for the next chat request', async () => {
		const [message] = buildPersistedChatMessages([
			{
				id: 'large-tool-turn',
				role: 'assistant',
				parts: [
					{
						type: 'tool-coffee_catalog_search',
						toolCallId: 'catalog-search',
						input: { origin: 'Ethiopia' },
						state: 'output-available',
						output: { coffees: [{ notes: 'x'.repeat(130_000) }] }
					},
					{
						type: 'dynamic-tool',
						toolName: 'catalog_rank',
						toolCallId: 'dynamic-rank',
						input: { limit: 3 },
						state: 'output-available',
						output: { ranked: 'y'.repeat(130_000) }
					}
				]
			}
		]);

		expect(JSON.stringify(message.parts).length).toBeLessThan(120_000);
		expect(message.parts[0]).toMatchObject({
			type: 'tool-coffee_catalog_search',
			toolCallId: 'catalog-search',
			input: { origin: 'Ethiopia' },
			state: 'output-available'
		});
		expect(message.parts[1]).toMatchObject({
			type: 'dynamic-tool',
			toolName: 'catalog_rank',
			toolCallId: 'dynamic-rank',
			input: { limit: 3 },
			state: 'output-available'
		});
		const validated = await validateUIMessages({
			messages: prepareChatRequestMessages([{ ...message, id: 'large-tool-turn' } as never])
		});
		await expect(convertToModelMessages(validated)).resolves.toBeDefined();
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
