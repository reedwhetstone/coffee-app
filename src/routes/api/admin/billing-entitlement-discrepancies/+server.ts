import type { RequestHandler } from './$types';

import { validateAdminAccess } from '$lib/server/auth';
import {
	browserBffResponse,
	guardBrowserBffRequest,
	invalidJsonResponse,
	parchmentUnavailableResponse,
	relayParchmentResult
} from '$lib/server/browserBff';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

async function requireAdmin(event: Parameters<RequestHandler>[0]): Promise<Response | null> {
	try {
		await validateAdminAccess(event);
		return null;
	} catch (error) {
		const authError = error as { status?: number; message?: string };
		return browserBffResponse(authError.status === 403 ? 403 : 401, {
			error: {
				code: authError.status === 403 ? 'admin_required' : 'session_required',
				message: authError.message ?? 'Administrator access is required.'
			}
		});
	}
}

async function adminClient(event: Parameters<RequestHandler>[0]) {
	return createParchmentServerClient(event, {
		mode: 'session',
		preferHandling: 'inherit'
	});
}

export const GET: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event);
	if (guardResponse) return guardResponse;
	const adminResponse = await requireAdmin(event);
	if (adminResponse) return adminResponse;

	try {
		const client = await adminClient(event);
		return relayParchmentResult(await client.billingAdministration.discrepancies());
	} catch (error) {
		console.error('Billing administration discrepancy BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};

export const POST: RequestHandler = async (event) => {
	const guardResponse = guardBrowserBffRequest(event, { mutation: true, jsonBody: true });
	if (guardResponse) return guardResponse;
	const adminResponse = await requireAdmin(event);
	if (adminResponse) return adminResponse;

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return invalidJsonResponse();
	}

	const ownerId =
		typeof body === 'object' && body !== null && 'ownerId' in body
			? (body as { ownerId?: unknown }).ownerId
			: undefined;
	if (typeof ownerId !== 'string' || ownerId.trim().length === 0) {
		return browserBffResponse(400, {
			error: { code: 'invalid_request', message: 'Missing or invalid ownerId.' }
		});
	}

	try {
		const client = await adminClient(event);
		return relayParchmentResult(await client.billingAdministration.recompute(ownerId));
	} catch (error) {
		console.error('Billing administration recompute BFF request failed');
		return parchmentUnavailableResponse(error instanceof ParchmentConfigError ? 503 : 502);
	}
};
