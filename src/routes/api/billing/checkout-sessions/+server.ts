import type { BillingCheckoutCreateRequest } from '@purveyors/sdk';
import type { RequestHandler } from './$types';

import {
	guardBrowserBffRequest,
	invalidJsonResponse,
	parchmentUnavailableResponse,
	relayParchmentResult
} from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

export const POST: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true, jsonBody: true });
	if (guardResponse) return guardResponse;

	let requestBody: unknown;
	try {
		requestBody = await event.request.json();
	} catch {
		return invalidJsonResponse();
	}
	if (typeof requestBody !== 'object' || requestBody === null) return invalidJsonResponse();
	const body = requestBody as BillingCheckoutCreateRequest;

	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		return relayParchmentResult(
			await client.billing.checkout.create({
				requestId: body.requestId,
				purchaseItems: body.purchaseItems
			})
		);
	} catch (error) {
		console.error('Billing Checkout BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};
