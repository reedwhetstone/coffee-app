import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// PUT /api/workspaces/[id]/canvas - Persist canvas state
export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireMemberRole(event);
		const workspaceId = event.params.id;
		const body = await event.request.json();

		const { error } = await event.locals.supabase
			.from('workspaces')
			.update({
				canvas_state: body.canvas_state || {},
				last_accessed_at: new Date().toISOString()
			})
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
