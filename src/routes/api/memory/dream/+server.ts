import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	dreamConversationMemory,
	legacyConversationError,
	ParchmentConversationError
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';

const dreamSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string().max(4000)
			})
		)
		.min(4)
		.max(30)
});

// POST /api/memory/dream — session BFF for Parchment-owned memory reflection.
export const POST: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);

		const parsed = dreamSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid messages payload' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit',
			signal: event.request.signal
		});
		const reflected = await dreamConversationMemory(client, parsed.data);

		if (reflected.skipped) {
			return json({ skipped: true, reason: reflected.reason });
		}

		return json({
			ok: true,
			content: reflected.content,
			version: reflected.version,
			updated_at: reflected.updatedAt,
			updated_by: reflected.updatedBy
		});
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid messages payload' }, { status: 400 });
		}
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		if (error instanceof ParchmentConversationError) {
			return json(legacyConversationError(error.body), { status: error.status });
		}
		if (
			event.request.signal.aborted ||
			(error instanceof Error && /abort|cancel/i.test(error.message))
		) {
			return json({ error: 'Request was cancelled' }, { status: 499 });
		}
		if (error instanceof ParchmentConfigError) {
			return json({ error: 'Conversation memory is temporarily unavailable' }, { status: 503 });
		}
		console.error('Memory dream BFF request failed');
		return json({ error: 'Failed to update memory' }, { status: 500 });
	}
};
