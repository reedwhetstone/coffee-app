import type { RequestHandler } from './$types';

import {
	guardBrowserBffRequest,
	parchmentUnavailableResponse,
	relayParchmentResult
} from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

type PreferenceMethod = 'signup' | 'account' | 'unsubscribe';

async function updatePreference(
	event: Parameters<RequestHandler>[0],
	method: PreferenceMethod
): Promise<Response> {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true });
	if (guardResponse) return guardResponse;

	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		const body =
			method === 'unsubscribe'
				? ({ subscribed: false } as const)
				: ({
						subscribed: true,
						consentSource: method === 'signup' ? 'signup' : 'account_settings'
					} as const);

		return relayParchmentResult(await client.emailSubscriptions.setMarketRead(body));
	} catch (error) {
		console.error('Market Wire preference BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
}

/** Marketing-page opt-in. Consent provenance is fixed by the server route. */
export const POST: RequestHandler = (event) => updatePreference(event, 'signup');

/** Account-settings opt-in. Consent provenance is fixed by the server route. */
export const PUT: RequestHandler = (event) => updatePreference(event, 'account');

/** Account-owned opt-out. No consent provenance is accepted from the browser. */
export const DELETE: RequestHandler = (event) => updatePreference(event, 'unsubscribe');
