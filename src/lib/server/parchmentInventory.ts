import type { ParchmentClient, components } from '@purveyors/sdk';
import { fetchParchmentCatalogItemsByIds } from './parchmentCatalog';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

type InventoryResource = components['schemas']['InventoryResource'];
type CatalogInventoryCreateRequest = components['schemas']['CatalogInventoryCreateRequest'];
type InventoryUpdateRequest = components['schemas']['InventoryUpdateRequest'];
type ManualInventoryBatchCreateRequest = components['schemas']['ManualInventoryBatchCreateRequest'];
type RoastResource = components['schemas']['RoastListResource'];

export type ParchmentInventoryProjection = Omit<InventoryResource, 'coffee_catalog'> & {
	ai_tasting_notes: string | null;
	coffee_catalog: (Record<string, unknown> & { ai_tasting_notes?: unknown }) | null;
	roast_profiles: Array<{
		oz_in: number | null;
		oz_out: number | null;
		weight_loss_percent: number | null;
		roast_id: number;
		batch_name: string | null;
		roast_date: string | null;
	}>;
};

type InventoryDeleteResult = {
	data?: {
		data?: {
			id?: unknown;
			deleted?: unknown;
		};
	};
	error?: unknown;
	response?: Response;
};

type InventoryMutationResult = {
	data?: {
		data?: InventoryResource;
	};
	error?: unknown;
	response?: Response;
};

export class ParchmentInventoryError extends Error {
	constructor(
		public status: number,
		public body: unknown
	) {
		super(
			typeof body === 'object' &&
				body !== null &&
				'error' in body &&
				typeof body.error === 'object' &&
				body.error !== null &&
				'message' in body.error &&
				typeof body.error.message === 'string'
				? body.error.message
				: 'Parchment inventory request failed'
		);
		this.name = 'ParchmentInventoryError';
	}
}

const PAGE_LIMIT = 200;

function projectInventoryResource(
	row: InventoryResource,
	roastProfiles: ParchmentInventoryProjection['roast_profiles'] = []
): ParchmentInventoryProjection {
	const aiTastingNotes = row.coffee_catalog?.ai_tasting_notes;

	return {
		...row,
		ai_tasting_notes: aiTastingNotes ? JSON.stringify(aiTastingNotes) : null,
		coffee_catalog:
			row.coffee_catalog === null
				? null
				: {
						...row.coffee_catalog,
						ai_tasting_notes: aiTastingNotes ? JSON.stringify(aiTastingNotes) : null
					},
		roast_profiles: roastProfiles
	};
}

function projectManualBatch(
	result: components['schemas']['ManualInventoryBatchResult'],
	expectedBatchId: string
): ParchmentInventoryProjection[] {
	if (result.batchId !== expectedBatchId) {
		throw new Error('Parchment returned the wrong manual inventory batch');
	}

	return result.items.map(({ resource }) => projectInventoryResource(resource));
}

function projectInventoryMutation(result: InventoryMutationResult): ParchmentInventoryProjection {
	if (result.error || !result.data?.data) {
		throwParchmentResultError(
			result,
			!result.error && (result.response?.ok === true || !result.response),
			'Parchment inventory response did not include a resource payload'
		);
	}

	return projectInventoryResource(result.data.data);
}

function throwParchmentResultError(
	result: { error?: unknown; response?: Response },
	protocolError = false,
	protocolMessage = 'Parchment inventory response did not include a batch payload'
): never {
	if (protocolError) {
		throw new ParchmentInventoryError(502, {
			error: {
				code: 'invalid_response',
				message: protocolMessage
			}
		});
	}

	if (result.response) {
		throw new ParchmentInventoryError(result.response.status, result.error);
	}
	throw result.error instanceof Error
		? result.error
		: new Error('Parchment inventory request failed', { cause: result.error });
}

function roastProjection(roast: RoastResource) {
	return {
		oz_in: roast.oz_in,
		oz_out: roast.oz_out,
		weight_loss_percent:
			roast.weight_loss_percent === null ? null : Math.round(roast.weight_loss_percent * 100) / 100,
		roast_id: roast.roast_id,
		batch_name: roast.batch_name,
		roast_date: roast.roast_date
	};
}

async function fetchParchmentRoastProfiles(
	client: ParchmentClient,
	coffeeId?: number
): Promise<RoastResource[]> {
	return collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(
				await client.roasts.list({
					limit: PAGE_LIMIT,
					offset,
					coffee_id: coffeeId
				})
			).data,
		key: (row) => row.roast_id
	});
}

async function projectInventoryMutationWithRoasts(
	client: ParchmentClient,
	result: InventoryMutationResult,
	includeRoastProfiles: boolean
): Promise<ParchmentInventoryProjection> {
	if (!includeRoastProfiles) {
		return projectInventoryMutation(result);
	}

	if (result.error || !result.data?.data) {
		return projectInventoryMutation(result);
	}

	const roastProfiles = await fetchParchmentRoastProfiles(client, result.data.data.id);
	return projectInventoryResource(result.data.data, roastProfiles.map(roastProjection));
}

/**
 * Build the legacy beans-page projection from owner-scoped Parchment resources.
 *
 * Shared-link reads remain in coffee-app because those links intentionally read
 * another principal's shared rows. Authenticated Portfolio reads use this
 * helper so ownership, catalog visibility, and roast access come from
 * Parchment rather than direct database joins.
 */
export async function fetchParchmentInventoryProjection(
	client: ParchmentClient,
	options: {
		id?: number;
		includeRoastProfiles: boolean;
	}
): Promise<ParchmentInventoryProjection[]> {
	let inventory = await collectOffsetPages({
		fetchPage: async (offset) =>
			unwrapParchment(await client.inventory.list({ limit: PAGE_LIMIT, offset })).data,
		key: (row) => row.id
	});

	if (options.id !== undefined) {
		inventory = inventory.filter((row) => row.id === options.id);
	}

	const catalogIds = [
		...new Set(
			inventory
				.map((row) => row.catalog_id)
				.filter((catalogId): catalogId is number => catalogId !== null)
		)
	];
	const catalogRows = await fetchParchmentCatalogItemsByIds(client, catalogIds);
	const catalogById = new Map<number, Record<string, unknown>>(
		catalogRows.map((row) => [row.id, row as Record<string, unknown>])
	);

	const roastsByInventoryId = new Map<number, RoastResource[]>();
	if (options.includeRoastProfiles && inventory.length > 0) {
		const inventoryIds = new Set(inventory.map((row) => row.id));
		const roasts = await fetchParchmentRoastProfiles(client, options.id);

		for (const roast of roasts) {
			if (roast.coffee_id === null || !inventoryIds.has(roast.coffee_id)) continue;
			const existing = roastsByInventoryId.get(roast.coffee_id) ?? [];
			existing.push(roast);
			roastsByInventoryId.set(roast.coffee_id, existing);
		}
	}

	return inventory.map((row) => {
		const fullCatalog = row.catalog_id === null ? undefined : catalogById.get(row.catalog_id);
		const coffeeCatalog: (Record<string, unknown> & { ai_tasting_notes?: unknown }) | null =
			row.coffee_catalog === null && fullCatalog === undefined
				? null
				: {
						...(row.coffee_catalog as Record<string, unknown> | null),
						...fullCatalog
					};
		return projectInventoryResource(
			{
				...row,
				coffee_catalog:
					coffeeCatalog === null
						? null
						: ({
								...coffeeCatalog
							} as InventoryResource['coffee_catalog'])
			},
			options.includeRoastProfiles
				? (roastsByInventoryId.get(row.id) ?? []).map(roastProjection)
				: []
		);
	});
}

/** Create one atomic owner-private manual inventory batch through Parchment. */
export async function createParchmentManualInventoryBatch(
	client: ParchmentClient,
	body: ManualInventoryBatchCreateRequest,
	batchId: string
): Promise<ParchmentInventoryProjection[]> {
	const result = await client.inventory.createManualBatch(body, { idempotencyKey: batchId });
	if (!result.data?.data) {
		throwParchmentResultError(
			result,
			result.response?.ok === true || (!result.error && !result.response)
		);
	}
	return projectManualBatch(result.data.data, batchId);
}

/** Reconcile an uncertain atomic manual inventory batch by its stable batch UUID. */
export async function getParchmentManualInventoryBatch(
	client: ParchmentClient,
	batchId: string
): Promise<ParchmentInventoryProjection[]> {
	const result = await client.inventory.getManualBatch(batchId);
	if (!result.data?.data) {
		throwParchmentResultError(
			result,
			result.response?.ok === true || (!result.error && !result.response)
		);
	}
	return projectManualBatch(result.data.data, batchId);
}

/** Create one owner-scoped catalog-backed inventory lot through Parchment. */
export async function createParchmentCatalogInventoryItem(
	client: ParchmentClient,
	body: CatalogInventoryCreateRequest,
	idempotencyKey?: string,
	includeRoastProfiles = false
): Promise<ParchmentInventoryProjection> {
	const result = (await client.inventory.create(
		body,
		idempotencyKey ? { idempotencyKey } : undefined
	)) as InventoryMutationResult;

	return projectInventoryMutationWithRoasts(client, result, includeRoastProfiles);
}

/**
 * Update one owner-scoped inventory lot through Parchment's canonical mutation.
 * Quantity changes and their derived stocked projection complete atomically.
 */
export async function updateParchmentInventoryItem(
	client: ParchmentClient,
	id: number,
	body: InventoryUpdateRequest,
	ifMatch?: string,
	includeRoastProfiles = false
): Promise<ParchmentInventoryProjection> {
	const result = (await client.inventory.update(
		id,
		body,
		ifMatch ? { ifMatch } : undefined
	)) as InventoryMutationResult;

	return projectInventoryMutationWithRoasts(client, result, includeRoastProfiles);
}

/**
 * Delete one owner-scoped inventory row through Parchment's safe mutation
 * contract. Dependent roasts or sales remain intact and produce a 409.
 */
export async function deleteParchmentInventoryItem(
	client: ParchmentClient,
	id: number
): Promise<void> {
	const result = (await client.inventory.delete(id)) as InventoryDeleteResult;
	if (result.error) {
		if (result.response) {
			throw new ParchmentInventoryError(result.response.status, result.error);
		}
		throw result.error instanceof Error
			? result.error
			: new Error('Parchment inventory request failed', { cause: result.error });
	}

	if (result.data?.data?.id !== id || result.data.data.deleted !== true) {
		throw new Error('Parchment returned an invalid inventory delete response');
	}
}
