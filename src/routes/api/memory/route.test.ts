import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	getUserMemory: vi.fn(),
	saveUserMemory: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: class extends Error {},
	requireChatAccess: mocks.requireChatAccess
}));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));
vi.mock('$lib/server/parchmentConversation', () => ({
	legacyConversationError: vi.fn(() => ({ error: 'upstream failure' })),
	ParchmentConversationError: class extends Error {}
}));
vi.mock('$lib/server/userMemory', () => ({
	getUserMemory: mocks.getUserMemory,
	saveUserMemory: mocks.saveUserMemory,
	USER_MEMORY_MAX_CHARS: 8000
}));

import { GET, PUT } from './+server';

function event(method: 'GET' | 'PUT', body?: string) {
	return {
		request: new Request('https://app.test/api/memory', {
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
	mocks.getUserMemory.mockResolvedValue({
		content: 'Prefers light roasts',
		version: 3,
		updated_at: '2026-09-06T00:00:00Z',
		updated_by: 'user'
	});
	mocks.saveUserMemory.mockResolvedValue({
		content: 'Prefers washed coffees',
		version: 4,
		updated_at: '2026-09-06T01:00:00Z',
		updated_by: 'user'
	});
});

describe('/api/memory versioned boundary', () => {
	it('reads memory through the session-scoped SDK client', async () => {
		const response = await GET(event('GET'));
		expect(response.status).toBe(200);
		expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), { mode: 'session' });
		expect(await response.json()).toMatchObject({ version: 3 });
	});

	it('requires an explicit expected version', async () => {
		const response = await PUT(event('PUT', JSON.stringify({ content: 'Expanded payload' })));
		expect(response.status).toBe(400);
		expect(mocks.saveUserMemory).not.toHaveBeenCalled();
	});

	it('forwards content and the expected version through memory CAS', async () => {
		const response = await PUT(
			event('PUT', JSON.stringify({ content: 'Prefers washed coffees', expected_version: 3 }))
		);
		expect(response.status).toBe(200);
		expect(mocks.saveUserMemory).toHaveBeenCalledWith(
			expect.anything(),
			'Prefers washed coffees',
			'user',
			3
		);
		expect(await response.json()).toMatchObject({ ok: true, version: 4 });
	});
});
