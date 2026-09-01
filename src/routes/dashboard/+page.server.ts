import type { PageServerLoad } from './$types';
import { principalHasRole } from '$lib/server/principal';
import type { CatalogListQuery, components } from '@purveyors/sdk';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { listActiveSourcingBriefs } from '$lib/server/parchmentProcurement';
import { extractParchmentCatalogRows } from '$lib/server/parchmentCatalog';
import {
	describeSourcingBriefCriteria,
	type SourcingBriefCriteria
} from '$lib/procurement/sourcingBriefPresentation';

export type DashboardBriefSummary = {
	id: string;
	name: string;
	criteriaDescription: string;
	catalogHref: string;
};

type SdkCatalogItem = components['schemas']['CatalogItem'];

const DASHBOARD_ARRIVALS_QUERY: CatalogListQuery = {
	stocked: 'true',
	sort: 'arrival_date',
	order: 'desc',
	limit: 6
};

function briefCatalogHref(criteria: SourcingBriefCriteria): string {
	const params = new URLSearchParams();
	if (criteria.country) params.set('country', criteria.country);
	if (criteria.region) params.set('region', criteria.region);
	if (criteria.processing) params.set('processing', criteria.processing);
	if (criteria.processing_base_method) {
		params.set('processing_base_method', criteria.processing_base_method);
	}
	if (criteria.max_price_per_lb !== undefined) {
		params.set('price_per_lb_max', String(criteria.max_price_per_lb));
	}
	if (criteria.stocked_days !== undefined) {
		params.set('stocked_days', String(criteria.stocked_days));
	}
	if (criteria.wholesale_only) params.set('wholesaleOnly', 'true');
	const query = params.toString();
	return query ? `/catalog?${query}` : '/catalog';
}

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	const userId = locals.principal.isAuthenticated ? locals.principal.userId : null;
	const isMember = principalHasRole(locals.principal, 'member');
	const hasSourcingAccess =
		isMember || (locals.principal.isAuthenticated && locals.principal.ppiAccess === true);

	// One request-bound Parchment API client feeds the public arrivals preview
	// and the gated tracked-lot summaries below.
	const parchmentClientPromise = createParchmentServerClient(event);

	const arrivalsPromise = parchmentClientPromise
		.then(async (client) =>
			extractParchmentCatalogRows(await client.catalog.list(DASHBOARD_ARRIVALS_QUERY))
		)
		.catch((error) => {
			console.error('Error loading dashboard arrivals preview:', error);
			return [] as SdkCatalogItem[];
		});

	// Compact summaries carry the price and availability changes the dashboard
	// needs. Full catalog detail remains on the canonical catalog route.
	const trackedPromise: Promise<TrackedLotSummary[]> =
		userId && hasSourcingAccess
			? parchmentClientPromise
					.then((client) => getTrackedLotSummaries(client, 12))
					.catch((error) => {
						console.error('Error loading dashboard watchlist:', error);
						return [] as TrackedLotSummary[];
					})
			: Promise.resolve([] as TrackedLotSummary[]);

	const briefsPromise =
		userId && hasSourcingAccess
			? parchmentClientPromise
					.then((client) => listActiveSourcingBriefs(client, 5))
					.catch((error) => {
						console.error('Error loading dashboard briefs:', error);
						return [];
					})
			: Promise.resolve([]);

	const [arrivalsResult, trackedLots, briefRows] = await Promise.all([
		arrivalsPromise,
		trackedPromise,
		briefsPromise
	]);

	const recentArrivals = arrivalsResult as unknown as Record<string, unknown>[];
	const activeBriefs: DashboardBriefSummary[] = briefRows.map((brief) => ({
		id: brief.id,
		name: brief.name,
		criteriaDescription: describeSourcingBriefCriteria(brief.criteria),
		catalogHref: briefCatalogHref(brief.criteria)
	}));

	return {
		recentArrivals,
		trackedLots,
		activeBriefs
	};
};
