import { json } from '@sveltejs/kit';
import { AuthError, getUserRoles, requireParchmentAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { components } from '@purveyors/sdk';
import {
	buildGreenCoffeeQuery,
	processGreenCoffeeData,
	stripRoastProfileData
} from '$lib/server/greenCoffeeUtils.js';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	createParchmentCatalogInventoryItem,
	createParchmentManualInventoryBatch,
	deleteParchmentInventoryItem,
	fetchParchmentInventoryProjection,
	getParchmentManualInventoryBatch,
	ParchmentInventoryError,
	updateParchmentInventoryItem
} from '$lib/server/parchmentInventory';

type CatalogInventoryCreateRequest = components['schemas']['CatalogInventoryCreateRequest'];
type InventoryUpdateRequest = components['schemas']['InventoryUpdateRequest'];
type ManualInventoryBatchCreateRequest = components['schemas']['ManualInventoryBatchCreateRequest'];

const MAX_POSTGRES_INTEGER = 2_147_483_647;

function inventoryId(value: string | null): number | null {
	if (!value || !/^\d+$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_POSTGRES_INTEGER
		? parsed
		: null;
}

function catalogInventoryCreateRequest(
	bean: Record<string, unknown>,
	catalogId: number
): CatalogInventoryCreateRequest {
	const body = {
		catalogId,
		qty: bean.purchased_qty_lbs
	} as CatalogInventoryCreateRequest;

	if (typeof bean.purchase_date === 'string') body.purchaseDate = bean.purchase_date;
	if (typeof bean.bean_cost === 'number') body.cost = bean.bean_cost;
	if (typeof bean.tax_ship_cost === 'number') body.taxShip = bean.tax_ship_cost;
	if (typeof bean.notes === 'string') body.notes = bean.notes;
	if (typeof bean.rank === 'number' || bean.rank === null) body.rank = bean.rank;
	if (typeof bean.stocked === 'boolean') body.stocked = bean.stocked;
	if (bean.cupping_notes !== undefined) {
		body.cuppingNotes = bean.cupping_notes as CatalogInventoryCreateRequest['cuppingNotes'];
	}

	return body;
}

function inventoryUpdateRequest(updates: Record<string, unknown>): InventoryUpdateRequest {
	const body: InventoryUpdateRequest = {};
	if (updates.purchased_qty_lbs !== undefined) {
		body.qty = updates.purchased_qty_lbs as number;
	}
	if (typeof updates.purchase_date === 'string') body.purchaseDate = updates.purchase_date;
	if (typeof updates.bean_cost === 'number' || updates.bean_cost === null) {
		body.cost = updates.bean_cost;
	}
	if (typeof updates.tax_ship_cost === 'number' || updates.tax_ship_cost === null) {
		body.taxShip = updates.tax_ship_cost;
	}
	if (typeof updates.notes === 'string' || updates.notes === null) body.notes = updates.notes;
	if (typeof updates.stocked === 'boolean') body.stocked = updates.stocked;
	if (typeof updates.rank === 'number' || updates.rank === null) body.rank = updates.rank;
	if (updates.cupping_notes !== undefined) {
		body.cuppingNotes = updates.cupping_notes as InventoryUpdateRequest['cuppingNotes'];
	}
	return body;
}

function legacyParchmentError(body: unknown): { error: string; code?: string } {
	if (
		typeof body !== 'object' ||
		body === null ||
		!('error' in body) ||
		typeof body.error !== 'object' ||
		body.error === null
	) {
		return { error: 'Parchment inventory request failed' };
	}

	const envelope = body.error as Record<string, unknown>;
	return {
		error:
			typeof envelope.message === 'string'
				? envelope.message
				: 'Parchment inventory request failed',
		...(typeof envelope.code === 'string' ? { code: envelope.code } : {})
	};
}

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	const manualBatchId = url.searchParams.get('manualBatchId');
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		if (manualBatchId) {
			await requireParchmentAccess(event);
			const client = await createParchmentServerClient(event, { mode: 'session' });
			return json(await getParchmentManualInventoryBatch(client, manualBatchId));
		}

		// If share token is provided, verify it and show shared data
		if (shareToken) {
			let query = buildGreenCoffeeQuery(locals.supabase);
			let includeRoastProfiles = false;
			const { data: shareData } = await locals.supabase
				.from('shared_links')
				.select('user_id, resource_id')
				.eq('share_token', shareToken)
				.eq('is_active', true)
				.gte('expires_at', new Date().toISOString())
				.single();

			if (shareData?.user_id) {
				const ownerRoles = await getUserRoles(locals.supabase, shareData.user_id);
				includeRoastProfiles = ownerRoles.includes('member');

				// Show only the shared bean or all beans from the user
				if (shareData.resource_id === 'all') {
					query = query.eq('user', shareData.user_id);
				} else {
					query = query.eq('id', shareData.resource_id);
				}
			} else {
				return json({ data: [] });
			}

			const { data: rows, error } = await query;
			if (error) throw error;

			const processedData = processGreenCoffeeData(rows || []);
			const responseData = includeRoastProfiles
				? processedData
				: stripRoastProfileData(processedData);

			return json({
				data: responseData,
				searchState: Object.fromEntries(url.searchParams.entries())
			});
		}

		// Standard Portfolio access: Parchment Intelligence or Mallard Studio users see
		// their own rows through the canonical Parchment owner contracts.
		const { memberAccess } = await requireParchmentAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const responseData = await fetchParchmentInventoryProjection(client, {
			id: id ? Number(id) : undefined,
			includeRoastProfiles: memberAccess
		});

		return json({
			data: responseData,
			searchState: Object.fromEntries(url.searchParams.entries())
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ data: [], error: error.message }, { status: error.status });
		}
		if (manualBatchId && error instanceof ParchmentInventoryError) {
			return json(legacyParchmentError(error.body), { status: error.status });
		}
		if (manualBatchId && error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Manual inventory reconciliation is temporarily unavailable' },
				{ status: 503 }
			);
		}

		console.error('Error querying beans:', error);
		if (manualBatchId) {
			return json(
				{ data: [], error: 'Failed to reconcile manual inventory batch' },
				{ status: 500 }
			);
		}
		return json({ data: [], error: 'Failed to fetch beans' });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		await requireParchmentAccess(event);

		const bean = (await event.request.json()) as Record<string, unknown>;
		if (typeof bean !== 'object' || bean === null || Array.isArray(bean)) {
			return json({ error: 'Invalid inventory request' }, { status: 400 });
		}
		if (Array.isArray(bean.items)) {
			const batchId = event.request.headers.get('idempotency-key')?.trim();
			if (!batchId) {
				return json(
					{ error: 'Idempotency-Key is required for manual inventory batches' },
					{ status: 400 }
				);
			}

			const client = await createParchmentServerClient(event, { mode: 'session' });
			const created = await createParchmentManualInventoryBatch(
				client,
				bean as ManualInventoryBatchCreateRequest,
				batchId
			);
			return json(created, { status: 201 });
		}

		const catalogId =
			typeof bean.catalog_id === 'number' && Number.isInteger(bean.catalog_id)
				? bean.catalog_id
				: null;
		if (catalogId === null || catalogId <= 0 || catalogId > MAX_POSTGRES_INTEGER) {
			return json(
				{
					error: bean.manual_name
						? 'Manual inventory creation requires the batch contract'
						: 'Invalid catalog reference'
				},
				{ status: 400 }
			);
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim() || undefined;
		const created = await createParchmentCatalogInventoryItem(
			client,
			catalogInventoryCreateRequest(bean, catalogId),
			idempotencyKey
		);

		return json(created);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentInventoryError) {
			return json(legacyParchmentError(error.body), { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json({ error: 'Inventory creation is temporarily unavailable' }, { status: 503 });
		}

		console.error('Error creating bean:', error);
		return json({ error: 'Failed to create bean' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		await requireParchmentAccess(event);
		const { url, request } = event;

		const parsedId = inventoryId(url.searchParams.get('id'));
		if (parsedId === null) {
			return json({ error: 'Invalid or missing inventory ID' }, { status: 400 });
		}

		const updates = (await request.json()) as Record<string, unknown>;
		if (typeof updates !== 'object' || updates === null || Array.isArray(updates)) {
			return json({ error: 'Invalid inventory update' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const ifMatch = request.headers.get('if-match')?.trim() || undefined;
		const updated = await updateParchmentInventoryItem(
			client,
			parsedId,
			inventoryUpdateRequest(updates),
			ifMatch
		);

		return json(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ success: false, error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentInventoryError) {
			return json(legacyParchmentError(error.body), { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ success: false, error: 'Inventory update is temporarily unavailable' },
				{ status: 503 }
			);
		}

		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		await requireParchmentAccess(event);
		const { url } = event;

		const parsedId = inventoryId(url.searchParams.get('id'));
		if (parsedId === null) {
			return json({ success: false, error: 'Invalid or missing inventory ID' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		await deleteParchmentInventoryItem(client, parsedId);
		return json({ success: true });
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ success: false, error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentInventoryError) {
			return json(error.body, { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ success: false, error: 'Inventory deletion is temporarily unavailable' },
				{ status: 503 }
			);
		}

		console.error('Error deleting inventory item:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
};
