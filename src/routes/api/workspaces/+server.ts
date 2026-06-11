import { json } from '@sveltejs/kit';
import { requireChatAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// GET /api/workspaces - List user's workspaces
export const GET: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.select('id, title, type, context_summary, last_accessed_at, created_at')
			.eq('user_id', user.id)
			.order('last_accessed_at', { ascending: false })
			.limit(1);

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspaces: data || [] });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};

// POST /api/workspaces - Get or create the user's single chat workspace
export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireChatAccess(event);
		const body = await event.request.json().catch(() => ({}));
		const selection =
			'id, title, type, context_summary, canvas_state, last_accessed_at, created_at';

		const { data: existing, error: existingError } = await event.locals.supabase
			.from('workspaces')
			.select(selection)
			.eq('user_id', user.id)
			.order('last_accessed_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (existingError) {
			return json({ error: existingError.message }, { status: 500 });
		}

		if (existing) {
			return json({ workspace: existing });
		}

		const { data, error } = await event.locals.supabase
			.from('workspaces')
			.insert({
				user_id: user.id,
				title: body.title || 'Coffee',
				type: body.type || 'general'
			})
			.select(selection)
			.single();

		if (error) {
			// Race-safe fallback for the one-workspace-per-user constraint.
			if (error.code === '23505') {
				const { data: racedExisting, error: racedError } = await event.locals.supabase
					.from('workspaces')
					.select(selection)
					.eq('user_id', user.id)
					.order('last_accessed_at', { ascending: false })
					.limit(1)
					.maybeSingle();
				if (racedError) return json({ error: racedError.message }, { status: 500 });
				if (racedExisting) return json({ workspace: racedExisting });
			}
			return json({ error: error.message }, { status: 500 });
		}

		return json({ workspace: data }, { status: 201 });
	} catch (err) {
		const status = (err as { status?: number }).status || 500;
		return json({ error: (err as Error).message }, { status });
	}
};
