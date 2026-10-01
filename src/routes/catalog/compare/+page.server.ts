import type { PageServerLoad } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import type { CatalogComparison, CompareLoadState } from '$lib/catalog/compareTypes';

const QUANTITY_OPTIONS = [1, 5, 10, 25, 50, 100];

// Parchment owns comparison logic and access limits (viewers 2, members and
// Intelligence 6). Uses the raw path until coffee-app consumes the SDK release
// that adds client.catalog.compare.
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
			const get = client.raw.GET as unknown as (
				path: string,
				options: { params: { query: Record<string, string> } }
			) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
			const { data, error, response } = await get('/v1/catalog/compare', {
				params: { query: { ids: ids.join(','), quantityLbs: String(quantityLbs) } }
			});
			const message =
				(error as { error?: { message?: string } } | undefined)?.error?.message ??
				'Comparison is unavailable right now.';
			if (response.status === 200 && data) {
				const body = data as { data: CatalogComparison; meta: { maxLots: number } };
				state = { status: 'ready', comparison: body.data, maxLots: body.meta.maxLots };
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
