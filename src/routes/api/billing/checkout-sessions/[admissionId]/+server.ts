import type { RequestHandler } from './$types';

import {
	guardBrowserBffRequest,
	parchmentUnavailableResponse,
	relayParchmentResult
} from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

async function checkoutClient(event: Parameters<RequestHandler>[0]) {
	return createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
}

export const GET: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event);
	if (guardResponse) return guardResponse;

	try {
		const client = await checkoutClient(event);
		return relayParchmentResult(await client.billing.checkout.get(event.params.admissionId));
	} catch (error) {
		console.error('Billing Checkout status BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};

export const POST: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true });
	if (guardResponse) return guardResponse;

	try {
		const client = await checkoutClient(event);
		return relayParchmentResult(await client.billing.checkout.reconcile(event.params.admissionId));
	} catch (error) {
		console.error('Billing Checkout reconciliation BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};
