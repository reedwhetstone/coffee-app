import type {
	CatalogInventoryBatchLifecycle,
	CatalogInventoryBatchReserveRequest,
	ParchmentClient,
	components
} from '@purveyors/sdk';
import { fetchParchmentCatalogItemsByIds } from './parchmentCatalog';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

type InventoryResource = components['schemas']['InventoryResource'];
type InventoryUpdateRequest = components['schemas']['InventoryUpdateRequest'];
type ManualInventoryBatchLifecycle = components['schemas']['ManualInventoryBatchLifecycle'];
type ManualInventoryBatchReserveRequest =
	components['schemas']['ManualInventoryBatchReserveRequest'];
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

type CatalogBatchLifecycleResult = {
	data?: {
		data?: CatalogInventoryBatchLifecycle;
	};
	error?: unknown;
	response?: Response;
};

type ManualBatchLifecycleResult = {
	data?: {
		data?: ManualInventoryBatchLifecycle;
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

function projectManualBatchLifecycle(
	result: ManualBatchLifecycleResult,
	expectedBatchId: string
): ManualInventoryBatchLifecycle {
	if (result.error || !result.data?.data) {
		throwParchmentResultError(
			result,
			!result.error && (result.response?.ok === true || !result.response),
			'Parchment inventory response did not include a manual batch lifecycle'
		);
	}

	const lifecycle = result.data.data;
	const completedResultIsValid =
		typeof lifecycle.result === 'object' &&
		lifecycle.result !== null &&
		lifecycle.result.batchId === expectedBatchId &&
		Array.isArray(lifecycle.result.items) &&
		lifecycle.result.items.every(
			(item) =>
				typeof item === 'object' &&
				item !== null &&
				typeof item.rowId === 'string' &&
				typeof item.resource === 'object' &&
				item.resource !== null &&
				Number.isSafeInteger(item.resource.id) &&
				item.resource.id > 0
		);
	const terminalErrorIsValid =
		typeof lifecycle.error === 'object' &&
		lifecycle.error !== null &&
		typeof lifecycle.error.code === 'string' &&
		typeof lifecycle.error.message === 'string';
	const lifecycleShapeIsValid =
		(lifecycle.status === 'completed' && completedResultIsValid && lifecycle.error === null) ||
		(lifecycle.status === 'terminal_rejected' &&
			lifecycle.result === null &&
			terminalErrorIsValid) ||
		((lifecycle.status === 'unknown' ||
			lifecycle.status === 'accepted' ||
			lifecycle.status === 'in_progress') &&
			lifecycle.result === null &&
			lifecycle.error === null);

	if (
		lifecycle.batchId !== expectedBatchId ||
		!lifecycleShapeIsValid ||
		(lifecycle.updatedAt !== null && typeof lifecycle.updatedAt !== 'string')
	) {
		throw new ParchmentInventoryError(502, {
			error: {
				code: 'invalid_response',
				message: 'Parchment returned an invalid manual inventory batch lifecycle'
			}
		});
	}

	return lifecycle;
}

function projectCatalogBatchLifecycle(
	result: CatalogBatchLifecycleResult,
	expectedBatchId: string
): CatalogInventoryBatchLifecycle {
	if (result.error || !result.data?.data) {
		throwParchmentResultError(
			result,
			!result.error && (result.response?.ok === true || !result.response),
			'Parchment inventory response did not include a catalog batch lifecycle'
		);
	}

	const lifecycle = result.data.data;
	const completedResultIsValid =
		typeof lifecycle.result === 'object' &&
		lifecycle.result !== null &&
		lifecycle.result.batchId === expectedBatchId &&
		Array.isArray(lifecycle.result.items) &&
		lifecycle.result.items.every(
			(item) =>
				typeof item === 'object' &&
				item !== null &&
				typeof item.rowId === 'string' &&
				Number.isSafeInteger(item.inventoryId) &&
				item.inventoryId > 0
		);
	const terminalErrorIsValid =
		typeof lifecycle.error === 'object' &&
		lifecycle.error !== null &&
		typeof lifecycle.error.code === 'string' &&
		typeof lifecycle.error.message === 'string';
	const terminalShapeIsValid =
		(lifecycle.status === 'completed' && completedResultIsValid && lifecycle.error === null) ||
		(lifecycle.status === 'terminal_rejected' &&
			lifecycle.result === null &&
			terminalErrorIsValid) ||
		((lifecycle.status === 'unknown' ||
			lifecycle.status === 'accepted' ||
			lifecycle.status === 'in_progress') &&
			lifecycle.result === null &&
			lifecycle.error === null);

	if (
		lifecycle.batchId !== expectedBatchId ||
		!terminalShapeIsValid ||
		(lifecycle.updatedAt !== null && typeof lifecycle.updatedAt !== 'string')
	) {
		throw new ParchmentInventoryError(502, {
			error: {
				code: 'invalid_response',
				message: 'Parchment returned an invalid catalog inventory batch lifecycle'
			}
		});
	}

	return lifecycle;
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

/**
 * Build the legacy beans-page projection from owner-scoped Parchment resources.
 *
 * Authenticated Portfolio reads use this helper so ownership, catalog
 * visibility, and roast access come from Parchment rather than direct database
 * joins. Cross-principal shares use Parchment's separate capability contract.
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
		const roasts = await collectOffsetPages({
			fetchPage: async (offset) =>
				unwrapParchment(
					await client.roasts.list({
						limit: PAGE_LIMIT,
						offset,
						coffee_id: options.id
					})
				).data,
			key: (row) => row.roast_id
		});

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

/** Durably reserve complete manual inventory intent through Parchment. */
export async function reserveParchmentManualInventoryBatch(
	client: ParchmentClient,
	body: ManualInventoryBatchReserveRequest
): Promise<ManualInventoryBatchLifecycle> {
	const result = (await client.inventory.reserveManualBatch(body)) as ManualBatchLifecycleResult;
	return projectManualBatchLifecycle(result, body.batchId);
}

/** Safely retry the atomic commit for a reserved manual inventory batch. */
export async function commitParchmentManualInventoryBatch(
	client: ParchmentClient,
	batchId: string
): Promise<ManualInventoryBatchLifecycle> {
	const result = (await client.inventory.commitManualBatch(batchId)) as ManualBatchLifecycleResult;
	return projectManualBatchLifecycle(result, batchId);
}

/** Reconcile the durable owner-scoped manual lifecycle by its stable batch UUID. */
export async function getParchmentManualInventoryBatchStatus(
	client: ParchmentClient,
	batchId: string
): Promise<ManualInventoryBatchLifecycle> {
	const result = (await client.inventory.getManualBatchStatus(
		batchId
	)) as ManualBatchLifecycleResult;
	return projectManualBatchLifecycle(result, batchId);
}

/** Durably reserve complete catalog-backed inventory intent through Parchment. */
export async function reserveParchmentCatalogInventoryBatch(
	client: ParchmentClient,
	body: CatalogInventoryBatchReserveRequest
): Promise<CatalogInventoryBatchLifecycle> {
	const result = (await client.inventory.reserveCatalogBatch(body)) as CatalogBatchLifecycleResult;
	return projectCatalogBatchLifecycle(result, body.batchId);
}

/** Safely retry the atomic commit for a reserved catalog inventory batch. */
export async function commitParchmentCatalogInventoryBatch(
	client: ParchmentClient,
	batchId: string
): Promise<CatalogInventoryBatchLifecycle> {
	const result = (await client.inventory.commitCatalogBatch(
		batchId
	)) as CatalogBatchLifecycleResult;
	return projectCatalogBatchLifecycle(result, batchId);
}

/** Reconcile the durable owner-scoped lifecycle by its stable batch UUID. */
export async function getParchmentCatalogInventoryBatchStatus(
	client: ParchmentClient,
	batchId: string
): Promise<CatalogInventoryBatchLifecycle> {
	const result = (await client.inventory.getCatalogBatchStatus(
		batchId
	)) as CatalogBatchLifecycleResult;
	return projectCatalogBatchLifecycle(result, batchId);
}

/**
 * Update one owner-scoped inventory lot through Parchment's canonical mutation.
 * Quantity changes and their derived stocked projection complete atomically.
 */
export async function updateParchmentInventoryItem(
	client: ParchmentClient,
	id: number,
	body: InventoryUpdateRequest,
	ifMatch?: string
): Promise<ParchmentInventoryProjection> {
	const result = (await client.inventory.update(
		id,
		body,
		ifMatch ? { ifMatch } : undefined
	)) as InventoryMutationResult;

	return projectInventoryMutation(result);
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
