import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// GET /api/workspaces - List user's workspaces
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.select('id, title, type, context_summary, last_accessed_at, created_at')
			.eq('user_id', user.id)
			.order('last_accessed_at', { ascending: false });

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspaces: data || [] });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// POST /api/workspaces - Create a new workspace
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const body = await event.request.json();

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.insert({
				user_id: user.id,
				title: body.title || 'New Workspace',
				type: body.type || 'general'
			})
			.select('id, title, type, context_summary, canvas_state, last_accessed_at, created_at')
			.single();

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspace: data }, { status: 201 });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
