import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	getOrCreateWorkspace: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({ requireChatAccess: mocks.requireChatAccess }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));
vi.mock('$lib/server/parchmentConversation', () => ({
	getOrCreateConversationWorkspace: mocks.getOrCreateWorkspace,
	legacyConversationError: vi.fn(() => ({ error: 'upstream failure' })),
	ParchmentConversationError: class extends Error {}
}));

import { GET, POST } from './+server';

function event(method: 'GET' | 'POST', body?: string) {
	return {
		request: new Request('https://app.test/api/workspaces', {
			method,
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body
		}),
		locals: {}
	} as Parameters<NonNullable<typeof GET>>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({ conversation: {} });
	mocks.getOrCreateWorkspace.mockResolvedValue({ id: 'workspace-123', reset_epoch: 2 });
});

describe('/api/workspaces singleton boundary', () => {
	it('loads the canonical workspace through a session-scoped SDK client', async () => {
		const response = await GET(event('GET'));
		expect(response.status).toBe(200);
		expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), { mode: 'session' });
		expect(mocks.getOrCreateWorkspace).toHaveBeenCalledWith(expect.anything(), {
			title: 'Coffee',
			type: 'general'
		});
		expect(await response.json()).toEqual({
			workspaces: [{ id: 'workspace-123', reset_epoch: 2 }]
		});
	});

	it('rejects expanded creation payloads before the SDK call', async () => {
		const response = await POST(
			event('POST', JSON.stringify({ title: 'Coffee', type: 'general', owner_id: 'other' }))
		);
		expect(response.status).toBe(400);
		expect(mocks.getOrCreateWorkspace).not.toHaveBeenCalled();
	});

	it('forwards only validated singleton metadata', async () => {
		const response = await POST(
			event('POST', JSON.stringify({ title: 'Roastery', type: 'roasting' }))
		);
		expect(response.status).toBe(200);
		expect(mocks.getOrCreateWorkspace).toHaveBeenCalledWith(expect.anything(), {
			title: 'Roastery',
			type: 'roasting'
		});
	});
});
