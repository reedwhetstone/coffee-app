import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	legacyConversationError,
	ParchmentConversationError
} from '$lib/server/parchmentConversation';
import { getUserMemory, saveUserMemory, USER_MEMORY_MAX_CHARS } from '$lib/server/userMemory';
import type { RequestHandler } from './$types';

function failure(error: unknown) {
	if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
	if (error instanceof ParchmentConversationError) {
		return json(legacyConversationError(error.body), { status: error.status });
	}
	if (error instanceof ParchmentConfigError) {
		return json({ error: 'Conversation memory is temporarily unavailable' }, { status: 503 });
	}
	return json({ error: 'Failed to access memory' }, { status: 500 });
}

export const GET: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const memory = await getUserMemory(client);
		return json(memory);
	} catch (error) {
		return failure(error);
	}
};

const putSchema = z
	.object({
		content: z.string().max(USER_MEMORY_MAX_CHARS),
		expected_version: z.number().int().min(0)
	})
	.strict();

export const PUT: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
		const parsed = putSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) {
			return json(
				{ error: `Memory document must be at most ${USER_MEMORY_MAX_CHARS} characters` },
				{ status: 400 }
			);
		}
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const memory = await saveUserMemory(
			client,
			parsed.data.content,
			'user',
			parsed.data.expected_version
		);
		return json({ ok: true, ...memory });
	} catch (error) {
		return failure(error);
	}
};
