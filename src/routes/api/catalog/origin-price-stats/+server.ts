import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveCatalogVisibility } from '$lib/server/catalogVisibility';
import { loadCatalogOriginPriceStats } from '$lib/server/catalogOriginPriceStats';

export const GET: RequestHandler = async ({ locals, url }) => {
	const visibility = resolveCatalogVisibility({
		session: locals.session,
		role: locals.role,
		showWholesaleRequested: url.searchParams.get('showWholesale') === 'true',
		wholesaleOnlyRequested: url.searchParams.get('wholesaleOnly') === 'true'
	});

	const originPriceStats = await loadCatalogOriginPriceStats(locals.supabase, visibility);

	return json({
		originPriceStats,
		meta: {
			access: {
				publicOnly: visibility.publicOnly,
				showWholesale: visibility.showWholesale,
				wholesaleOnly: visibility.wholesaleOnly
			}
		}
	});
};
