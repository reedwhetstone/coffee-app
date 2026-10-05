import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthError, requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchParchmentInventoryChoices } from '$lib/server/parchmentInventory';

/**
 * The member's portfolio coffees, as the choices in the roast list's coffee control. It reads
 * the portfolio only, so opening the roast list does not read the member's roast history.
 * Internal to the first-party app.
 */
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		return json({ data: await fetchParchmentInventoryChoices(client) });
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		console.error('Error loading the coffees to choose from:', error);
		return json({ error: 'Unable to load coffees' }, { status: 500 });
	}
};
