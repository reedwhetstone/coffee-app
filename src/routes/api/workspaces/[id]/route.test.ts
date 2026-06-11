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
	const single = vi.fn(async () => ({
		data: { id: 'workspace-123', title: 'New title' },
		error: null
	}));
	const select = vi.fn(() => ({ single }));
	const eqUser = vi.fn(() => ({ select }));
	const eqWorkspace = vi.fn(() => ({ eq: eqUser }));
	const update = vi.fn(() => ({ eq: eqWorkspace }));
	const from = vi.fn(() => ({ update }));

	return { from, update };
}

function makeEvent(body: string, supabase = createSupabaseMock()) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body
		}),
		locals: { supabase }
	} as unknown as Parameters<NonNullable<typeof PUT>>[0];
}

describe('/api/workspaces/[id] metadata updates', () => {
	it('rejects malformed JSON as a 400', async () => {
		const supabase = createSupabaseMock();
		const response = await PUT(makeEvent('{bad', supabase));

		expect(response.status).toBe(400);
		expect(supabase.update).not.toHaveBeenCalled();
	});

	it('rejects empty update bodies before writing', async () => {
		const supabase = createSupabaseMock();
		const response = await PUT(makeEvent('{}', supabase));

		expect(response.status).toBe(400);
		expect(supabase.update).not.toHaveBeenCalled();
	});

	it('rejects invalid title and type values before writing', async () => {
		const supabase = createSupabaseMock();
		const response = await PUT(
			makeEvent(JSON.stringify({ title: 'x'.repeat(121), type: 'system' }), supabase)
		);

		expect(response.status).toBe(400);
		expect(supabase.update).not.toHaveBeenCalled();
	});

	it('updates valid title and type values', async () => {
		const supabase = createSupabaseMock();
		const response = await PUT(
			makeEvent(JSON.stringify({ title: 'Updated', type: 'sourcing' }), supabase)
		);

		expect(response.status).toBe(200);
		expect(supabase.update).toHaveBeenCalledWith({ title: 'Updated', type: 'sourcing' });
	});
});
