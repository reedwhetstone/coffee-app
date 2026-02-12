import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// GET /api/workspaces/[id] - Get workspace details with recent messages and canvas state
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
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

		// Fetch recent messages (last 50)
		const { data: messages, error: msgError } = await event.locals.supabase
			.from('workspace_messages')
			.select('*')
			.eq('workspace_id', workspaceId)
			.order('created_at', { ascending: true })
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
			messages: messages || []
		});
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// PUT /api/workspaces/[id] - Update workspace metadata
export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const workspaceId = event.params.id;
		const body = await event.request.json();

		const updateData: Record<string, unknown> = {};
		if (body.title !== undefined) updateData.title = body.title;
		if (body.type !== undefined) updateData.type = body.type;
		if (body.context_summary !== undefined) updateData.context_summary = body.context_summary;

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.update(updateData)
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

// DELETE /api/workspaces/[id] - Delete a workspace
export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const workspaceId = event.params.id;

		const { error } = await event.locals.supabase
			.from('workspaces')
			.delete()
			.eq('id', workspaceId)
			.eq('user_id', user.id);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
