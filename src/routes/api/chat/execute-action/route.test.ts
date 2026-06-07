import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireChatAccess, mockUpdateStockedStatus } = vi.hoisted(() => ({
	mockRequireChatAccess: vi.fn(),
	mockUpdateStockedStatus: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireChatAccess: mockRequireChatAccess
}));

vi.mock('$lib/server/stockedStatusUtils', () => ({
	updateStockedStatus: mockUpdateStockedStatus
}));

let POST: typeof import('./+server').POST;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ POST } = await import('./+server'));
	mockRequireChatAccess.mockResolvedValue({
		user: { id: 'user-123' },
		role: 'viewer',
		principal: {},
		ppiAccess: true,
		memberAccess: false
	});
});

function createSupabaseMock() {
	const inventoryInsert = vi.fn(() => ({
		select: vi.fn(() => ({
			single: vi.fn(async () => ({ data: { id: 42 }, error: null }))
		}))
	}));

	const from = vi.fn((table: string) => {
		if (table === 'green_coffee_inv') {
			return { insert: inventoryInsert };
		}

		throw new Error(`Unexpected table lookup: ${table}`);
	});

	return { from, inventoryInsert };
}

function makeEvent(body: unknown, supabase = createSupabaseMock()) {
	return {
		request: new Request('https://app.test/api/chat/execute-action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { supabase }
	} as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('/api/chat/execute-action entitlement gating', () => {
	it('allows Parchment Intelligence users to execute exposed portfolio add actions', async () => {
		const supabase = createSupabaseMock();
		const response = await POST(
			makeEvent(
				{
					actionType: 'add_bean_to_inventory',
					fields: {
						catalog_id: 123,
						purchased_qty_lbs: 10,
						cost_per_lb: 4.25,
						purchase_date: '2026-06-07'
					}
				},
				supabase
			)
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			id: 42,
			message: 'Bean added to inventory'
		});
		expect(supabase.inventoryInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				user: 'user-123',
				catalog_id: 123,
				purchased_qty_lbs: 10,
				bean_cost: 42.5
			})
		);
	});

	it('keeps roast and sales actions behind Mallard Studio membership', async () => {
		const supabase = createSupabaseMock();
		const response = await POST(
			makeEvent(
				{
					actionType: 'record_sale',
					fields: { green_coffee_inv_id: 42 }
				},
				supabase
			)
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Mallard Studio access required for this action'
		});
		expect(supabase.inventoryInsert).not.toHaveBeenCalled();
	});
});
