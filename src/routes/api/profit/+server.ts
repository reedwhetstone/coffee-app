import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchParchmentProfit } from '$lib/server/parchmentProfit';
import {
	createParchmentSale,
	deleteParchmentSale,
	fetchParchmentSales,
	ParchmentSalesError,
	updateParchmentSale,
	type ParchmentSaleCreateRequest,
	type ParchmentSaleUpdateRequest
} from '$lib/server/parchmentSales';
import { isRoastBatchId } from '$lib/server/parchmentRoastBatches';
import { isSessionPrincipal, isTrustedMutationRequest } from '$lib/server/principal';
import { principalHasRole } from '$lib/server/principal';

function isCookieSessionEvent(event: RequestEvent): boolean {
	const principal = event.locals.principal;
	return Boolean(
		principal &&
			isSessionPrincipal(principal) &&
			principal.source === 'cookie-session' &&
			principal.userId
	);
}

function parseSaleId(url: URL): number | null {
	const rawId = url.searchParams.get('id');
	if (!rawId) return null;
	const id = Number(rawId);
	return Number.isInteger(id) && id > 0 ? id : null;
}

class SaleRequestError extends Error {}

/**
 * The batch and roast a sale is recorded against, by ID. A key that is absent is left out,
 * so an update changes the link only when the form sends one. Null removes it.
 */
function readSaleLink(raw: Record<string, unknown>): {
	batchId?: string | null;
	roastId?: number | null;
} {
	const link: { batchId?: string | null; roastId?: number | null } = {};
	if ('batch_id' in raw && raw.batch_id !== undefined) {
		if (raw.batch_id !== null && !isRoastBatchId(raw.batch_id)) {
			throw new SaleRequestError('Invalid roast batch');
		}
		link.batchId = raw.batch_id;
	}
	if ('roast_id' in raw && raw.roast_id !== undefined) {
		const roastId = raw.roast_id;
		if (roastId !== null && !(Number.isSafeInteger(roastId) && (roastId as number) > 0)) {
			throw new SaleRequestError('Invalid roast');
		}
		link.roastId = roastId as number | null;
	}
	return link;
}

function toParchmentCreateRequest(raw: Record<string, unknown>): ParchmentSaleCreateRequest {
	const link = readSaleLink(raw);
	const linked = typeof link.batchId === 'string' || typeof link.roastId === 'number';
	return {
		greenCoffeeInvId: raw.green_coffee_inv_id as number,
		ozSold: raw.oz_sold as number,
		price: raw.price as number,
		...(typeof raw.buyer === 'string' ? { buyer: raw.buyer } : {}),
		...(typeof link.batchId === 'string' ? { batchId: link.batchId } : {}),
		...(typeof link.roastId === 'number' ? { roastId: link.roastId } : {}),
		// A name is how a caller with no batch ID names a batch; beside an ID it says nothing.
		...(!linked && typeof raw.batch_name === 'string' ? { batchName: raw.batch_name } : {}),
		...(typeof raw.sell_date === 'string' ? { sellDate: raw.sell_date } : {})
	};
}

function toParchmentUpdateRequest(raw: Record<string, unknown>): ParchmentSaleUpdateRequest {
	const link = readSaleLink(raw);
	const update: ParchmentSaleUpdateRequest = {};
	if ('oz_sold' in raw) update.ozSold = raw.oz_sold as number;
	if ('price' in raw) update.price = raw.price as number;
	if ('buyer' in raw) update.buyer = raw.buyer === null ? '' : (raw.buyer as string);
	if (link.batchId !== undefined) update.batchId = link.batchId;
	if (link.roastId !== undefined) update.roastId = link.roastId;
	// A name alone moves the sale to the batch that name identifies, so it is sent only by a
	// caller that sends no ID.
	if ('batch_name' in raw && link.batchId === undefined && typeof link.roastId !== 'number')
		update.batchName = raw.batch_name === null ? '' : (raw.batch_name as string);
	if ('sell_date' in raw) update.sellDate = raw.sell_date as string;
	return update;
}

function legacyParchmentError(body: unknown): { error: string; code?: string } {
	if (typeof body !== 'object' || body === null) {
		return { error: 'Parchment sales request failed' };
	}

	const nested = 'error' in body && typeof body.error === 'object' ? body.error : null;
	if (nested !== null) {
		const message =
			'message' in nested && typeof nested.message === 'string'
				? nested.message
				: 'Parchment sales request failed';
		const code = 'code' in nested && typeof nested.code === 'string' ? nested.code : undefined;
		return code ? { error: message, code } : { error: message };
	}

	return {
		error:
			'message' in body && typeof body.message === 'string'
				? body.message
				: 'Parchment sales request failed'
	};
}

function parchmentFailure(error: ParchmentSalesError) {
	return json(legacyParchmentError(error.body), { status: error.status });
}

function mutationAuthFailure(event: RequestEvent) {
	if (!isCookieSessionEvent(event)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isTrustedMutationRequest(event, event.locals.principal!)) {
		return json({ error: 'Cross-site session mutation blocked' }, { status: 403 });
	}
	return null;
}

/** Recording a sale, or changing what one is recorded against, is part of Mallard Studio. */
function memberFailure(event: RequestEvent) {
	if (principalHasRole(event.locals.principal, 'member')) return null;
	return json({ error: 'Mallard Studio membership is required to record sales' }, { status: 403 });
}

export const GET: RequestHandler = async (event) => {
	try {
		if (!isCookieSessionEvent(event)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const [sales, profit] = await Promise.all([
			fetchParchmentSales(client),
			fetchParchmentProfit(client)
		]);

		return json({ sales, profit });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event) ?? memberFailure(event);
		if (authFailure) return authFailure;

		const id = parseSaleId(event.url);
		if (id === null) {
			return json({ error: 'A positive sale ID is required' }, { status: 400 });
		}

		const raw = (await event.request.json()) as Record<string, unknown>;
		const update = toParchmentUpdateRequest(raw);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = await updateParchmentSale(client, id, update);
		return json(data);
	} catch (error) {
		if (error instanceof SaleRequestError) return json({ error: error.message }, { status: 400 });
		if (error instanceof ParchmentSalesError) return parchmentFailure(error);
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event) ?? memberFailure(event);
		if (authFailure) return authFailure;

		const raw = (await event.request.json()) as Record<string, unknown>;
		const sale = toParchmentCreateRequest(raw);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim() || undefined;
		const data = await createParchmentSale(client, sale, idempotencyKey);
		return json(data);
	} catch (error) {
		if (error instanceof SaleRequestError) return json({ error: error.message }, { status: 400 });
		if (error instanceof ParchmentSalesError) return parchmentFailure(error);
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const authFailure = mutationAuthFailure(event);
		if (authFailure) return authFailure;

		const id = parseSaleId(event.url);
		if (id === null) {
			return json({ error: 'A positive sale ID is required' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		await deleteParchmentSale(client, id);
		return json({ success: true });
	} catch (error) {
		if (error instanceof ParchmentSalesError) return parchmentFailure(error);
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
};
