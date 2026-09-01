import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	createParchmentRoasts,
	deleteParchmentRoast,
	deleteParchmentRoastBatch,
	ParchmentRoastMutationError,
	updateParchmentRoast,
	type LegacyRoastCreateInput
} from '$lib/server/parchmentRoastMutations';
import { fetchParchmentRoasts } from '$lib/server/parchmentRoasts';
import { isCookieSessionPrincipal, isTrustedMutationRequest } from '$lib/server/principal';

function mutationAuthFailure(event: RequestEvent) {
	if (!isCookieSessionPrincipal(event.locals.principal)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isTrustedMutationRequest(event, event.locals.principal)) {
		return json({ error: 'Cross-site session mutation blocked' }, { status: 403 });
	}
	return null;
}

function parsePositiveInteger(value: string | null): number | null {
	if (value === null || !/^\d+$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function legacyParchmentError(body: unknown): { error: string; code?: string } {
	if (typeof body !== 'object' || body === null) {
		return { error: 'Parchment roast request failed' };
	}

	const nested = 'error' in body && typeof body.error === 'object' ? body.error : null;
	if (nested !== null) {
		const message =
			'message' in nested && typeof nested.message === 'string'
				? nested.message
				: 'Parchment roast request failed';
		const code = 'code' in nested && typeof nested.code === 'string' ? nested.code : undefined;
		return code ? { error: message, code } : { error: message };
	}

	return {
		error:
			'message' in body && typeof body.message === 'string'
				? body.message
				: 'Parchment roast request failed'
	};
}

function mutationFailure(error: ParchmentRoastMutationError) {
	return json(legacyParchmentError(error.body), { status: error.status });
}

function configFailure() {
	return json({ error: 'Roast mutations are temporarily unavailable' }, { status: 503 });
}

export const GET: RequestHandler = async (event) => {
	try {
		if (!isCookieSessionPrincipal(event.locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = await fetchParchmentRoasts(client);
		return json({ data });
	} catch (error) {
		console.error('Error fetching roast profiles:', error);
		return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event);
		if (authFailure) return authFailure;

		const body = (await event.request.json()) as LegacyRoastCreateInput;
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return json({ error: 'Invalid roast profile request' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim() || undefined;
		const result = await createParchmentRoasts(client, body, idempotencyKey);

		if (result.isBatch) {
			return json({
				profiles: result.profiles,
				roast_ids: result.profiles.map((profile) => profile.roast_id)
			});
		}
		return json(result.profiles);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid roast profile request' }, { status: 400 });
		}
		if (error instanceof ParchmentRoastMutationError) return mutationFailure(error);
		if (error instanceof ParchmentConfigError) return configFailure();
		console.error('Error creating roast profiles:', error);
		return json({ error: 'Failed to create roast profiles' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event);
		if (authFailure) return authFailure;

		const rawId = event.url.searchParams.get('id');
		const batchName = event.url.searchParams.get('name');
		const client = await createParchmentServerClient(event, { mode: 'session' });

		if (rawId !== null) {
			const id = parsePositiveInteger(rawId);
			if (id === null) return json({ error: 'A positive roast ID is required' }, { status: 400 });
			await deleteParchmentRoast(client, id);
		} else if (batchName !== null) {
			await deleteParchmentRoastBatch(client, batchName);
		} else {
			return json({ error: 'No ID or batch name provided' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		if (error instanceof ParchmentRoastMutationError) return mutationFailure(error);
		if (error instanceof ParchmentConfigError) return configFailure();
		console.error('Error deleting roast profile(s):', error);
		return json({ error: 'Failed to delete roast profile(s)' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event);
		if (authFailure) return authFailure;

		const id = parsePositiveInteger(event.url.searchParams.get('id'));
		if (id === null) {
			return json({ error: 'A positive roast ID is required' }, { status: 400 });
		}

		const body = (await event.request.json()) as Record<string, unknown>;
		if (typeof body !== 'object' || body === null || Array.isArray(body)) {
			return json({ error: 'Invalid roast profile request' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const ifMatch = event.request.headers.get('if-match')?.trim() || undefined;
		const profile = await updateParchmentRoast(client, id, body, ifMatch);
		return json(profile);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid roast profile request' }, { status: 400 });
		}
		if (error instanceof ParchmentRoastMutationError) return mutationFailure(error);
		if (error instanceof ParchmentConfigError) return configFailure();
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
