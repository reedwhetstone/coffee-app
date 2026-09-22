import { json } from '@sveltejs/kit';
import type { ConversationChatStreamRequest } from '@purveyors/sdk';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import type { RequestHandler } from './$types';

/**
 * Server-side fetch exposes a decoded body but can retain the upstream content
 * encoding and encoded length headers. Forwarding those headers makes the
 * browser try to decode the already-decoded stream again, masking useful 4xx
 * bodies as ERR_CONTENT_DECODING_FAILED.
 */
function browserStreamResponse(upstream: Response): Response {
	const headers = new Headers(upstream.headers);
	headers.delete('content-encoding');
	headers.delete('content-length');
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers
	});
}

/**
 * Same-origin streaming adapter for Cherry Runtime.
 *
 * Coffee App owns browser session admission and presentation transport. Parchment
 * owns the prompt, model, provider credential, tool loop, request bounds, and
 * provider diagnostics. The adapter preserves AI SDK stream framing and
 * forwards chunks without buffering, while removing encoded-representation
 * headers that no longer describe fetch's decoded body.
 */
export const POST: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const body: ConversationChatStreamRequest = await event.request.json();
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});

		const upstream = await client.conversation.chat.stream(body, {
			signal: event.request.signal
		});
		return browserStreamResponse(upstream);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid chat request' }, { status: 400 });
		}
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (
			event.request.signal.aborted ||
			(error instanceof Error && /abort|cancel/i.test(error.message))
		) {
			return json({ error: 'Request was cancelled' }, { status: 499 });
		}
		if (error instanceof ParchmentConfigError) {
			return json({ error: 'Chat is temporarily unavailable' }, { status: 503 });
		}

		console.error('Chat BFF request failed');
		return json({ error: 'Chat is temporarily unavailable' }, { status: 503 });
	}
};
