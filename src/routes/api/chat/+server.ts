import { json } from '@sveltejs/kit';
import type { ConversationChatStreamRequest } from '@purveyors/sdk';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import type { RequestHandler } from './$types';

/**
 * Same-origin streaming adapter for Cherry Runtime.
 *
 * Coffee App owns browser session admission and presentation transport. Parchment
 * owns the prompt, model, provider credential, tool loop, request bounds, and
 * provider diagnostics. Returning the upstream Response directly is deliberate:
 * it preserves AI SDK stream framing and forwards chunks without buffering.
 */
export const POST: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const body: ConversationChatStreamRequest = await event.request.json();
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});

		return await client.conversation.chat.stream(body, {
			signal: event.request.signal
		});
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
