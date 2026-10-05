import type { PageServerLoad } from './$types';
import type { RoastProfile } from '$lib/types/component.types';
import { loadProductPageData } from '$lib/server/productPageData';
import { principalHasRole } from '$lib/server/principal';

export const load = (({ fetch, locals }) => {
	// The guard in hooks.server.ts lets a signed-in account without Mallard Studio read this
	// page and no other under `/roast`. It gets the locked page: no roast request is made and
	// no roast data is sent, whatever the query string asks for.
	if (!principalHasRole(locals.principal, 'member')) {
		return { roastsLocked: true as const };
	}

	return {
		roastsLocked: false as const,
		initialRoasts: loadProductPageData<{ data: RoastProfile[] }>(fetch, '/api/roast-profiles')
	};
}) satisfies PageServerLoad;
