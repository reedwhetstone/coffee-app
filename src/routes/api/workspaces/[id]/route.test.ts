import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	updateWorkspace: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({ requireChatAccess: mocks.requireChatAccess }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));
vi.mock('$lib/server/parchmentConversation', () => ({
	updateConversationWorkspace: mocks.updateWorkspace,
	getConversationWorkspace: vi.fn(),
	ParchmentConversationError: class extends Error {}
}));

import { PUT } from './+server';

function event(body: string) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body
		}),
		locals: {}
	} as Parameters<NonNullable<typeof PUT>>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({ conversation: {} });
	mocks.updateWorkspace.mockResolvedValue({ id: 'workspace-123', title: 'Updated' });
});

describe('/api/workspaces/[id] metadata updates', () => {
	it.each(['{bad', '{}', JSON.stringify({ title: 'x'.repeat(121), type: 'system' })])(
		'rejects invalid input before the SDK call',
		async (body) => {
			expect((await PUT(event(body))).status).toBe(400);
			expect(mocks.updateWorkspace).not.toHaveBeenCalled();
		}
	);

	it('forwards validated metadata through the session client', async () => {
		const response = await PUT(event(JSON.stringify({ title: 'Updated', type: 'sourcing' })));
		expect(response.status).toBe(200);
		expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), { mode: 'session' });
		expect(mocks.updateWorkspace).toHaveBeenCalledWith(expect.anything(), 'workspace-123', {
			title: 'Updated',
			type: 'sourcing'
		});
	});
});
