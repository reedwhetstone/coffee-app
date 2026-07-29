import type { ParchmentClient, components } from '@purveyors/sdk';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

export type ParchmentSaleProjection = components['schemas']['SaleResource'];
export type ParchmentSaleCreateRequest = components['schemas']['SalesCreateRequest'];
export type ParchmentSaleUpdateRequest = components['schemas']['SalesUpdateRequest'];

type ParchmentMutationResult<T> = {
	data?: {
		data?: T;
	};
	error?: unknown;
	response?: Response;
};

export class ParchmentSalesError extends Error {
	constructor(
		public status: number,
		public body: unknown
	) {
		super(extractParchmentMessage(body));
		this.name = 'ParchmentSalesError';
	}
}

const PAGE_LIMIT = 200;

function extractParchmentMessage(body: unknown): string {
	if (typeof body !== 'object' || body === null) return 'Parchment sales request failed';

	if (
		'error' in body &&
		typeof body.error === 'object' &&
		body.error !== null &&
		'message' in body.error &&
		typeof body.error.message === 'string'
	) {
		return body.error.message;
	}

	if ('message' in body && typeof body.message === 'string') return body.message;
	return 'Parchment sales request failed';
}

function unwrapMutation<T>(result: ParchmentMutationResult<T>, isValid: (data: T) => boolean): T {
	if (result.error) {
		if (result.response) throw new ParchmentSalesError(result.response.status, result.error);
		throw result.error instanceof Error
			? result.error
			: new Error('Parchment sales request failed', { cause: result.error });
	}

	const data = result.data?.data;
	if (data === undefined || !isValid(data)) {
		throw new ParchmentSalesError(502, {
			error: {
				code: 'invalid_response',
				message: 'Parchment returned an invalid sales mutation response'
			}
		});
	}
	return data;
}

/**
 * List every owner-scoped sale through Parchment while preserving the legacy
 * `/api/profit` sales row shape.
 */
export function fetchParchmentSales(client: ParchmentClient): Promise<ParchmentSaleProjection[]> {
	return collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(await client.sales.list({ limit: PAGE_LIMIT, offset })).data,
		key: (row) => row.id
	});
}

/** Record one owner-scoped sale through Parchment. */
export async function createParchmentSale(
	client: ParchmentClient,
	body: ParchmentSaleCreateRequest,
	idempotencyKey?: string
): Promise<ParchmentSaleProjection> {
	const result = (await client.sales.create(
		body,
		idempotencyKey ? { idempotencyKey } : undefined
	)) as ParchmentMutationResult<ParchmentSaleProjection>;
	return unwrapMutation(result, (data) => Number.isInteger(data.id) && data.id > 0);
}

/** Update one owner-scoped sale through Parchment. */
export async function updateParchmentSale(
	client: ParchmentClient,
	id: number,
	body: ParchmentSaleUpdateRequest
): Promise<ParchmentSaleProjection> {
	const result = (await client.sales.update(
		id,
		body
	)) as ParchmentMutationResult<ParchmentSaleProjection>;
	return unwrapMutation(result, (data) => data.id === id);
}

/** Delete one owner-scoped sale through Parchment. */
export async function deleteParchmentSale(client: ParchmentClient, id: number): Promise<void> {
	const result = (await client.sales.delete(id)) as ParchmentMutationResult<{
		id: number;
		deleted: true;
	}>;
	unwrapMutation(result, (data) => data.id === id && data.deleted === true);
}
