import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireChatAccess } = vi.hoisted(() => ({
	mockRequireChatAccess: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireChatAccess: mockRequireChatAccess
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockRequireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
});

function createSupabaseMock() {
	const workspaceSelectQuery = {
		eq: vi.fn(() => workspaceSelectQuery),
		single: vi.fn(async () => ({ data: { id: 'workspace-123' }, error: null }))
	};
	const workspaceUpdateQuery = {
		eq: vi.fn(async () => ({ error: null }))
	};
	const messageUpsertSelect = vi.fn(async () => ({ data: [{ id: 'message-123' }], error: null }));
	const messageUpsert = vi.fn(() => ({ select: messageUpsertSelect }));
	const recentMessagesQuery = {
		eq: vi.fn(() => recentMessagesQuery),
		order: vi.fn(() => recentMessagesQuery),
		limit: vi.fn(async () => ({ data: [], error: null }))
	};
	const messageSelect = vi.fn(() => recentMessagesQuery);

	const from = vi.fn((table: string) => {
		if (table === 'workspaces') {
			return {
				select: vi.fn(() => workspaceSelectQuery),
				update: vi.fn(() => workspaceUpdateQuery)
			};
		}

		if (table === 'workspace_messages') {
			return { upsert: messageUpsert, select: messageSelect };
		}

		throw new Error(`Unexpected table lookup: ${table}`);
	});

	return { from, messageUpsert, messageSelect, recentMessagesQuery };
}

function makeEvent(body: unknown, supabase = createSupabaseMock()) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { supabase }
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/workspaces/[id]/messages persistence payloads', () => {
	it('truncates only duplicate content while preserving full structured parts', async () => {
		const supabase = createSupabaseMock();
		const longText = 'x'.repeat(13_000);
		const parts = [{ type: 'text', text: longText }];

		const response = await POST(
			makeEvent(
				{
					role: 'assistant',
					content: longText,
					parts
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					workspace_id: 'workspace-123',
					role: 'assistant',
					content: 'x'.repeat(12_000),
					parts
				})
			],
			expect.objectContaining({
				onConflict: 'workspace_id,client_message_id',
				ignoreDuplicates: true
			})
		);
	});

	it('skips duplicate messages already saved by unload and debounce races', async () => {
		const supabase = createSupabaseMock();
		const parts = [{ type: 'text', text: 'Show me Ethiopian naturals' }];
		supabase.recentMessagesQuery.limit.mockResolvedValueOnce({
			data: [
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts: [{ text: 'Show me Ethiopian naturals', type: 'text' }]
				}
			],
			error: null
		} as never);

		const response = await POST(
			makeEvent(
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).not.toHaveBeenCalled();
	});

	it('persists canvas mutations and client-created timestamps with messages', async () => {
		const supabase = createSupabaseMock();
		const canvasMutations = [
			{
				type: 'replace',
				blocks: [
					{
						block: { type: 'data-table', version: 1, data: { columns: [], rows: [] } },
						messageId: 'msg-1'
					}
				]
			}
		];

		const response = await POST(
			makeEvent(
				{
					role: 'assistant',
					content: 'Rendered a canvas table',
					parts: [{ type: 'text', text: 'Rendered a canvas table' }],
					canvas_mutations: canvasMutations,
					client_message_id: 'msg-1',
					client_created_at: '2026-06-14T17:18:39.123Z'
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					workspace_id: 'workspace-123',
					role: 'assistant',
					content: 'Rendered a canvas table',
					canvas_mutations: canvasMutations,
					client_message_id: 'msg-1',
					created_at: '2026-06-14T17:18:39.123Z'
				})
			],
			expect.objectContaining({
				onConflict: 'workspace_id,client_message_id',
				ignoreDuplicates: true
			})
		);
	});

	it('assigns distinct fallback timestamps when clients omit message timestamps', async () => {
		const supabase = createSupabaseMock();
		const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_797_189_519_000);

		const response = await POST(
			makeEvent(
				{
					messages: [
						{
							role: 'user',
							content: 'Find naturals',
							parts: [{ type: 'text', text: 'Find naturals' }],
							client_message_id: 'msg-user'
						},
						{
							role: 'assistant',
							content: 'Here are some.',
							parts: [{ type: 'text', text: 'Here are some.' }],
							client_message_id: 'msg-assistant'
						}
					]
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					client_message_id: 'msg-user',
					created_at: '2026-12-13T19:18:39.000Z'
				}),
				expect.objectContaining({
					client_message_id: 'msg-assistant',
					created_at: '2026-12-13T19:18:39.001Z'
				})
			],
			expect.objectContaining({
				onConflict: 'workspace_id,client_message_id',
				ignoreDuplicates: true
			})
		);

		nowSpy.mockRestore();
	});

	it('persists intentional repeated text when client message ids differ', async () => {
		const supabase = createSupabaseMock();
		const parts = [{ type: 'text', text: 'Show me Ethiopian naturals' }];
		supabase.recentMessagesQuery.limit.mockResolvedValueOnce({
			data: [
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts,
					client_message_id: 'msg-first'
				}
			],
			error: null
		} as never);

		const response = await POST(
			makeEvent(
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts,
					client_message_id: 'msg-second'
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					workspace_id: 'workspace-123',
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts,
					client_message_id: 'msg-second'
				})
			],
			expect.objectContaining({
				onConflict: 'workspace_id,client_message_id',
				ignoreDuplicates: true
			})
		);
	});

	it('skips retry duplicates when the client message id already exists', async () => {
		const supabase = createSupabaseMock();
		const parts = [{ type: 'text', text: 'Show me Ethiopian naturals' }];
		supabase.recentMessagesQuery.limit.mockResolvedValueOnce({
			data: [
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts,
					client_message_id: 'msg-retry'
				}
			],
			error: null
		} as never);

		const response = await POST(
			makeEvent(
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts,
					client_message_id: 'msg-retry'
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).not.toHaveBeenCalled();
	});

	it('skips retry batches when recent rows arrive in non-conversation order', async () => {
		const supabase = createSupabaseMock();
		const userParts = [{ type: 'text', text: 'Show me Ethiopian naturals' }];
		const assistantParts = [{ type: 'text', text: 'Try this washed Yirgacheffe.' }];
		supabase.recentMessagesQuery.limit.mockResolvedValueOnce({
			data: [
				{
					role: 'user',
					content: 'Show me Ethiopian naturals',
					parts: userParts,
					client_message_id: 'msg-user'
				},
				{
					role: 'assistant',
					content: 'Try this washed Yirgacheffe.',
					parts: assistantParts,
					client_message_id: 'msg-assistant'
				}
			],
			error: null
		} as never);

		const response = await POST(
			makeEvent(
				{
					messages: [
						{
							role: 'user',
							content: 'Show me Ethiopian naturals',
							parts: userParts,
							client_message_id: 'msg-user'
						},
						{
							role: 'assistant',
							content: 'Try this washed Yirgacheffe.',
							parts: assistantParts,
							client_message_id: 'msg-assistant'
						}
					]
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).not.toHaveBeenCalled();
	});

	it('inserts only messages after an already persisted overlap prefix', async () => {
		const supabase = createSupabaseMock();
		const firstParts = [{ type: 'text', text: 'Show me Ethiopian naturals' }];
		const secondParts = [{ type: 'text', text: 'What is the best value pick?' }];
		supabase.recentMessagesQuery.limit.mockResolvedValueOnce({
			data: [{ role: 'user', content: 'Show me Ethiopian naturals', parts: firstParts }],
			error: null
		} as never);

		const response = await POST(
			makeEvent(
				{
					messages: [
						{ role: 'user', content: 'Show me Ethiopian naturals', parts: firstParts },
						{ role: 'user', content: 'What is the best value pick?', parts: secondParts }
					]
				},
				supabase
			)
		);

		expect(response.status).toBe(201);
		expect(supabase.messageUpsert).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					workspace_id: 'workspace-123',
					role: 'user',
					content: 'What is the best value pick?',
					parts: secondParts
				})
			],
			expect.objectContaining({
				onConflict: 'workspace_id,client_message_id',
				ignoreDuplicates: true
			})
		);
	});
});
