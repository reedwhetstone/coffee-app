import type { PageServerLoad } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import type { CompareLoadState } from '$lib/catalog/compareTypes';

const QUANTITY_OPTIONS = [1, 5, 10, 25, 50, 100];

// Parchment owns comparison logic and access limits (viewers 2, members and
// Intelligence 6).
export const load: PageServerLoad = async (event) => {
	const ids = (event.url.searchParams.get('ids') ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter((part) => /^\d+$/.test(part));
	const quantityRaw = Number(event.url.searchParams.get('quantityLbs') ?? '1');
	const quantityLbs = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
	const meta = { title: 'Compare coffees | Purveyors', robots: 'noindex' };

	let state: CompareLoadState;
	if (new Set(ids).size < 2) {
		state = { status: 'empty' };
	} else if (!event.locals.principal?.isAuthenticated) {
		state = { status: 'sign_in' };
	} else {
		try {
			const client = await createParchmentServerClient(event, { mode: 'session' });
			const { data, error, response } = await client.catalog.compare({
				ids: ids.join(','),
				quantityLbs: String(quantityLbs)
			});
			// An upstream failure outside the documented error shape has no message.
			const message = error?.error?.message ?? 'Comparison is unavailable right now.';
			if (response.status === 200 && data) {
				// Parchment drops ids the caller can no longer see; fewer than two
				// visible coffees is not a comparison.
				state =
					data.data.lots.length >= 2
						? { status: 'ready', comparison: data.data, maxLots: data.meta.maxLots }
						: { status: 'empty', unavailable: data.data.missingIds.length };
			} else if (response.status === 401) {
				state = { status: 'sign_in' };
			} else if (response.status === 403) {
				state = { status: 'limit', message };
			} else {
				state = { status: 'error', message };
			}
		} catch (error) {
			console.error(
				'Catalog comparison failed:',
				error instanceof Error ? error.message : String(error)
			);
			state = { status: 'error', message: 'Comparison is unavailable right now.' };
		}
	}

	return { state, ids: ids.map(Number), quantityLbs, quantityOptions: QUANTITY_OPTIONS, meta };
};
