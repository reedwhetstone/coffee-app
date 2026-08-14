import type { BillingSubscriptionMutationRequest } from '@purveyors/sdk';
import type { RequestHandler } from './$types';

import {
	guardBrowserBffRequest,
	invalidJsonResponse,
	parchmentUnavailableResponse,
	relayParchmentResult
} from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

export const PATCH: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true, jsonBody: true });
	if (guardResponse) return guardResponse;

	let requestBody: unknown;
	try {
		requestBody = await event.request.json();
	} catch {
		return invalidJsonResponse();
	}
	if (typeof requestBody !== 'object' || requestBody === null) return invalidJsonResponse();
	const body = requestBody as BillingSubscriptionMutationRequest;

	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		return relayParchmentResult(
			await client.billing.subscriptions.mutate(event.params.subscriptionId, {
				requestId: body.requestId,
				cancelAtPeriodEnd: body.cancelAtPeriodEnd
			})
		);
	} catch (error) {
		console.error('Billing subscription BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};
