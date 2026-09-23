import { describe, expect, it, vi } from 'vitest';
import type { ParchmentClient } from '@purveyors/sdk';
import { getCompleteConversationWorkspace } from './parchmentConversation';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const workspace = {
	id: workspaceId,
	title: 'Coffee',
	type: 'general',
	contextSummary: '',
	canvasState: null,
	createdAt: null,
	lastAccessedAt: null,
	resetEpoch: 0,
	canvasVersion: 0,
	summaryVersion: 0,
	nextMessageSequence: 102
};
const message = (sequence: number) => ({
	id: `33333333-3333-4333-8333-${String(sequence).padStart(12, '0')}`,
	workspaceId,
	role: 'user' as const,
	content: `Turn ${sequence}`,
	parts: [],
	canvasMutations: [],
	clientMessageId: `turn-${sequence}`,
	clientCreatedAt: null,
	createdAt: '2026-09-23T19:00:00Z',
	messageSequence: sequence
});
const response = () => new Response('{}', { status: 200 });

describe('complete conversation restore', () => {
	it('loads older saved turns in sequence and does not stop at the latest 100', async () => {
		const get = vi.fn().mockResolvedValue({
			data: { data: { workspace, messages: Array.from({ length: 100 }, (_, i) => message(i + 2)) } },
			response: response()
		});
		const history = vi.fn().mockResolvedValue({
			data: { data: { messages: [message(1)], nextBeforeSequence: null } },
			response: response()
		});
		const client = {
			conversation: { workspaces: { get } },
			raw: { GET: history }
		} as unknown as ParchmentClient;
		const result = await getCompleteConversationWorkspace(client, workspaceId);
		expect(result.messages).toHaveLength(101);
		expect(result.messages.map((turn) => turn.message_sequence)).toEqual(
			Array.from({ length: 101 }, (_, i) => i + 1)
		);
		expect(history).toHaveBeenCalledWith(
			'/v1/conversation/workspaces/{workspaceId}/messages/history',
			{ params: { path: { workspaceId }, query: { beforeSequence: 2, messageLimit: 100 } } }
		);
	});

	it('keeps recent turns available while the companion API route is deploying', async () => {
		const recent = Array.from({ length: 100 }, (_, i) => message(i + 2));
		const client = {
			conversation: {
				workspaces: {
					get: vi.fn().mockResolvedValue({ data: { data: { workspace, messages: recent } }, response: response() })
				}
			},
			raw: { GET: vi.fn().mockResolvedValue({ response: new Response('{}', { status: 404 }) }) }
		} as unknown as ParchmentClient;
		const result = await getCompleteConversationWorkspace(client, workspaceId);
		expect(result.messages).toHaveLength(100);
		expect(result.messages[0].message_sequence).toBe(2);
	});
});
