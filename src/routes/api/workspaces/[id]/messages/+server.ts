import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// POST /api/workspaces/[id]/messages - Save messages for a workspace
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const workspaceId = event.params.id;
		const body = await event.request.json();

		// Verify workspace ownership
		const { data: workspace } = await event.locals.supabase
			.from('workspaces')
			.select('id')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (!workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		// Accept an array of messages to save
		const messages: Array<{
			role: string;
			content: string;
			parts?: unknown;
			canvas_mutations?: unknown;
		}> = Array.isArray(body.messages) ? body.messages : [body];

		const rows = messages.map((msg) => ({
			workspace_id: workspaceId,
			role: msg.role,
			content: msg.content,
			parts: (msg.parts || []) as import('$lib/types/database.types').Json,
			canvas_mutations: (msg.canvas_mutations || []) as import('$lib/types/database.types').Json
		}));

		const { data, error } = await event.locals.supabase
			.from('workspace_messages')
			.insert(rows)
			.select();

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		// Update last_accessed_at
		await event.locals.supabase
			.from('workspaces')
			.update({ last_accessed_at: new Date().toISOString() })
			.eq('id', workspaceId);

		return json({ messages: data }, { status: 201 });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// DELETE /api/workspaces/[id]/messages - Clear all messages in workspace
export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const workspaceId = event.params.id;

		// Verify workspace ownership
		const { data: workspace } = await event.locals.supabase
			.from('workspaces')
			.select('id')
			.eq('id', workspaceId)
			.eq('user_id', user.id)
			.single();

		if (!workspace) {
			return json({ error: 'Workspace not found' }, { status: 404 });
		}

		const { error } = await event.locals.supabase
			.from('workspace_messages')
			.delete()
			.eq('workspace_id', workspaceId);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
