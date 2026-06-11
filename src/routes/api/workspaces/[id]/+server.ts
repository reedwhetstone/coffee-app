import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const workspaceTypeSchema = z.enum(['general', 'sourcing', 'roasting', 'inventory', 'analysis']);
const workspaceUpdateSchema = z
	.object({
		title: z.string().max(120).optional(),
		type: workspaceTypeSchema.optional()
	})
	.refine((body) => body.title !== undefined || body.type !== undefined, {
		message: 'Provide title or type to update'
	});

// GET /api/workspaces/[id] - Get workspace details with recent messages and canvas state
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const workspaceId = event.params.id;

		// Fetch workspace
		const { data: workspace, error: wsError } = await event.locals.supabase
			.from('workspaces')
			.select('*')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (wsError || !workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		// Fetch the most recent 50 messages, then return them chronologically for the UI.
		const { data: messages, error: msgError } = await event.locals.supabase
			.from('workspace_messages')
			.select('*')
			.eq('workspace_id', workspaceId)
			.order('created_at', { ascending: false })
			.limit(50);

		if (msgError) {
			return json({ error: msgError.message }, { status: 500 });
		}

		// Update last_accessed_at
		await event.locals.supabase
			.from('workspaces')
			.update({ last_accessed_at: new Date().toISOString() })
			.eq('id', workspaceId);

		return json({
			workspace,
			messages: [...(messages || [])].reverse()
		});
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// PUT /api/workspaces/[id] - Update workspace metadata
export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const workspaceId = event.params.id;
		const body = await event.request.json().catch(() => null);
		const parsed = workspaceUpdateSchema.safeParse(body);

		if (!parsed.success) {
			return json({ error: 'Invalid workspace update payload' }, { status: 400 });
		}

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.update(parsed.data)
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.select()
			.single();

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspace: data });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// DELETE /api/workspaces/[id] - Workspace deletion is disabled in the single-chat model.
export const DELETE: RequestHandler = async () => {
	return json(
		{ error: 'Workspace deletion is disabled for single-chat persistence' },
		{ status: 405 }
	);
};
