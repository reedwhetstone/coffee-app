import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	getConversationWorkspace,
	legacyConversationError,
	ParchmentConversationError,
	updateConversationWorkspace
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';

const workspaceUpdateSchema = z
	.object({
		title: z.string().max(120).optional(),
		type: z.enum(['general', 'sourcing', 'roasting', 'inventory', 'analysis']).optional()
	})
	.strict()
	.refine((body) => body.title !== undefined || body.type !== undefined, {
		message: 'Provide title or type to update'
	});

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
		return json(await getConversationWorkspace(client, event.params.id, 50));
	} catch (error) {
		return failure(error);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const parsed = workspaceUpdateSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) {
			return json({ error: 'Invalid workspace update payload' }, { status: 400 });
		}
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const workspace = await updateConversationWorkspace(client, event.params.id, parsed.data);
		return json({ workspace });
	} catch (error) {
		return failure(error);
	}
};

export const DELETE: RequestHandler = async () =>
	json({ error: 'Workspace deletion is disabled for single-chat persistence' }, { status: 405 });
