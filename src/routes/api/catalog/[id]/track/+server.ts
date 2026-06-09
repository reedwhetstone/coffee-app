import { json } from '@sveltejs/kit';
import { AuthError, requireParchmentAccess } from '$lib/server/auth';
import { toggleTrackedLot } from '$lib/server/trackedLots';
import type { RequestEvent } from '@sveltejs/kit';

export const PUT = async (event: RequestEvent) => {
	try {
		const { user } = await requireParchmentAccess(event);
		const catalogId = parseInt(event.params.id, 10);

		if (!Number.isFinite(catalogId) || catalogId <= 0) {
			return json({ error: 'Invalid catalog ID' }, { status: 400 });
		}

		const result = await toggleTrackedLot(event.locals.supabase, user.id, catalogId);
		return json(result);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		return json({ error: 'Failed to update tracking' }, { status: 500 });
	}
};
