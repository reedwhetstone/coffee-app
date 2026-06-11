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

	it('keeps similarity reads public-only for Parchment Intelligence-only users', async () => {
		const findSimilarBeans = vi.fn().mockResolvedValue({ matches: [] });
		const tools = createChatTools(
			supabase,
			'user-123',
			{ memberAccess: false, ppiAccess: true },
			{ findSimilarBeans }
		);
		const executeSimilarity = tools.find_similar_beans.execute as unknown as (input: {
			coffee_id: number;
		}) => Promise<unknown>;

		await executeSimilarity({ coffee_id: 42 });

		expect(findSimilarBeans).toHaveBeenCalledWith({ coffee_id: 42 }, { publicOnly: true });
	});

	it('allows full-catalog similarity reads for Mallard Studio members', async () => {
		const findSimilarBeans = vi.fn().mockResolvedValue({ matches: [] });
		const tools = createChatTools(
			supabase,
			'user-123',
			{ memberAccess: true, ppiAccess: false },
			{ findSimilarBeans }
		);
		const executeSimilarity = tools.find_similar_beans.execute as unknown as (input: {
			coffee_id: number;
		}) => Promise<unknown>;

		await executeSimilarity({ coffee_id: 42 });

		expect(findSimilarBeans).toHaveBeenCalledWith({ coffee_id: 42 }, { publicOnly: false });
	});

	it('gives viewers only catalog search, facets, and presentation', () => {
		expect(toolNames({ memberAccess: false, ppiAccess: false })).toEqual([
			'catalog_facets',
			'coffee_catalog_search',
			'present_results'
		]);
	});

	it('sends the model a compact catalog search view via toModelOutput', () => {
		const tools = createChatTools(supabase, 'user-123', { memberAccess: true, ppiAccess: false });
		const toModelOutput = tools.coffee_catalog_search.toModelOutput as (options: {
			toolCallId: string;
			input: unknown;
			output: unknown;
		}) => { type: string; value: Record<string, unknown> };

		const result = toModelOutput({
			toolCallId: 'call-1',
			input: {},
			output: {
				coffees: [{ id: 1, name: 'Hambela', description_long: 'x'.repeat(2000) }],
				total: 1
			}
		});

		expect(result.type).toBe('json');
		const coffees = result.value.coffees as Array<Record<string, unknown>>;
		expect(coffees[0].name).toBe('Hambela');
		expect(coffees[0].description_long).toBeUndefined();
	});

	it('sends the model a compact action card view via toModelOutput', () => {
		const tools = createChatTools(supabase, 'user-123', { memberAccess: true, ppiAccess: false });
		const toModelOutput = tools.add_bean_to_inventory.toModelOutput as (options: {
			toolCallId: string;
			input: unknown;
			output: unknown;
		}) => { type: string; value: Record<string, unknown> };

		const result = toModelOutput({
			toolCallId: 'call-2',
			input: {},
			output: {
				action_card: {
					actionType: 'add_bean_to_inventory',
					summary: 'Add Hambela',
					status: 'proposed',
					fields: [
						{
							key: 'coffee_bean',
							label: 'Coffee Bean',
							value: '1',
							type: 'select',
							editable: true,
							selectOptions: [{ label: 'Hambela', value: '1' }]
						}
					]
				}
			}
		});

		const card = result.value.action_card as Record<string, unknown>;
		const fields = card.fields as Array<Record<string, unknown>>;
		expect(fields[0].selectOptions).toBeUndefined();
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

	it('keeps roast profiles and attaches roast summaries in Mallard Studio inventory tool results', async () => {
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

		const roastRows = [
			{ coffee_id: 1, roast_date: '2026-06-01', oz_in: 16 },
			{ coffee_id: 1, roast_date: '2026-05-20', oz_in: 12 }
		];
		const inMock = vi.fn().mockResolvedValue({ data: roastRows, error: null });
		const supabaseWithRoasts = {
			from: vi.fn(() => ({
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ in: inMock }))
				}))
			}))
		} as unknown as Parameters<typeof createChatTools>[0];

		const tools = createChatTools(supabaseWithRoasts, 'user-123', {
			memberAccess: true,
			ppiAccess: false
		});
		const executeInventory = tools.green_coffee_inventory.execute as unknown as (input: {
			stocked_only: boolean;
			limit: number;
		}) => Promise<{
			inventory: Array<{ roast_profiles?: unknown[]; roast_summary?: unknown }>;
			filters_applied: { include_roast_summary: boolean };
		}>;
		const result = await executeInventory({ stocked_only: true, limit: 5 });

		expect(inventoryMocks.listInventory).toHaveBeenCalledWith(supabaseWithRoasts, 'user-123', {
			stocked_only: true,
			limit: 5
		});
		expect(result?.inventory[0].roast_profiles).toBe(roastProfiles);
		expect(result?.inventory[0].roast_summary).toEqual({
			total_roasts: 2,
			last_roast_date: '2026-06-01',
			total_oz_in: 28
		});
		expect(result?.filters_applied.include_roast_summary).toBe(true);
	});
});
