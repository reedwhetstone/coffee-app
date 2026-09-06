import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	compactSummary: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({ requireChatAccess: mocks.requireChatAccess }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));

import { POST } from './+server';

function event() {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123/summarize', {
			method: 'POST'
		}),
		locals: {}
	} as Parameters<NonNullable<typeof POST>>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({
		conversation: { workspaces: { compactSummary: mocks.compactSummary } }
	});
	mocks.compactSummary.mockResolvedValue({
		data: {
			data: {
				contextSummary: 'Current compact summary',
				summaryVersion: 4,
				resetEpoch: 2,
				messageHighWater: 8,
				skipped: false
			}
		},
		response: new Response(null, { status: 200 })
	});
});

describe('/api/workspaces/[id]/summarize', () => {
	it('uses the session-bound Parchment compaction contract', async () => {
		const response = await POST(event());

		expect(response.status).toBe(200);
		expect(mocks.requireChatAccess).toHaveBeenCalledOnce();
		expect(mocks.createClient).toHaveBeenCalledWith(expect.anything(), { mode: 'session' });
		expect(mocks.compactSummary).toHaveBeenCalledWith('workspace-123');
		await expect(response.json()).resolves.toEqual({
			summary: 'Current compact summary'
		});
	});

	it('preserves the legacy cooldown response shape', async () => {
		mocks.compactSummary.mockResolvedValue({
			data: {
				data: {
					contextSummary: 'Existing summary',
					summaryVersion: 3,
					resetEpoch: 2,
					messageHighWater: 8,
					skipped: true,
					retryAfterMs: 12_000
				}
			},
			response: new Response(null, { status: 200 })
		});

		const response = await POST(event());

		await expect(response.json()).resolves.toEqual({
			summary: 'Existing summary',
			skipped: true,
			retry_after_ms: 12_000
		});
	});

	it('relays sanitized Parchment conflicts without retrying locally', async () => {
		mocks.compactSummary.mockResolvedValue({
			error: { error: { code: 'conversation_conflict', message: 'Conversation state changed' } },
			response: new Response(null, { status: 409 })
		});

		const response = await POST(event());

		expect(response.status).toBe(409);
		expect(mocks.compactSummary).toHaveBeenCalledOnce();
		await expect(response.json()).resolves.toEqual({
			error: 'Conversation state changed',
			code: 'conversation_conflict'
		});
	});

	it("relays only Parchment's sanitized provider failure", async () => {
		mocks.compactSummary.mockResolvedValue({
			error: {
				error: {
					code: 'ai_provider_unavailable',
					message: 'Summary generation is temporarily unavailable'
				}
			},
			response: new Response(null, { status: 502 })
		});

		const response = await POST(event());

		expect(response.status).toBe(502);
		expect(mocks.compactSummary).toHaveBeenCalledOnce();
		await expect(response.json()).resolves.toEqual({
			error: 'Summary generation is temporarily unavailable',
			code: 'ai_provider_unavailable'
		});
	});

	it('stops before creating a provider client when chat access is denied', async () => {
		mocks.requireChatAccess.mockRejectedValue(
			Object.assign(new Error('Parchment Intelligence subscription required'), { status: 403 })
		);

		const response = await POST(event());

		expect(response.status).toBe(403);
		expect(mocks.createClient).not.toHaveBeenCalled();
		expect(mocks.compactSummary).not.toHaveBeenCalled();
	});
});
