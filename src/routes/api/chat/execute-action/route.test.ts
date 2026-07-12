import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireChatAccess } = vi.hoisted(() => ({
	mockRequireChatAccess: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	requireChatAccess: mockRequireChatAccess
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
	const rpc = vi.fn<
		(
			...args: unknown[]
		) => Promise<{ data: unknown; error: null | { code: string; message: string } }>
	>(async () => ({
		data: {
			status: 'success',
			replayed: false,
			result: { success: true, id: 42, message: 'Bean added to inventory' }
		},
		error: null
	}));
	return { rpc };
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
					executionId: 'message-1:tool-1',
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
			message: 'Bean added to inventory',
			replayed: false
		});
		expect(supabase.rpc).toHaveBeenCalledWith(
			'execute_chat_action',
			expect.objectContaining({ p_execution_id: 'message-1:tool-1' })
		);
	});

	it('keeps roast and sales actions behind Mallard Studio membership', async () => {
		const supabase = createSupabaseMock();
		const response = await POST(
			makeEvent(
				{
					executionId: 'message-2:tool-2',
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
		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it('replays the same execution key through the server ledger without another route-level write', async () => {
		const supabase = createSupabaseMock();
		supabase.rpc.mockResolvedValue({
			data: { status: 'success', replayed: true, result: { success: true, id: 42 } },
			error: null
		});
		const response = await POST(
			makeEvent(
				{ executionId: 'same-key', actionType: 'update_bean', fields: { bean_id: 42, notes: 'x' } },
				supabase
			)
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true, id: 42, replayed: true });
		expect(supabase.rpc).toHaveBeenCalledTimes(1);
	});

	it('returns conflict when an execution key is reused with different fields', async () => {
		const supabase = createSupabaseMock();
		supabase.rpc.mockResolvedValue({
			data: null,
			error: { code: '23505', message: 'Execution ID conflicts with a different action payload' }
		});
		const response = await POST(
			makeEvent(
				{
					executionId: 'conflict-key',
					actionType: 'update_bean',
					fields: { bean_id: 42, notes: 'different' }
				},
				supabase
			)
		);
		expect(response.status).toBe(409);
	});
});
