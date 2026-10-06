import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { roastStudioFailure } from '$lib/server/roastAccess';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	createParchmentRoasts,
	deleteParchmentRoast,
	ParchmentRoastMutationError,
	updateParchmentRoast,
	type LegacyRoastCreateInput
} from '$lib/server/parchmentRoastMutations';
import {
	fetchParchmentRoastList,
	fetchParchmentRoastPage,
	ParchmentRoastListError,
	ROAST_PAGE_LIMIT,
	type RoastListFilter
} from '$lib/server/parchmentRoasts';
import { parseBatchId } from '$lib/roast/roast-batches';
import { parseRoastDay } from '$lib/roast/roast-list-filters';
import { isCookieSessionPrincipal, isTrustedMutationRequest } from '$lib/server/principal';

function mutationAuthFailure(event: RequestEvent) {
	if (!isCookieSessionPrincipal(event.locals.principal)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isTrustedMutationRequest(event, event.locals.principal)) {
		return json({ error: 'Cross-site session mutation blocked' }, { status: 403 });
	}
	return roastStudioFailure(event.locals.principal);
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

// Roast and inventory IDs are 32-bit integers in Parchment.
const MAX_ROW_ID = 2_147_483_647;

function parseRowId(value: string): number | null {
	const id = parsePositiveInteger(value);
	return id !== null && id <= MAX_ROW_ID ? id : null;
}

function invalid(message: string) {
	return json({ error: message }, { status: 400 });
}

/**
 * Read the roast list filters from the query. Each is optional and they narrow together.
 * Returns a 400 response for a value that cannot be read, so nothing malformed is sent on.
 */
function readRoastListFilter(params: URLSearchParams): RoastListFilter | Response {
	const filter: RoastListFilter = {};

	// `?coffee_id=<inventory id>` narrows the list to one portfolio coffee's roasts.
	const coffeeParam = params.get('coffee_id');
	if (coffeeParam !== null) {
		const coffeeId = parseRowId(coffeeParam);
		if (coffeeId === null) return invalid('Invalid coffee id');
		filter.coffeeId = coffeeId;
	}

	const roastParam = params.get('roast_id');
	if (roastParam !== null) {
		const roastId = parseRowId(roastParam);
		if (roastId === null) return invalid('Invalid roast id');
		filter.roastId = roastId;
	}

	const batchParam = params.get('batch_id');
	if (batchParam !== null) {
		const batchId = parseBatchId(batchParam);
		if (batchId === null) return invalid('Invalid batch id');
		filter.batchId = batchId;
	}

	for (const [name, key] of [
		['date_start', 'dateStart'],
		['date_end', 'dateEnd']
	] as const) {
		const param = params.get(name);
		if (param === null) continue;
		const day = parseRoastDay(param);
		if (day === null) return invalid('Invalid date');
		filter[key] = day;
	}

	// One search term. Parchment owns the rules for what a term may hold.
	const q = params.get('q')?.trim();
	if (q) filter.q = q;

	const wholesale = params.get('is_wholesale');
	if (wholesale !== null) {
		if (wholesale !== 'true' && wholesale !== 'false') return invalid('Invalid wholesale filter');
		filter.isWholesale = wholesale === 'true';
	}

	return filter;
}

/** `limit` and `offset` name one page. With neither, every roast the filters match is returned. */
function readRoastListPage(
	params: URLSearchParams
): { limit: number; offset: number } | null | Response {
	const limitParam = params.get('limit');
	const offsetParam = params.get('offset');
	if (limitParam === null) {
		return offsetParam === null ? null : invalid('An offset needs a limit');
	}

	const limit = parsePositiveInteger(limitParam);
	if (limit === null || limit > ROAST_PAGE_LIMIT) return invalid('Invalid limit');
	if (offsetParam === null) return { limit, offset: 0 };
	if (!/^\d+$/.test(offsetParam) || !Number.isSafeInteger(Number(offsetParam))) {
		return invalid('Invalid offset');
	}
	return { limit, offset: Number(offsetParam) };
}

export const GET: RequestHandler = async (event) => {
	let searched = false;
	try {
		if (!isCookieSessionPrincipal(event.locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const studioFailure = roastStudioFailure(event.locals.principal);
		if (studioFailure) return studioFailure;

		const filter = readRoastListFilter(event.url.searchParams);
		if (filter instanceof Response) return filter;
		const page = readRoastListPage(event.url.searchParams);
		if (page instanceof Response) return page;
		searched = filter.q !== undefined;

		const client = await createParchmentServerClient(event, { mode: 'session' });
		// The roast list asks for a page at a time. A caller that needs a whole set, such as
		// one batch or one coffee's roasts, leaves the page out.
		const list =
			page === null
				? await fetchParchmentRoastList(client, filter)
				: await fetchParchmentRoastPage(client, filter, page);
		return json({ data: list.data, totals: list.totals });
	} catch (error) {
		// Every other value is checked above, so a query Parchment turns down is the search term.
		if (
			searched &&
			error instanceof ParchmentRoastListError &&
			error.status === 400 &&
			error.code === 'invalid_query'
		) {
			return json({ error: 'Invalid search term', code: 'invalid_search' }, { status: 400 });
		}
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

		// One roast, by ID. A batch is deleted by its own ID at /api/roast-batches/[id].
		const id = parsePositiveInteger(event.url.searchParams.get('id'));
		if (id === null) return json({ error: 'A positive roast ID is required' }, { status: 400 });

		const client = await createParchmentServerClient(event, { mode: 'session' });
		await deleteParchmentRoast(client, id);
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
