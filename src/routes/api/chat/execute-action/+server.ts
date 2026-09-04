import type { ConfirmedActionExecuteRequest } from '@purveyors/sdk';
import type { RequestHandler } from './$types';
import { browserBffResponse, guardBrowserBffRequest } from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

function legacyErrorMessage(body: unknown): string {
	if (typeof body !== 'object' || body === null) return 'Action execution failed';

	const nested = 'error' in body && typeof body.error === 'object' ? body.error : null;
	if (nested && 'message' in nested && typeof nested.message === 'string') {
		return nested.message;
	}
	if ('message' in body && typeof body.message === 'string') return body.message;
	return 'Action execution failed';
}

export const POST: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true, jsonBody: true });
	if (guardResponse) return guardResponse;

	try {
		const body = (await event.request.json()) as unknown;
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return browserBffResponse(400, { error: 'Invalid action request' });
		}

		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		const result = await client.confirmedActions.execute(body as ConfirmedActionExecuteRequest);

		if (result.error !== undefined) {
			return browserBffResponse(result.response?.status ?? 502, {
				error: legacyErrorMessage(result.error)
			});
		}
		if (!result.data?.data) {
			return browserBffResponse(502, { error: 'Action execution failed' });
		}

		return browserBffResponse(result.response?.status ?? 200, result.data.data);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return browserBffResponse(400, { error: 'Invalid action request' });
		}
		if (error instanceof ParchmentConfigError) {
			return browserBffResponse(503, { error: 'Action execution is temporarily unavailable' });
		}
		console.error('Confirmed-action BFF request failed');
		return browserBffResponse(502, { error: 'Action execution failed' });
	}
};
