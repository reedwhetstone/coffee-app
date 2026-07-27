import { json } from '@sveltejs/kit';
import { AuthError, getUserRoles, requireParchmentAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import type { RequestHandler } from './$types';
import type { InventoryCreateRequest } from '@purveyors/sdk';
import {
	buildGreenCoffeeQuery,
	processGreenCoffeeData,
	stripRoastProfileData
} from '$lib/server/greenCoffeeUtils.js';
import { addToInventory, updateInventory, deleteInventoryItem } from '$lib/data/inventory.js';
import { GREEN_COFFEE_INV_COLUMNS, pickColumns } from '$lib/utils/dbColumns.js';

type ManualInventoryCreateRequest = Extract<
	InventoryCreateRequest,
	{ manualCoffee: Record<string, unknown> }
>;

const MANUAL_COFFEE_FIELD_MAP = {
	country: 'country',
	region: 'region',
	processing: 'processing',
	drying_method: 'dryingMethod',
	roast_recs: 'roastRecommendations',
	lot_size: 'lotSize',
	bag_size: 'bagSize',
	packaging: 'packaging',
	cultivar_detail: 'cultivarDetail',
	grade: 'grade',
	appearance: 'appearance',
	description_short: 'shortDescription',
	farm_notes: 'farmNotes',
	type: 'type',
	description_long: 'longDescription',
	cost_lb: 'costPerLb',
	source: 'source',
	cupping_notes: 'supplierCuppingNotes',
	arrival_date: 'arrivalDate',
	score_value: 'scoreValue'
} as const;

function manualInventoryRequest(bean: Record<string, unknown>): ManualInventoryCreateRequest {
	const manualCoffee: Record<string, string | number> = {
		name: String(bean.manual_name ?? '')
	};

	for (const [legacyField, parchmentField] of Object.entries(MANUAL_COFFEE_FIELD_MAP)) {
		const value = bean[legacyField];
		if (typeof value === 'string' && value.trim() !== '') {
			manualCoffee[parchmentField] = value;
		} else if (typeof value === 'number' && Number.isFinite(value)) {
			manualCoffee[parchmentField] = value;
		}
	}

	return {
		manualCoffee: manualCoffee as ManualInventoryCreateRequest['manualCoffee'],
		qty: bean.purchased_qty_lbs as number,
		...(typeof bean.purchase_date === 'string' && bean.purchase_date
			? { purchaseDate: bean.purchase_date }
			: {}),
		...(typeof bean.bean_cost === 'number' ? { cost: bean.bean_cost } : {}),
		...(typeof bean.tax_ship_cost === 'number' ? { taxShip: bean.tax_ship_cost } : {}),
		...(typeof bean.notes === 'string' && bean.notes ? { notes: bean.notes } : {})
	};
}

const MANUAL_CATALOG_PROJECTION_FIELDS = [
	'name',
	'score_value',
	'arrival_date',
	'continent',
	'country',
	'region',
	'processing',
	'drying_method',
	'lot_size',
	'bag_size',
	'packaging',
	'cultivar_detail',
	'grade',
	'appearance',
	'roast_recs',
	'type',
	'description_short',
	'description_long',
	'farm_notes',
	'link',
	'cost_lb',
	'price_per_lb',
	'source',
	'stocked',
	'cupping_notes',
	'stocked_date',
	'unstocked_date',
	'ai_description',
	'ai_tasting_notes',
	'public_coffee',
	'wholesale',
	'price_tiers'
] as const;

/**
 * The inventory SDK intentionally returns a compact catalog projection. Manual
 * creation already has the authoritative submitted catalog fields, so merge
 * those fields back into the established coffee-app projection without making
 * a second cookie-bound Supabase query.
 */
function adaptManualInventoryResponse(
	resource: Record<string, unknown>,
	bean: Record<string, unknown>
): Record<string, unknown> {
	const upstreamCatalog =
		typeof resource.coffee_catalog === 'object' && resource.coffee_catalog !== null
			? (resource.coffee_catalog as Record<string, unknown>)
			: {};
	const catalog: Record<string, unknown> = Object.fromEntries(
		MANUAL_CATALOG_PROJECTION_FIELDS.map((field) => [field, null])
	);

	Object.assign(catalog, upstreamCatalog);
	for (const field of Object.keys(MANUAL_COFFEE_FIELD_MAP)) {
		const value = bean[field];
		if (value !== undefined && value !== null && value !== '') {
			catalog[field] = value;
		}
	}

	catalog.id = upstreamCatalog.id ?? resource.catalog_id ?? null;
	catalog.name = upstreamCatalog.name ?? bean.manual_name ?? null;
	catalog.public_coffee = upstreamCatalog.public_coffee ?? false;

	return {
		...resource,
		coffee_catalog: catalog
	};
}

function parchmentErrorResponse(error: unknown): { error: string; code?: string } {
	if (typeof error !== 'object' || error === null || !('error' in error)) {
		return { error: 'Failed to create bean' };
	}
	const envelope = error.error;
	if (typeof envelope !== 'object' || envelope === null) {
		return { error: 'Failed to create bean' };
	}

	const response = {
		error:
			'message' in envelope && typeof envelope.message === 'string'
				? envelope.message
				: 'Failed to create bean'
	} as { error: string; code?: string };
	if ('code' in envelope && typeof envelope.code === 'string') {
		response.code = envelope.code;
	}
	return response;
}

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	try {
		const id = url.searchParams.get('id');
		const shareToken = url.searchParams.get('share');

		let query = buildGreenCoffeeQuery(locals.supabase);
		let includeRoastProfiles = true;

		// If share token is provided, verify it and show shared data
		if (shareToken) {
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
		} else {
			// Standard Portfolio access: Parchment Intelligence or Mallard Studio users see their own data.
			const { user, memberAccess } = await requireParchmentAccess(event);
			includeRoastProfiles = memberAccess;

			query = query.eq('user', user.id);

			if (id) {
				query = query.eq('id', id);
			}
		}

		const { data: rows, error } = await query;
		if (error) throw error;

		// Process data consistently. Parchment Intelligence-only users can manage Portfolio
		// rows, but Mallard roast history remains member-only.
		const processedData = processGreenCoffeeData(rows || []);
		const responseData = includeRoastProfiles
			? processedData
			: stripRoastProfileData(processedData);

		return json({
			data: responseData,
			searchState: Object.fromEntries(url.searchParams.entries())
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ data: [], error: error.message }, { status: error.status });
		}

		console.error('Error querying beans:', error);
		return json({ data: [], error: 'Failed to fetch beans' });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { user } = await requireParchmentAccess(event);
		const { supabase } = event.locals;

		const bean = await event.request.json();
		const catalogId = bean.catalog_id;

		if (!catalogId && typeof bean.manual_name === 'string' && bean.manual_name.trim()) {
			const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
			if (!idempotencyKey) {
				return json(
					{ error: 'Idempotency-Key is required for manual coffee creation' },
					{ status: 400 }
				);
			}

			const client = await createParchmentServerClient(event, { mode: 'session' });
			const { data, error, response } = await client.inventory.create(
				manualInventoryRequest(bean),
				{ idempotencyKey }
			);

			if (error || !data?.data) {
				return json(parchmentErrorResponse(error), { status: response?.status ?? 500 });
			}

			// Parchment owns the authenticated mutation and returns the same owner-scoped
			// resource. Do not re-query it through the cookie-only Supabase client: a
			// bearer-session request has no Supabase auth cookie to authorize that query.
			return json(
				stripRoastProfileData([
					adaptManualInventoryResponse(
						data.data as unknown as Record<string, unknown>,
						bean as Record<string, unknown>
					)
				])[0]
			);
		}

		if (!catalogId) {
			return json(
				{ error: 'A catalog reference or manual coffee name is required' },
				{ status: 400 }
			);
		}

		// If this bean references a catalog item, verify it exists
		const { data: catalogBean, error: catalogError } = await supabase
			.from('coffee_catalog')
			.select('id')
			.eq('id', catalogId)
			.single();

		if (catalogError || !catalogBean) {
			return json({ error: 'Invalid catalog reference' }, { status: 400 });
		}

		const created = await addToInventory(supabase, user.id, {
			catalog_id: catalogId ?? null,
			rank: bean.rank,
			notes: bean.notes,
			purchase_date: bean.purchase_date,
			purchased_qty_lbs: bean.purchased_qty_lbs,
			bean_cost: bean.bean_cost,
			tax_ship_cost: bean.tax_ship_cost,
			stocked: bean.stocked,
			cupping_notes: bean.cupping_notes
		});

		return json(created);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Manual inventory creation is temporarily unavailable' },
				{ status: 503 }
			);
		}

		console.error('Error creating bean:', error);
		return json({ error: 'Failed to create bean' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const { user } = await requireParchmentAccess(event);
		const { supabase } = event.locals;
		const { url, request } = event;

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const updates = await request.json();
		const { id: _, ...rawUpdateData } = updates;

		// Filter to only include actual green_coffee_inv table columns
		const updateData = pickColumns(rawUpdateData, GREEN_COFFEE_INV_COLUMNS);

		let updated;
		try {
			updated = await updateInventory(supabase, Number(id), user.id, updateData);
		} catch (err) {
			if (err instanceof Error && err.message === 'Unauthorized') {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
			throw err;
		}

		// Stocked status auto-update is handled inside updateInventory()
		// when purchased_qty_lbs changes, so the returned data is always fresh.
		return json(updated);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ success: false, error: error.message }, { status: error.status });
		}

		console.error('Error updating bean:', error);
		return json({ success: false, error: 'Failed to update bean' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const { user } = await requireParchmentAccess(event);
		const { supabase } = event.locals;
		const { url } = event;

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'No ID provided' }, { status: 400 });
		}

		try {
			await deleteInventoryItem(supabase, Number(id), user.id);
		} catch (err) {
			if (err instanceof Error && err.message === 'Unauthorized') {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}
			throw err;
		}

		return json({ success: true });
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ success: false, error: error.message }, { status: error.status });
		}

		console.error('Error deleting bean and associated data:', error);
		return json({ success: false, error: 'Failed to delete bean' }, { status: 500 });
	}
};
