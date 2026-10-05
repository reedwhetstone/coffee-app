import { json } from '@sveltejs/kit';
import { principalHasRole, type RequestPrincipal } from '$lib/server/principal';

export const ROAST_STUDIO_REQUIRED_MESSAGE =
	'Mallard Studio membership is required for roast logging';

/**
 * Roast logging is part of Mallard Studio. Every roast route checks the member role itself,
 * so the rule holds for a direct request as it does for the roast page. Returns the 403 for
 * an account without it, and null for a member or an admin.
 */
export function roastStudioFailure(principal: RequestPrincipal): Response | null {
	if (principalHasRole(principal, 'member')) return null;
	return json({ error: ROAST_STUDIO_REQUIRED_MESSAGE }, { status: 403 });
}
