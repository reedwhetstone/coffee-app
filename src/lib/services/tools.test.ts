import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventoryMocks = vi.hoisted(() => ({
	listInventory: vi.fn(),
	addInventory: vi.fn(),
	updateInventory: vi.fn()
}));

vi.mock('@purveyors/cli/inventory', () => inventoryMocks);

import { createChatTools } from './tools';

const supabase = {} as Parameters<typeof createChatTools>[0];

function toolNames(access: Parameters<typeof createChatTools>[2]) {
	return Object.keys(createChatTools(supabase, 'user-123', access)).sort();
}

describe('createChatTools entitlement allowlist', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('keeps the full tool set for Mallard Studio members', () => {
		expect(toolNames({ memberAccess: true, ppiAccess: false })).toEqual([
			'add_bean_to_inventory',
			'bean_tasting_notes',
			'catalog_facets',
			'catalog_rank',
			'coffee_catalog_search',
			'create_roast_session',
			'find_similar_beans',
			'green_coffee_inventory',
			'present_results',
			'record_sale',
			'roast_profiles',
			'supplier_list',
			'update_bean',
			'update_roast_notes'
		]);
	});

	it('limits Parchment Intelligence-only users to sourcing, catalog, market, and portfolio tools', () => {
		expect(toolNames({ memberAccess: false, ppiAccess: true })).toEqual([
			'add_bean_to_inventory',
			'catalog_facets',
			'catalog_rank',
			'coffee_catalog_search',
			'find_similar_beans',
			'green_coffee_inventory',
			'present_results',
			'supplier_list',
			'update_bean'
		]);
	});

	it('registers price_index_read only when the server injects a reader', () => {
		const readPriceIndex = vi.fn();

		const memberNames = Object.keys(
			createChatTools(
				supabase,
				'user-123',
				{ memberAccess: true, ppiAccess: false },
				{ readPriceIndex }
			)
		);
		const ppiNames = Object.keys(
			createChatTools(
				supabase,
				'user-123',
				{ memberAccess: false, ppiAccess: true },
				{ readPriceIndex }
			)
		);
		const viewerNames = Object.keys(
			createChatTools(
				supabase,
				'user-123',
				{ memberAccess: false, ppiAccess: false },
				{ readPriceIndex }
			)
		);

		expect(memberNames).toContain('price_index_read');
		expect(ppiNames).toContain('price_index_read');
		expect(viewerNames).not.toContain('price_index_read');
		expect(toolNames({ memberAccess: true, ppiAccess: false })).not.toContain('price_index_read');
	});

	it('gives viewers only catalog search, facets, and presentation', () => {
		expect(toolNames({ memberAccess: false, ppiAccess: false })).toEqual([
			'catalog_facets',
			'coffee_catalog_search',
			'present_results'
		]);
	});

	it('does not expose roasting-only tools to Parchment Intelligence-only users', () => {
		const names = toolNames({ memberAccess: false, ppiAccess: true });

		expect(names).not.toContain('roast_profiles');
		expect(names).not.toContain('bean_tasting_notes');
		expect(names).not.toContain('create_roast_session');
		expect(names).not.toContain('update_roast_notes');
		expect(names).not.toContain('record_sale');
	});

	it('strips roast profiles from Parchment Intelligence-only inventory tool results', async () => {
		inventoryMocks.listInventory.mockResolvedValue([
			{
				id: 1,
				purchased_qty_lbs: 2,
				bean_cost: 12,
				tax_ship_cost: 3,
				stocked: true,
				roast_profiles: [{ roast_id: 10, batch_name: 'Hidden roast' }]
			}
		]);

		const tools = createChatTools(supabase, 'user-123', { memberAccess: false, ppiAccess: true });
		const executeInventory = tools.green_coffee_inventory.execute as unknown as (input: {
			stocked_only: boolean;
			limit: number;
		}) => Promise<{
			inventory: Array<{ roast_profiles?: unknown[] }>;
			filters_applied: { include_roast_summary: boolean };
		}>;
		const result = await executeInventory({ stocked_only: true, limit: 5 });

		expect(inventoryMocks.listInventory).toHaveBeenCalledWith(supabase, 'user-123', {
			stocked_only: true,
			limit: 5
		});
		expect(result?.inventory[0].roast_profiles).toEqual([]);
		expect(result?.filters_applied.include_roast_summary).toBe(false);
	});

	it('keeps roast profiles in Mallard Studio inventory tool results', async () => {
		const roastProfiles = [{ roast_id: 10, batch_name: 'Visible roast' }];
		inventoryMocks.listInventory.mockResolvedValue([
			{
				id: 1,
				purchased_qty_lbs: 2,
				bean_cost: 12,
				tax_ship_cost: 3,
				stocked: true,
				roast_profiles: roastProfiles
			}
		]);

		const tools = createChatTools(supabase, 'user-123', { memberAccess: true, ppiAccess: false });
		const executeInventory = tools.green_coffee_inventory.execute as unknown as (input: {
			stocked_only: boolean;
			limit: number;
		}) => Promise<{
			inventory: Array<{ roast_profiles?: unknown[] }>;
			filters_applied: { include_roast_summary: boolean };
		}>;
		const result = await executeInventory({ stocked_only: true, limit: 5 });

		expect(inventoryMocks.listInventory).toHaveBeenCalledWith(supabase, 'user-123', {
			stocked_only: true,
			limit: 5
		});
		expect(result?.inventory[0].roast_profiles).toBe(roastProfiles);
		expect(result?.filters_applied.include_roast_summary).toBe(true);
	});
});
