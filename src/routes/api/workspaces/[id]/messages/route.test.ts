import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	append: vi.fn(),
	clear: vi.fn()
}));
vi.mock('$lib/server/auth', () => ({ requireChatAccess: mocks.requireChatAccess }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));
vi.mock('$lib/server/parchmentConversation', () => ({
	appendConversationMessages: mocks.append,
	clearConversationMessages: mocks.clear,
	ParchmentConversationError: class extends Error {}
}));

import { DELETE, POST } from './+server';

function event(method: 'POST' | 'DELETE', body: unknown) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123/messages', {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: {}
	} as Parameters<NonNullable<typeof POST>>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({});
	mocks.append.mockResolvedValue({
		inserted: 1,
		replayed: 0,
		resetEpoch: 2,
		nextMessageSequence: 8
	});
	mocks.clear.mockResolvedValue({
		deleted: 7,
		resetEpoch: 3,
		summaryVersion: 5,
		canvasVersion: 4
	});
});

describe('/api/workspaces/[id]/messages', () => {
	it('requires the reset epoch before appending', async () => {
		const response = await POST(event('POST', { messages: [{ role: 'user', content: 'hello' }] }));
		expect(response.status).toBe(400);
		expect(mocks.append).not.toHaveBeenCalled();
	});

	it('forwards stable IDs and structured data through the session SDK', async () => {
		const response = await POST(
			event('POST', {
				expected_reset_epoch: 2,
				messages: [
					{
						role: 'assistant',
						content: 'hello',
						parts: [{ type: 'text', text: 'hello' }],
						canvas_mutations: [{ op: 'add' }],
						client_message_id: 'message-1',
						client_created_at: '2026-09-06T14:00:00.000Z'
					}
				]
			})
		);
		expect(response.status).toBe(201);
		expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), { mode: 'session' });
		expect(mocks.append).toHaveBeenCalledWith(expect.anything(), 'workspace-123', {
			expectedResetEpoch: 2,
			messages: [
				{
					role: 'assistant',
					content: 'hello',
					parts: [{ type: 'text', text: 'hello' }],
					canvasMutations: [{ op: 'add' }],
					clientMessageId: 'message-1',
					clientCreatedAt: '2026-09-06T14:00:00.000Z'
				}
			]
		});
	});

	it('derives a stable replay ID for a legacy caller without one', async () => {
		const body = {
			expected_reset_epoch: 0,
			messages: [{ role: 'user', content: 'legacy' }]
		};
		await POST(event('POST', body));
		await POST(event('POST', body));
		const first = mocks.append.mock.calls[0][2].messages[0].clientMessageId;
		const second = mocks.append.mock.calls[1][2].messages[0].clientMessageId;
		expect(first).toMatch(/^legacy-/);
		expect(second).toBe(first);
	});

	it('clear carries the reset epoch and returns the next epoch', async () => {
		const response = await DELETE(event('DELETE', { expected_reset_epoch: 2 }));
		expect(mocks.clear).toHaveBeenCalledWith(expect.anything(), 'workspace-123', 2);
		await expect(response.json()).resolves.toMatchObject({
			deleted: 7,
			reset_epoch: 3,
			summary_version: 5,
			canvas_version: 4
		});
	});
});
