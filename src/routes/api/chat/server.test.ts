// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	access: vi.fn(),
	client: vi.fn(),
	stream: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireChatAccess: mocks.access,
	AuthError: class AuthError extends Error {
		status = 403;
	}
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.client,
	ParchmentConfigError: class ParchmentConfigError extends Error {}
}));

import { POST } from './+server';

const requestBody = {
	messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Find a coffee' }] }]
};
const encoder = new TextEncoder();
const firstFrame = 'data: {"type":"start","messageId":"assistant-1"}\n\n';
const finalFrames = 'data: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n';

function makeEvent(signal?: AbortSignal) {
	return {
		request: new Request('https://app.test/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(requestBody),
			signal
		})
	} as Parameters<typeof POST>[0];
}

describe('POST /api/chat streaming adapter', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.access.mockResolvedValue({});
		mocks.client.mockResolvedValue({ conversation: { chat: { stream: mocks.stream } } });
	});

	it('forwards the first upstream frame before the final frames are released', async () => {
		let upstreamController!: ReadableStreamDefaultController<Uint8Array>;
		const upstreamBody = new ReadableStream<Uint8Array>({
			start(controller) {
				upstreamController = controller;
				controller.enqueue(encoder.encode(firstFrame));
			}
		});
		const upstream = new Response(upstreamBody, {
			headers: {
				'content-type': 'text/event-stream',
				'x-vercel-ai-ui-message-stream': 'v1',
				'cache-control': 'no-cache'
			}
		});
		mocks.stream.mockResolvedValue(upstream);
		const event = makeEvent();

		const response = await POST(event);
		expect(response).toBe(upstream);
		expect(response.headers.get('content-type')).toBe('text/event-stream');
		expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
		expect(response.headers.get('cache-control')).toBe('no-cache');
		expect(mocks.client).toHaveBeenCalledWith(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(mocks.stream).toHaveBeenCalledWith(requestBody, { signal: event.request.signal });

		const reader = response.body!.getReader();
		try {
			// There is no timer or completed response to read: the producer remains open
			// until this assertion succeeds. Buffering in the adapter would stall here.
			expect(await reader.read()).toEqual({ value: encoder.encode(firstFrame), done: false });
			upstreamController.enqueue(encoder.encode(finalFrames));
			upstreamController.close();
			expect(await reader.read()).toEqual({ value: encoder.encode(finalFrames), done: false });
			expect(await reader.read()).toEqual({ value: undefined, done: true });
		} finally {
			await reader.cancel();
		}
	});

	it('keeps browser cancellation connected to the upstream request after streaming starts', async () => {
		const browserController = new AbortController();
		const event = makeEvent(browserController.signal);
		const upstreamAborted = vi.fn();
		mocks.stream.mockImplementation((_body, { signal }: { signal: AbortSignal }) => {
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(firstFrame));
						signal.addEventListener(
							'abort',
							() => {
								upstreamAborted(signal.reason);
								controller.error(signal.reason);
							},
							{ once: true }
						);
					}
				})
			);
		});

		const response = await POST(event);
		const reader = response.body!.getReader();
		try {
			expect(await reader.read()).toEqual({ value: encoder.encode(firstFrame), done: false });
			expect(mocks.stream).toHaveBeenCalledWith(requestBody, { signal: event.request.signal });
			expect(event.request.signal.aborted).toBe(false);

			const cancellation = new DOMException('The user stopped the response', 'AbortError');
			const nextFrame = reader.read();
			browserController.abort(cancellation);

			await expect(nextFrame).rejects.toBe(cancellation);
			expect(upstreamAborted).toHaveBeenCalledOnce();
			expect(upstreamAborted).toHaveBeenCalledWith(cancellation);
			expect(event.request.signal.aborted).toBe(true);
		} finally {
			reader.releaseLock();
		}
	});
});
