import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireMemberRole: vi.fn(),
	createParchmentServerClient: vi.fn(),
	fetchParchmentCatalogItemsByIds: vi.fn(),
	attachRoastSummaries: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireMemberRole: mocks.requireMemberRole
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createParchmentServerClient
}));

vi.mock('$lib/server/parchmentCatalog', () => ({
	fetchParchmentCatalogItemsByIds: mocks.fetchParchmentCatalogItemsByIds
}));

vi.mock('$lib/services/tools/shared', () => ({
	attachRoastSummaries: mocks.attachRoastSummaries
}));

import { POST } from './+server';

function makeEvent(body: Record<string, unknown>) {
	return {
		request: new Request('https://app.test/api/tools/green-coffee-inv', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

describe('legacy green-coffee inventory tool route', () => {
	const inventoryList = vi.fn();
	const client = {
		inventory: { list: inventoryList },
		roasts: { list: vi.fn() },
		catalog: { list: vi.fn() }
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireMemberRole.mockResolvedValue({ user: { id: 'owner-1' } });
		mocks.createParchmentServerClient.mockResolvedValue(client);
		inventoryList.mockImplementation(async ({ offset = 0 }: { offset?: number }) => ({
			data: {
				data:
					offset === 0
						? [
								{
									id: 7,
									catalog_id: 101,
									purchase_date: '2026-07-26',
									last_updated: '2026-07-26T00:00:00Z',
									purchased_qty_lbs: 5,
									bean_cost: 42,
									tax_ship_cost: 3,
									stocked: true,
									coffee_catalog: { id: 101, name: 'Compact name' }
								}
							]
						: []
			}
		}));
		mocks.attachRoastSummaries.mockImplementation(async (_client, rows) =>
			rows.map((row: Record<string, unknown>) => ({
				...row,
				roast_summary: {
					total_roasts: 2,
					last_roast_date: '2026-07-26',
					total_oz_in: 24,
					total_oz_out: 20
				}
			}))
		);
		mocks.fetchParchmentCatalogItemsByIds.mockResolvedValue([
			{ id: 101, name: 'Full name', farm_notes: 'Producer detail' }
		]);
	});

	it('reads inventory, catalog details, and roast summaries through the session SDK', async () => {
		const response = await POST(
			makeEvent({
				stocked_only: false,
				include_catalog_details: true,
				include_roast_summary: true,
				limit: 99
			}) as never
		);

		expect(response.status).toBe(200);
		expect(mocks.requireMemberRole).toHaveBeenCalledOnce();
		expect(mocks.createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session'
		});
		expect(inventoryList).toHaveBeenCalledWith({ stocked_only: false, limit: 200, offset: 0 });
		expect(mocks.attachRoastSummaries).toHaveBeenCalledWith(
			client,
			expect.arrayContaining([expect.objectContaining({ id: 7 })])
		);
		expect(mocks.fetchParchmentCatalogItemsByIds).toHaveBeenCalledWith(client, [101]);
		expect(await response.json()).toMatchObject({
			inventory: [
				{
					id: 7,
					coffee_catalog: {
						id: 101,
						name: 'Full name',
						farm_notes: 'Producer detail'
					},
					roast_summary: {
						total_roasts: 2,
						total_oz_in: 24,
						total_oz_out: 20
					}
				}
			],
			total: 1,
			summary: {
				total_beans: 1,
				total_weight_lbs: 5,
				total_value: 45,
				stocked_beans: 1
			},
			filters_applied: {
				stocked_only: false,
				include_catalog_details: true,
				include_roast_summary: true,
				limit: 15
			}
		});
	});

	it('preserves the legacy compact projection without extra API calls', async () => {
		const response = await POST(
			makeEvent({
				include_catalog_details: false,
				include_roast_summary: false,
				limit: 5
			}) as never
		);

		expect(response.status).toBe(200);
		expect(inventoryList).toHaveBeenCalledWith({ stocked_only: true, limit: 200, offset: 0 });
		expect(mocks.attachRoastSummaries).not.toHaveBeenCalled();
		expect(mocks.fetchParchmentCatalogItemsByIds).not.toHaveBeenCalled();
		expect(await response.json()).toMatchObject({
			inventory: [
				{
					id: 7,
					coffee_name: 'Compact name'
				}
			],
			filters_applied: {
				include_catalog_details: false,
				include_roast_summary: false
			}
		});
	});

	it('preserves purchase-date ordering before applying the legacy cap', async () => {
		const rows = Array.from({ length: 16 }, (_, index) => ({
			id: index + 1,
			purchase_date: `2026-07-${String(28 - index).padStart(2, '0')}`,
			last_updated: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
			purchased_qty_lbs: 1,
			bean_cost: 1,
			tax_ship_cost: 0,
			stocked: true,
			coffee_catalog: { name: `Bean ${index + 1}` }
		}));
		const apiOrder = [...rows].reverse();
		inventoryList.mockImplementation(async ({ offset = 0 }: { offset?: number }) => ({
			data: { data: apiOrder.slice(offset, offset + 8) }
		}));

		const response = await POST(
			makeEvent({
				include_catalog_details: false,
				include_roast_summary: false,
				limit: 15
			}) as never
		);
		const body = await response.json();

		expect(body.inventory.map((bean: { id: number }) => bean.id)).toEqual(
			Array.from({ length: 15 }, (_, index) => index + 1)
		);
		expect(body.total).toBe(15);
	});
});
