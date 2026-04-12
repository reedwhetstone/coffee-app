import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAdminClient = vi.fn();
const mockGetStripe = vi.fn();
const mockReconcileStripeSubscriptionEntitlements = vi.fn();

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: mockCreateAdminClient
}));

vi.mock('$lib/services/stripe', () => ({
	getStripe: mockGetStripe
}));

vi.mock('./entitlements', async () => {
	const actual = await vi.importActual<typeof import('./entitlements')>('./entitlements');
	return {
		...actual,
		reconcileStripeSubscriptionEntitlements: mockReconcileStripeSubscriptionEntitlements
	};
});

let handleReconcileStripeSession: typeof import('./reconcile-session').handleReconcileStripeSession;

function makeUserRolesTable(row: {
	role: string | null;
	user_role: string[] | null;
	api_plan: string | null;
	ppi_access: boolean | null;
}) {
	const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
	const eq = vi.fn(() => ({ maybeSingle }));
	const select = vi.fn(() => ({ eq }));

	return {
		table: { select },
		mocks: { select, eq, maybeSingle }
	};
}

function makeStripeSessionProcessingTable(options: {
	existingCompletedRow: { role_updated: boolean } | null;
}) {
	const maybeSingle = vi.fn(async () => ({ data: options.existingCompletedRow, error: null }));
	const selectEqThird = { maybeSingle };
	const selectEqSecond = { eq: vi.fn(() => selectEqThird) };
	const selectEqFirst = { eq: vi.fn(() => selectEqSecond) };
	const select = vi.fn(() => ({ eq: vi.fn(() => selectEqFirst) }));
	const upsert = vi.fn(async () => ({ error: null }));
	const updateTerminal = { eq: vi.fn(async () => ({ error: null })) };
	const updateSecond = { eq: vi.fn(() => updateTerminal) };
	const update = vi.fn(() => ({ eq: vi.fn(() => updateSecond) }));

	return {
		table: { select, upsert, update },
		mocks: { maybeSingle, select, upsert, update, updateTerminal }
	};
}

function makeSupabase(options: {
	existingCompletedRow?: { role_updated: boolean } | null;
	userRoleRow?: {
		role: string | null;
		user_role: string[] | null;
		api_plan: string | null;
		ppi_access: boolean | null;
	};
}) {
	const stripeSessionProcessing = makeStripeSessionProcessingTable({
		existingCompletedRow: options.existingCompletedRow ?? null
	});
	const userRoles = makeUserRolesTable(
		options.userRoleRow ?? {
			role: 'viewer',
			user_role: ['viewer'],
			api_plan: 'viewer',
			ppi_access: false
		}
	);
	const stripeCustomersUpsert = vi.fn(async () => ({ error: null }));
	const roleAuditInsert = vi.fn(async () => ({ error: null }));

	const from = vi.fn((table: string) => {
		switch (table) {
			case 'stripe_session_processing':
				return stripeSessionProcessing.table;
			case 'user_roles':
				return userRoles.table;
			case 'stripe_customers':
				return { upsert: stripeCustomersUpsert };
			case 'role_audit_logs':
				return { insert: roleAuditInsert };
			default:
				throw new Error(`Unexpected table: ${table}`);
		}
	});

	return {
		supabase: { from },
		mocks: {
			from,
			stripeSessionProcessing: stripeSessionProcessing.mocks,
			userRoles: userRoles.mocks,
			stripeCustomersUpsert,
			roleAuditInsert
		}
	};
}

function makeEvent(options: {
	user?: { id: string; email?: string } | null;
	body?: Record<string, unknown>;
}) {
	const user =
		options.user === undefined ? { id: 'user-123', email: 'user@example.com' } : options.user;

	return {
		request: new Request('https://app.test/api/stripe/reconcile-session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(options.body ?? { sessionId: 'cs_test_123' })
		}),
		locals: {
			safeGetSession: vi.fn().mockResolvedValue({
				session: user ? { user } : null,
				user,
				role: 'viewer',
				roles: ['viewer']
			})
		}
	} as unknown as Parameters<typeof handleReconcileStripeSession>[0];
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ handleReconcileStripeSession } = await import('./reconcile-session'));
});

describe('handleReconcileStripeSession', () => {
	it('requires an authenticated user', async () => {
		const { supabase } = makeSupabase({});
		mockCreateAdminClient.mockReturnValue(supabase);

		const response = await handleReconcileStripeSession(makeEvent({ user: null }));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	it('returns current entitlements when a checkout session was already reconciled', async () => {
		const { supabase } = makeSupabase({
			existingCompletedRow: { role_updated: false },
			userRoleRow: {
				role: 'member',
				user_role: ['member'],
				api_plan: 'viewer',
				ppi_access: false
			}
		});
		mockCreateAdminClient.mockReturnValue(supabase);

		const response = await handleReconcileStripeSession(makeEvent({}));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			entitlementsChanged: false,
			roleUpdated: false,
			message: 'Checkout session already reconciled',
			alreadyProcessed: true,
			entitlements: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: false
			}
		});
	});

	it('reconciles a paid subscription checkout into final entitlements', async () => {
		const { supabase, mocks } = makeSupabase({
			userRoleRow: {
				role: 'viewer',
				user_role: ['viewer'],
				api_plan: 'viewer',
				ppi_access: false
			}
		});
		mockCreateAdminClient.mockReturnValue(supabase);
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					retrieve: vi.fn(async () => ({
						id: 'cs_test_123',
						status: 'complete',
						payment_status: 'paid',
						client_reference_id: 'user-123',
						customer: 'cus_123',
						customer_details: { email: 'user@example.com' },
						mode: 'subscription',
						subscription: 'sub_123',
						amount_total: 900,
						currency: 'usd'
					}))
				}
			},
			subscriptions: {
				retrieve: vi.fn(async () => ({
					id: 'sub_123',
					status: 'active',
					cancel_at_period_end: false,
					current_period_end: 1_777_600_000,
					items: { data: [] }
				}))
			}
		});
		mockReconcileStripeSubscriptionEntitlements.mockResolvedValue({
			rows: [],
			deletedItemIds: [],
			unknownPriceIds: [],
			previousEntitlements: {
				role: 'viewer',
				userRole: ['viewer'],
				apiPlan: 'viewer',
				ppiAccess: false
			},
			resolvedEntitlements: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: false
			},
			changed: true,
			subscriptions: [
				{
					stripe_subscription_id: 'sub_123',
					stripe_price_id: 'price_123',
					product_family: 'membership',
					product_key: 'membership.monthly',
					status: 'active'
				}
			]
		});

		const response = await handleReconcileStripeSession(makeEvent({}));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			success: true,
			entitlementsChanged: true,
			roleUpdated: true,
			message: 'Checkout session reconciled and entitlements updated',
			entitlements: {
				role: 'member',
				userRole: ['member'],
				apiPlan: 'viewer',
				ppiAccess: false
			},
			subscriptionId: 'sub_123',
			sessionId: 'cs_test_123'
		});
		expect(mockReconcileStripeSubscriptionEntitlements).toHaveBeenCalledWith(supabase, {
			userId: 'user-123',
			stripeCustomerId: 'cus_123',
			subscription: expect.objectContaining({ id: 'sub_123', status: 'active' })
		});
		expect(mocks.stripeCustomersUpsert).toHaveBeenCalled();
		expect(mocks.roleAuditInsert).toHaveBeenCalled();
		expect(mocks.stripeSessionProcessing.upsert).toHaveBeenCalled();
		expect(mocks.stripeSessionProcessing.update).toHaveBeenCalled();
	});

	it('rejects checkout sessions that belong to another user', async () => {
		const { supabase } = makeSupabase({});
		mockCreateAdminClient.mockReturnValue(supabase);
		mockGetStripe.mockReturnValue({
			checkout: {
				sessions: {
					retrieve: vi.fn(async () => ({
						id: 'cs_test_123',
						status: 'complete',
						payment_status: 'paid',
						client_reference_id: 'someone-else',
						customer: 'cus_123',
						mode: 'subscription',
						subscription: 'sub_123'
					}))
				}
			}
		});

		const response = await handleReconcileStripeSession(makeEvent({}));

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Session user mismatch' });
	});
});
