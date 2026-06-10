import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { getUserMemory, saveUserMemory, USER_MEMORY_MAX_CHARS } from '$lib/server/userMemory';
import type { RequestHandler } from './$types';

// GET /api/memory — the user's persistent memory document
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const memory = await getUserMemory(event.locals.supabase, user.id);
		return json({
			content: memory?.content ?? '',
			updated_at: memory?.updated_at ?? null,
			updated_by: memory?.updated_by ?? null
		});
	} catch (error) {
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		return json({ error: 'Failed to load memory' }, { status: 500 });
	}
};

const putSchema = z.object({ content: z.string().max(USER_MEMORY_MAX_CHARS) });

// PUT /api/memory — manual edit of the memory document
export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const parsed = putSchema.safeParse(await event.request.json());
		if (!parsed.success) {
			return json(
				{ error: `Memory document must be at most ${USER_MEMORY_MAX_CHARS} characters` },
				{ status: 400 }
			);
		}

		const { error } = await saveUserMemory(
			event.locals.supabase,
			user.id,
			parsed.data.content,
			'user'
		);
		if (error) return json({ error }, { status: 500 });

		return json({ ok: true });
	} catch (error) {
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		return json({ error: 'Failed to save memory' }, { status: 500 });
	}
};
