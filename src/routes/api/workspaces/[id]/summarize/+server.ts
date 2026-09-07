import { json } from '@sveltejs/kit';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	compactConversationSummary,
	legacyConversationError,
	ParchmentConversationError
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';

function failure(error: unknown) {
	if (error instanceof ParchmentConversationError) {
		return json(legacyConversationError(error.body), { status: error.status });
	}
	if (error instanceof ParchmentConfigError) {
		return json({ error: 'Conversation state is temporarily unavailable' }, { status: 503 });
	}
	const status = (error as { status?: number }).status || 500;
	return json({ error: (error as Error).message }, { status });
}

export const POST: RequestHandler = async (event) => {
	const workspaceId = event.params.id;
	try {
		await requireChatAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const result = await compactConversationSummary(client, workspaceId);
		return json({
			summary: result.contextSummary,
			...(result.skipped ? { skipped: true } : {}),
			...(result.retryAfterMs === undefined ? {} : { retry_after_ms: result.retryAfterMs })
		});
	} catch (error) {
		return failure(error);
	}
};
