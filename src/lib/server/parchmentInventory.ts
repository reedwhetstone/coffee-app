import type { ParchmentClient, components } from '@purveyors/sdk';
import { fetchParchmentCatalogItemsByIds } from './parchmentCatalog';
import { collectOffsetPages } from '$lib/services/tools/pagination';
import { unwrapParchment } from '$lib/services/tools/parchment';

type InventoryResource = components['schemas']['InventoryResource'];
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
		const aiTastingNotes = coffeeCatalog?.ai_tasting_notes;

		return {
			...row,
			ai_tasting_notes: aiTastingNotes ? JSON.stringify(aiTastingNotes) : null,
			coffee_catalog:
				coffeeCatalog === null
					? null
					: {
							...coffeeCatalog,
							ai_tasting_notes: aiTastingNotes ? JSON.stringify(aiTastingNotes) : null
						},
			roast_profiles: options.includeRoastProfiles
				? (roastsByInventoryId.get(row.id) ?? []).map(roastProjection)
				: []
		};
	});
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
