import { redirect } from '@sveltejs/kit';
import { loadMarketReadPreference } from '$lib/server/marketWireSubscription';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!isCookieSessionPrincipal(event.locals.principal)) {
		throw redirect(303, '/auth?next=/account');
	}
	const preferenceState = await loadMarketReadPreference(event);

	return {
		email: event.locals.principal.user.email ?? '',
		marketReadPreference: preferenceState.preference,
		marketReadError: preferenceState.error
	};
};
