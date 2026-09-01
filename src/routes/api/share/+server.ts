import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'node:crypto';
import { isCookieSessionPrincipal } from '$lib/server/principal';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	createParchmentInventoryShareGrant,
	ParchmentShareError
} from '$lib/server/parchmentShares';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_POSTGRES_INTEGER = 2_147_483_647;

function parseExpiresInDays(value: unknown): number | null {
	if (value === undefined) return 7;
	const normalized =
		typeof value === 'string' && /^\d+d?$/.test(value) ? parseInt(value, 10) : value;
	return typeof normalized === 'number' &&
		Number.isInteger(normalized) &&
		normalized >= 1 &&
		normalized <= 30
		? normalized
		: null;
}

function parseScope(resourceId: unknown) {
	if (resourceId === 'all') return { type: 'all' as const };
	const parsed =
		typeof resourceId === 'number'
			? resourceId
			: typeof resourceId === 'string' && /^\d+$/.test(resourceId)
				? Number(resourceId)
				: NaN;
	return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_POSTGRES_INTEGER
		? { type: 'inventory' as const, inventoryId: parsed }
		: null;
}

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	try {
		if (!isCookieSessionPrincipal(locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
		}

		const body = await request.json();
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return json({ error: 'Invalid share request' }, { status: 400, headers: NO_STORE });
		}
		const input = body as Record<string, unknown>;
		const scope = parseScope(input.resourceId);
		const expiresInDays = parseExpiresInDays(input.expiresIn);
		if (!scope || expiresInDays === null) {
			return json({ error: 'Invalid share request' }, { status: 400, headers: NO_STORE });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const grant = await createParchmentInventoryShareGrant(client, {
			operationId: crypto.randomUUID(),
			scope,
			expiresInDays
		});
		const origin = new URL(request.url).origin;

		return json(
			{ shareUrl: `${origin}/beans?share=${encodeURIComponent(grant.token)}` },
			{ headers: NO_STORE }
		);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid share request' }, { status: 400, headers: NO_STORE });
		}
		if (error instanceof ParchmentShareError) {
			return json(
				{
					error: error.status === 404 ? 'Bean not found or unauthorized' : error.message
				},
				{ status: error.status, headers: NO_STORE }
			);
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Share links are temporarily unavailable' },
				{ status: 503, headers: NO_STORE }
			);
		}
		console.error('Error creating share link:', error);
		return json({ error: 'Failed to create share link' }, { status: 500, headers: NO_STORE });
	}
};
