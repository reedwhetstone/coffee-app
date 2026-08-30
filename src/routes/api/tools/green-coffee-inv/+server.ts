/**
 * @deprecated This endpoint is kept for backward compatibility only.
 * Cherry Runtime now calls the session-mode Parchment SDK directly.
 * Do not add new consumers — use the SDK client instead.
 */
import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchParchmentCatalogItemsByIds } from '$lib/server/parchmentCatalog';
import {
	attachRoastSummaries,
	type InventoryResult,
	type InventoryRoastSummary
} from '$lib/services/tools/shared';
import { unwrapParchment } from '$lib/services/tools/parchment';
import { collectOffsetPages } from '$lib/services/tools/pagination';

// Interface for tool input validation
interface GreenCoffeeInvToolInput {
	stocked_only?: boolean;
	include_catalog_details?: boolean;
	include_roast_summary?: boolean;
	limit?: number;
}

type LegacyInventoryItem = Omit<InventoryResult, 'coffee_catalog'> & {
	coffee_catalog?: (Record<string, unknown> & { name?: string | null }) | null;
	coffee_name?: string;
	roast_summary?: InventoryRoastSummary;
};

function comparePurchaseDateDescending(a: InventoryResult, b: InventoryResult): number {
	if (a.purchase_date == null) return b.purchase_date == null ? compareLastUpdated(a, b) : -1;
	if (b.purchase_date == null) return 1;
	return b.purchase_date.localeCompare(a.purchase_date) || compareLastUpdated(a, b);
}

function compareLastUpdated(a: InventoryResult, b: InventoryResult): number {
	return b.last_updated.localeCompare(a.last_updated);
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		await requireMemberRole(event);

		const input: GreenCoffeeInvToolInput = await event.request.json();

		// Default parameters
		const {
			stocked_only = true,
			include_catalog_details = true,
			include_roast_summary = true,
			limit = 15
		} = input;

		const finalLimit = Math.min(limit || 15, 15);

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const allInventory = await collectOffsetPages({
			fetchPage: async (offset) => {
				const response = await client.inventory.list({
					stocked_only,
					limit: 200,
					offset
				});
				return unwrapParchment(response).data;
			},
			key: (bean) => bean.id
		});
		const rawInventory = [...allInventory].sort(comparePurchaseDateDescending).slice(0, finalLimit);
		let inventory: LegacyInventoryItem[] = include_roast_summary
			? await attachRoastSummaries(client, rawInventory)
			: rawInventory;

		if (include_catalog_details) {
			const catalogIds = inventory
				.map((bean) => bean.catalog_id)
				.filter((id): id is number => typeof id === 'number');
			const catalog = await fetchParchmentCatalogItemsByIds(client, catalogIds);
			const catalogById = new Map<number, Record<string, unknown>>();
			for (const item of catalog) {
				if (typeof item.id === 'number') catalogById.set(item.id, item);
			}
			inventory = inventory.map((bean) => ({
				...bean,
				coffee_catalog:
					bean.catalog_id == null
						? bean.coffee_catalog
						: {
								...bean.coffee_catalog,
								...catalogById.get(bean.catalog_id)
							}
			}));
		} else {
			inventory = inventory.map((bean) => {
				const { coffee_catalog, ...beanWithoutCatalog } = bean;
				return {
					...beanWithoutCatalog,
					coffee_name: coffee_catalog?.name || 'Unknown'
				};
			});
		}

		// Calculate summary statistics
		const summary = {
			total_beans: inventory.length,
			total_weight_lbs: inventory.reduce((sum, bean) => sum + (bean.purchased_qty_lbs || 0), 0),
			total_value: inventory.reduce((sum, bean) => {
				const beanCost = bean.bean_cost || 0;
				const taxShipCost = bean.tax_ship_cost || 0;
				return sum + beanCost + taxShipCost;
			}, 0),
			stocked_beans: inventory.filter((bean) => bean.stocked).length
		};

		return json({
			inventory,
			total: inventory.length,
			summary,
			filters_applied: {
				stocked_only,
				include_catalog_details,
				include_roast_summary,
				limit: finalLimit
			}
		});
	} catch (error) {
		console.error('Green coffee inventory tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
