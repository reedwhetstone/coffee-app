import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

/**
 * Clear import-derived roast telemetry through the canonical Parchment API.
 *
 * The dashboard keeps this same-origin route for browser ergonomics, but the
 * mutation boundary now lives at DELETE /v1/roasts/{id}/artisan-import. Session
 * mode forwards the user's Supabase JWT to Parchment, where ownership and
 * roast:write are enforced consistently with Artisan import.
 */
export const DELETE: RequestHandler = async (event) => {
	const { url, locals } = event;
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const roastId = url.searchParams.get('roast_id');
		if (!roastId) {
			return json({ error: 'No roast_id provided' }, { status: 400 });
		}

		// Require a canonical positive integer. parseInt would coerce values like
		// "42abc" or "42.9" to 42 and forward a clear for the wrong roast on this
		// destructive route, so reject anything that is not entirely digits.
		const rawId = roastId.trim();
		const parsedId = Number(rawId);
		if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(parsedId) || parsedId <= 0) {
			return json({ error: 'Invalid roast ID' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.roasts.clearArtisanImport(parsedId);

		if (error || !data) {
			return json(
				{ error: error?.error?.message || 'Failed to clear roast data' },
				{ status: response?.status ?? 500 }
			);
		}

		const { deletedCounts, batchName } = data.data;
		const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

		return json({
			success: true,
			message: `Successfully cleared roast data. Deleted ${totalDeleted} total records.`,
			deleted_counts: deletedCounts,
			batch_name: batchName
		});
	} catch (error) {
		console.error('Error clearing roast data:', error);

		if (error instanceof ParchmentConfigError) {
			return json({ error: 'Clear roast is temporarily unavailable' }, { status: 503 });
		}

		return json({ error: 'Failed to clear roast data' }, { status: 500 });
	}
};
