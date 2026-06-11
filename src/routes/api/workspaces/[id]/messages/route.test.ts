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

	const from = vi.fn((table: string) => {
		if (table === 'workspaces') {
			return {
				select: vi.fn(() => workspaceSelectQuery),
				update: vi.fn(() => workspaceUpdateQuery)
			};
		}

		if (table === 'workspace_messages') {
			return { insert: messageInsert };
		}

		throw new Error(`Unexpected table lookup: ${table}`);
	});

	return { from, messageInsert };
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
});
