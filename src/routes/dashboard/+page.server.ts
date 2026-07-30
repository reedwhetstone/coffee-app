import type { PageServerLoad } from './$types';
import { principalHasRole } from '$lib/server/principal';
import type { CatalogListQuery, components } from '@purveyors/sdk';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { listActiveSourcingBriefs } from '$lib/server/parchmentProcurement';
import {
	extractParchmentCatalogRows,
	fetchParchmentCatalogItemsByIds
} from '$lib/server/parchmentCatalog';
import {
	describeSourcingBriefCriteria,
	validateSourcingBriefCriteria,
	type SourcingBriefCriteria
} from '$lib/procurement/sourcingBriefCriteria';

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

	// One request-bound Parchment client feeds both the public arrivals preview
	// and the gated tracked-lot catalog hydration below.
	const parchmentClientPromise = createParchmentServerClient(event);

	const arrivalsPromise = parchmentClientPromise
		.then(async (client) =>
			extractParchmentCatalogRows(await client.catalog.list(DASHBOARD_ARRIVALS_QUERY))
		)
		.catch((error) => {
			console.error('Error loading dashboard arrivals preview:', error);
			return [] as SdkCatalogItem[];
		});

	// Summaries carry tracking context (status/delta); the full catalog rows let the
	// dashboard render CoffeeCards whose detail panels open in place.
	const trackedPromise: Promise<{
		summaries: TrackedLotSummary[];
		catalog: Record<string, unknown>[];
	}> =
		userId && hasSourcingAccess
			? parchmentClientPromise
					.then((client) => getTrackedLotSummaries(client, 12))
					.then(async (summaries) => ({
						summaries,
						catalog: (await fetchParchmentCatalogItemsByIds(
							await parchmentClientPromise,
							summaries.map((lot) => lot.catalogId)
						)) as unknown as Record<string, unknown>[]
					}))
					.catch((error) => {
						console.error('Error loading dashboard watchlist:', error);
						return { summaries: [] as TrackedLotSummary[], catalog: [] };
					})
			: Promise.resolve({ summaries: [] as TrackedLotSummary[], catalog: [] });

	const briefsPromise =
		userId && isMember
			? parchmentClientPromise
					.then((client) => listActiveSourcingBriefs(client, 5))
					.catch((error) => {
						console.error('Error loading dashboard briefs:', error);
						return [];
					})
			: Promise.resolve([]);

	const [arrivalsResult, trackedResult, briefRows] = await Promise.all([
		arrivalsPromise,
		trackedPromise,
		briefsPromise
	]);

	const recentArrivals = arrivalsResult as unknown as Record<string, unknown>[];
	const activeBriefs: DashboardBriefSummary[] = briefRows.flatMap((brief) => {
		try {
			const criteria = validateSourcingBriefCriteria(brief.criteria);
			return [
				{
					id: brief.id,
					name: brief.name,
					criteriaDescription: describeSourcingBriefCriteria(criteria),
					catalogHref: briefCatalogHref(criteria)
				}
			];
		} catch {
			return [];
		}
	});

	return {
		recentArrivals,
		trackedLots: trackedResult.summaries,
		trackedCatalog: trackedResult.catalog,
		activeBriefs
	};
};
