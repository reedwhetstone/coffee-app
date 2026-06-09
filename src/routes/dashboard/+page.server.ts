import type { PageServerLoad } from './$types';
import { searchCatalog } from '$lib/data/catalog';
import { getTrackedLotSummaries, type TrackedLotSummary } from '$lib/server/trackedLots';
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

function briefCatalogHref(criteria: SourcingBriefCriteria): string {
	const params = new URLSearchParams();
	if (criteria.country) params.set('country', criteria.country);
	if (criteria.processing) params.set('processing', criteria.processing);
	if (criteria.processing_base_method) {
		params.set('processing_base_method', criteria.processing_base_method);
	}
	if (criteria.wholesale_only) params.set('wholesaleOnly', 'true');
	const query = params.toString();
	return query ? `/catalog?${query}` : '/catalog';
}

export const load: PageServerLoad = async ({ locals }) => {
	let recentArrivals: Record<string, unknown>[] = [];

	try {
		const result = await searchCatalog(locals.supabase, {
			stockedOnly: true,
			orderBy: 'arrival_date',
			orderDirection: 'desc',
			limit: 6
		});
		recentArrivals = result.data as unknown as Record<string, unknown>[];
	} catch (error) {
		console.error('Error loading dashboard arrivals preview:', error);
	}

	const userId = locals.principal?.isAuthenticated ? locals.principal.userId : null;
	const isMember = locals.role === 'member' || locals.role === 'admin';
	const hasSourcingAccess =
		isMember || (locals.principal?.isAuthenticated === true && locals.principal.ppiAccess === true);

	let trackedLots: TrackedLotSummary[] = [];
	let activeBriefs: DashboardBriefSummary[] = [];

	if (userId && hasSourcingAccess) {
		try {
			const [tracked, briefRows] = await Promise.all([
				getTrackedLotSummaries(locals.supabase, userId, 12),
				isMember
					? locals.supabase
							.from('sourcing_briefs')
							.select('id, name, criteria')
							.eq('user_id', userId)
							.eq('is_active', true)
							.order('created_at', { ascending: false })
							.limit(5)
					: Promise.resolve({ data: null })
			]);
			trackedLots = tracked;
			activeBriefs = (
				(briefRows.data ?? []) as Array<{ id: string; name: string; criteria: unknown }>
			).flatMap((brief) => {
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
		} catch (error) {
			console.error('Error loading dashboard sourcing context:', error);
		}
	}

	return {
		recentArrivals,
		trackedLots,
		activeBriefs
	};
};
