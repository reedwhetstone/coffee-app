import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Json } from '$lib/types/database.types';

const MAX_CANVAS_JSON_CHARS = 200000;

const canvasBodySchema = z.object({
	canvas_state: z.unknown().optional()
});

function jsonSize(value: unknown): number {
	return JSON.stringify(value ?? null).length;
}

async function persistCanvas(event: Parameters<RequestHandler>[0]) {
	const { user } = await requireChatAccess(event);
	const workspaceId = event.params.id;
	const body = await event.request.json().catch(() => null);

	const parsed = canvasBodySchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const canvasState = parsed.data.canvas_state ?? {};
	if (jsonSize(canvasState) > MAX_CANVAS_JSON_CHARS) {
		return json(
			{ error: `canvas_state exceeds ${MAX_CANVAS_JSON_CHARS} serialized characters` },
			{ status: 413 }
		);
	}

	const { error } = await event.locals.supabase
		.from('workspaces')
		.update({
			canvas_state: canvasState as Json,
			last_accessed_at: new Date().toISOString()
		})
		.eq('id', workspaceId)
		.eq('user_id', user.id);

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
}

// PUT /api/workspaces/[id]/canvas - Persist canvas state
export const PUT: RequestHandler = async (event) => {
	try {
		return await persistCanvas(event);
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// POST /api/workspaces/[id]/canvas - Persist canvas state (sendBeacon compat)
export const POST: RequestHandler = async (event) => {
	try {
		return await persistCanvas(event);
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
