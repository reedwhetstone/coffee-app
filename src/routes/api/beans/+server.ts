import { json } from '@sveltejs/kit';
import { AuthError, getUserRoles, requireParchmentAccess } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { CatalogInventoryBatchReserveRequest, components } from '@purveyors/sdk';
import {
	buildGreenCoffeeQuery,
	processGreenCoffeeData,
	stripRoastProfileData
} from '$lib/server/greenCoffeeUtils.js';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	commitParchmentCatalogInventoryBatch,
	createParchmentManualInventoryBatch,
	deleteParchmentInventoryItem,
	fetchParchmentInventoryProjection,
	getParchmentCatalogInventoryBatchStatus,
	getParchmentManualInventoryBatch,
	ParchmentInventoryError,
	reserveParchmentCatalogInventoryBatch,
	updateParchmentInventoryItem
} from '$lib/server/parchmentInventory';

type ManualInventoryBatchCreateRequest = components['schemas']['ManualInventoryBatchCreateRequest'];
type InventoryUpdateRequest = components['schemas']['InventoryUpdateRequest'];

const MAX_POSTGRES_INTEGER = 2_147_483_647;

function inventoryId(value: string | null): number | null {
	if (!value || !/^\d+$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_POSTGRES_INTEGER
		? parsed
		: null;
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
	const catalogBatchId = url.searchParams.get('catalogBatchId');
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		if (manualBatchId) {
			await requireParchmentAccess(event);
			const client = await createParchmentServerClient(event, { mode: 'session' });
			return json(await getParchmentManualInventoryBatch(client, manualBatchId));
		}

		if (catalogBatchId) {
			await requireParchmentAccess(event);
			const client = await createParchmentServerClient(event, { mode: 'session' });
			return json(await getParchmentCatalogInventoryBatchStatus(client, catalogBatchId));
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
		if ((manualBatchId || catalogBatchId) && error instanceof ParchmentInventoryError) {
			return json(legacyParchmentError(error.body), { status: error.status });
		}
		if ((manualBatchId || catalogBatchId) && error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Inventory batch reconciliation is temporarily unavailable' },
				{ status: 503 }
			);
		}

		console.error('Error querying beans:', error);
		if (manualBatchId || catalogBatchId) {
			return json({ data: [], error: 'Failed to reconcile inventory batch' }, { status: 500 });
		}
		return json({ data: [], error: 'Failed to fetch beans' });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		await requireParchmentAccess(event);
		const catalogBatchId = event.url.searchParams.get('catalogBatchId');

		if (catalogBatchId) {
			const client = await createParchmentServerClient(event, { mode: 'session' });
			return json(await commitParchmentCatalogInventoryBatch(client, catalogBatchId));
		}

		const bean = await event.request.json();
		if (typeof bean?.batchId === 'string' && Array.isArray(bean.items)) {
			const client = await createParchmentServerClient(event, { mode: 'session' });
			const lifecycle = await reserveParchmentCatalogInventoryBatch(
				client,
				bean as CatalogInventoryBatchReserveRequest
			);
			return json(lifecycle, { status: 201 });
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

		return json({ error: 'A catalog or manual inventory batch is required' }, { status: 400 });
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentInventoryError) {
			return json(legacyParchmentError(error.body), { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Inventory batch creation is temporarily unavailable' },
				{ status: 503 }
			);
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

		const id = url.searchParams.get('id');
		if (!id || !/^\d+$/.test(id)) {
			return json({ success: false, error: 'Invalid or missing inventory ID' }, { status: 400 });
		}

		const inventoryId = Number(id);
		if (!Number.isSafeInteger(inventoryId) || inventoryId <= 0 || inventoryId > 2_147_483_647) {
			return json({ success: false, error: 'Invalid or missing inventory ID' }, { status: 400 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		await deleteParchmentInventoryItem(client, inventoryId);
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
