import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireChatAccess } = vi.hoisted(() => ({
	mockRequireChatAccess: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireChatAccess: mockRequireChatAccess
}));

let PUT: typeof import('./+server').PUT;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ PUT } = await import('./+server'));
	mockRequireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
});

function createSupabaseMock() {
	const updateEqUser = vi.fn(async () => ({ error: null }));
	const updateEqWorkspace = vi.fn(() => ({ eq: updateEqUser }));
	const update = vi.fn(() => ({ eq: updateEqWorkspace }));
	const from = vi.fn(() => ({ update }));

	return { from, update };
}

function makeEvent(body: string, supabase = createSupabaseMock()) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123/canvas', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body
		}),
		locals: { supabase }
	} as unknown as Parameters<NonNullable<typeof PUT>>[0];
}

describe('/api/workspaces/[id]/canvas persistence payloads', () => {
	it('rejects malformed JSON as a 400', async () => {
		const response = await PUT(makeEvent('{bad'));

		expect(response.status).toBe(400);
	});

	it('rejects oversized canvas state before writing', async () => {
		const supabase = createSupabaseMock();
		const response = await PUT(
			makeEvent(JSON.stringify({ canvas_state: { text: 'x'.repeat(200_001) } }), supabase)
		);

		expect(response.status).toBe(413);
		expect(supabase.update).not.toHaveBeenCalled();
	});
});
