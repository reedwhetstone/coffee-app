import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	stream: vi.fn()
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

const requestBody = {
	messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
	workspaceContext: { id: '11111111-1111-4111-8111-111111111111', type: 'general' },
	pageContext: { surface: 'catalog', summary: 'Catalog results' },
	includeUserMemory: true
};

function event(body: string = JSON.stringify(requestBody), signal?: AbortSignal) {
	return {
		request: new Request('https://app.test/api/chat', {
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
		conversation: { chat: { stream: mocks.stream } }
	});
});

describe('POST /api/chat', () => {
	it('forwards the session request through one unbuffered SDK stream', async () => {
		const upstream = new Response('data: stream\n\n', {
			status: 200,
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'private, no-store',
				'x-vercel-ai-ui-message-stream': 'v1'
			}
		});
		mocks.stream.mockResolvedValue(upstream);
		const requestEvent = event();

		const response = await POST(requestEvent);

		expect(response).toBe(upstream);
		expect(mocks.requireChatAccess).toHaveBeenCalledWith(requestEvent);
		expect(mocks.createClient).toHaveBeenCalledWith(requestEvent, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.stream).toHaveBeenCalledWith(requestBody, {
			signal: requestEvent.request.signal
		});
		expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
	});

	it('returns Parchment authorization and bounded-request responses unchanged', async () => {
		const upstream = Response.json(
			{
				error: {
					message: 'This conversation is too large to send safely.',
					code: 'prompt_budget_exceeded'
				}
			},
			{ status: 413, headers: { 'Cache-Control': 'private, no-store' } }
		);
		mocks.stream.mockResolvedValue(upstream);

		const response = await POST(event());

		expect(response).toBe(upstream);
		expect(response.status).toBe(413);
		expect(mocks.stream).toHaveBeenCalledOnce();
	});

	it('propagates browser cancellation to the upstream stream call', async () => {
		const controller = new AbortController();
		const requestEvent = event(undefined, controller.signal);
		mocks.stream.mockImplementation(
			(_body, init: { signal?: AbortSignal }) =>
				new Promise<Response>((_resolve, reject) => {
					if (init.signal?.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
						return;
					}
					init.signal?.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError'))
					);
				})
		);

		const pending = POST(requestEvent);
		controller.abort();

		const response = await pending;
		expect(response.status).toBe(499);
		expect(mocks.stream).toHaveBeenCalledWith(requestBody, {
			signal: requestEvent.request.signal
		});
	});

	it('denies non-session or unentitled callers before client creation', async () => {
		mocks.requireChatAccess.mockRejectedValue(
			new AuthError('Session authentication required', 401)
		);

		const response = await POST(event());

		expect(response.status).toBe(401);
		expect(mocks.createClient).not.toHaveBeenCalled();
		expect(mocks.stream).not.toHaveBeenCalled();
	});

	it('rejects malformed JSON before client creation', async () => {
		const response = await POST(event('{'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid chat request' });
		expect(mocks.createClient).not.toHaveBeenCalled();
	});

	it('sanitizes missing configuration and network failures', async () => {
		mocks.createClient.mockRejectedValueOnce(
			new ParchmentConfigError('secret configuration detail')
		);
		let response = await POST(event());
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({ error: 'Chat is temporarily unavailable' });

		mocks.createClient.mockResolvedValueOnce({
			conversation: { chat: { stream: mocks.stream } }
		});
		mocks.stream.mockRejectedValueOnce(new Error('upstream connection detail'));
		response = await POST(event());
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({ error: 'Chat is temporarily unavailable' });
	});
});
