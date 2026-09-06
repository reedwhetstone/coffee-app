import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	getOrCreateConversationWorkspace,
	legacyConversationError,
	ParchmentConversationError
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';

const createSchema = z
	.object({
		title: z.string().max(120).default('Coffee'),
		type: z.enum(['general', 'sourcing', 'roasting', 'inventory', 'analysis']).default('general')
	})
	.strict();

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

export const GET: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const workspace = await getOrCreateConversationWorkspace(client, {
			title: 'Coffee',
			type: 'general'
		});
		return json({ workspaces: [workspace] });
	} catch (error) {
		return failure(error);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const parsed = createSchema.safeParse(await event.request.json().catch(() => ({})));
		if (!parsed.success) return json({ error: 'Invalid workspace payload' }, { status: 400 });
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const workspace = await getOrCreateConversationWorkspace(client, parsed.data);
		return json({ workspace });
	} catch (error) {
		return failure(error);
	}
};
