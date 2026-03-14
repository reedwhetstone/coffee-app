import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearRoastData } from '$lib/data/roast.js';

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const roastId = url.searchParams.get('roast_id');
		if (!roastId) {
			return json({ error: 'No roast_id provided' }, { status: 400 });
		}

		// Verify ownership of the roast profile before clearing
		const { data: profile } = (await supabase
			.from('roast_profiles')
			.select('user, batch_name')
			.eq('roast_id', Number(roastId))
			.single()) as { data: { user: string; batch_name: string | null } | null; error: unknown };

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const parsedId = parseInt(roastId, 10);

		// Full clear: deletes artisan_import_log + temps + events, resets Artisan fields
		const result = await clearRoastData(supabase, parsedId);

		const totalDeleted = Object.values(result.deleted_counts).reduce(
			(sum, count) => sum + count,
			0
		);

		return json({
			success: true,
			message: `Successfully cleared roast data. Deleted ${totalDeleted} total records.`,
			deleted_counts: result.deleted_counts,
			batch_name: result.batch_name
		});
	} catch (error) {
		console.error('Error clearing roast data:', error);
		return json({ error: 'Failed to clear roast data' }, { status: 500 });
	}
};
