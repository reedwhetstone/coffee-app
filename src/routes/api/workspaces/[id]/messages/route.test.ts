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
	const messageInsertSelect = vi.fn(async () => ({ data: [{ id: 'message-123' }], error: null }));
	const messageInsert = vi.fn(() => ({ select: messageInsertSelect }));
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
			return { insert: messageInsert, select: messageSelect };
		}

		throw new Error(`Unexpected table lookup: ${table}`);
	});

	return { from, messageInsert, messageSelect, recentMessagesQuery };
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
		expect(supabase.messageInsert).toHaveBeenCalledWith([
			expect.objectContaining({
				workspace_id: 'workspace-123',
				role: 'assistant',
				content: 'x'.repeat(12_000),
				parts
			})
		]);
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
		expect(supabase.messageInsert).not.toHaveBeenCalled();
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
		expect(supabase.messageInsert).toHaveBeenCalledWith([
			expect.objectContaining({
				workspace_id: 'workspace-123',
				role: 'user',
				content: 'What is the best value pick?',
				parts: secondParts
			})
		]);
	});
});
