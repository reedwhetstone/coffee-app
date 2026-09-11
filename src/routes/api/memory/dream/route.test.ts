import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	dream: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	AuthError: class AuthError extends Error {
		constructor(
			message: string,
			public status = 401
		) {
			super(message);
		}
	},
	requireChatAccess: mocks.requireChatAccess
}));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

import { AuthError } from '$lib/server/auth';
import { ParchmentConfigError } from '$lib/server/parchmentClient';
import { POST } from './+server';

const messages = Array.from({ length: 4 }, (_, index) => ({
	role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
	content: `message ${index + 1}`
}));

function event(body: string = JSON.stringify({ messages }), signal?: AbortSignal) {
	return {
		request: new Request('https://app.test/api/memory/dream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			signal
		}),
		locals: {}
	} as Parameters<NonNullable<typeof POST>>[0];
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({
		conversation: { memory: { dream: mocks.dream } }
	});
	mocks.dream.mockResolvedValue({
		data: {
			data: {
				content: 'Durable memory',
				version: 9,
				updatedAt: '2026-09-09T17:00:00.000Z',
				updatedBy: 'agent',
				skipped: false
			}
		},
		response: new Response(null, { status: 200 })
	});
});

describe('POST /api/memory/dream', () => {
	it('reflects memory through exactly one session-bound SDK request', async () => {
		const requestEvent = event();
		const response = await POST(requestEvent);

		expect(response.status).toBe(200);
		expect(mocks.requireChatAccess).toHaveBeenCalledWith(requestEvent);
		expect(mocks.createClient).toHaveBeenCalledWith(requestEvent, {
			mode: 'session',
			preferHandling: 'inherit',
			signal: requestEvent.request.signal
		});
		expect(mocks.dream).toHaveBeenCalledOnce();
		expect(mocks.dream).toHaveBeenCalledWith({ messages });
		await expect(response.json()).resolves.toEqual({
			ok: true,
			content: 'Durable memory',
			version: 9,
			updated_at: '2026-09-09T17:00:00.000Z',
			updated_by: 'agent'
		});
	});

	it.each(['cooldown', 'empty-response'] as const)(
		'preserves the legacy %s response shape',
		async (reason) => {
			mocks.dream.mockResolvedValue({
				data: {
					data: {
						content: 'Existing memory',
						version: 8,
						updatedAt: '2026-09-09T17:00:00.000Z',
						updatedBy: 'user',
						skipped: true,
						reason
					}
				},
				response: new Response(null, { status: 200 })
			});

			const response = await POST(event());

			await expect(response.json()).resolves.toEqual({ skipped: true, reason });
		}
	);

	it('relays sanitized Parchment conflicts without retrying locally', async () => {
		mocks.dream.mockResolvedValue({
			error: { error: { code: 'conversation_conflict', message: 'Conversation state changed' } },
			response: new Response(null, { status: 409 })
		});

		const response = await POST(event());

		expect(response.status).toBe(409);
		expect(mocks.dream).toHaveBeenCalledOnce();
		await expect(response.json()).resolves.toEqual({
			error: 'Conversation state changed',
			code: 'conversation_conflict'
		});
	});

	it('relays only the sanitized provider failure from Parchment', async () => {
		mocks.dream.mockResolvedValue({
			error: {
				error: {
					code: 'ai_unavailable',
					message: 'Memory reflection is temporarily unavailable'
				}
			},
			response: new Response(null, { status: 503 })
		});

		const response = await POST(event());

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: 'Memory reflection is temporarily unavailable',
			code: 'ai_unavailable'
		});
	});

	it('denies unauthorized callers before client creation', async () => {
		mocks.requireChatAccess.mockRejectedValue(
			new AuthError('Session authentication required', 401)
		);

		const response = await POST(event());

		expect(response.status).toBe(401);
		expect(mocks.createClient).not.toHaveBeenCalled();
		expect(mocks.dream).not.toHaveBeenCalled();
	});

	it('rejects malformed and out-of-bounds payloads before client creation', async () => {
		for (const body of ['{', JSON.stringify({ messages: messages.slice(0, 3) })]) {
			const response = await POST(event(body));
			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toEqual({ error: 'Invalid messages payload' });
		}
		expect(mocks.createClient).not.toHaveBeenCalled();
	});

	it('propagates browser cancellation and returns a stable cancellation response', async () => {
		const controller = new AbortController();
		const requestEvent = event(undefined, controller.signal);
		mocks.dream.mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					if (controller.signal.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
						return;
					}
					controller.signal.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError'))
					);
				})
		);

		const pending = POST(requestEvent);
		controller.abort();

		const response = await pending;
		expect(response.status).toBe(499);
		expect(mocks.createClient).toHaveBeenCalledWith(
			requestEvent,
			expect.objectContaining({ signal: requestEvent.request.signal })
		);
	});

	it('sanitizes missing configuration and unexpected transport failures', async () => {
		mocks.createClient.mockRejectedValueOnce(
			new ParchmentConfigError('private configuration detail')
		);
		let response = await POST(event());
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: 'Conversation memory is temporarily unavailable'
		});

		mocks.createClient.mockResolvedValueOnce({
			conversation: { memory: { dream: mocks.dream } }
		});
		mocks.dream.mockRejectedValueOnce(new Error('private upstream detail'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		response = await POST(event());
		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'Failed to update memory' });
		expect(errorSpy).toHaveBeenCalledWith('Memory dream BFF request failed');
		expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('private upstream detail'));
		errorSpy.mockRestore();
	});
});
