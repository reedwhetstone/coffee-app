import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { cookieSessionPrincipal, anonymousPrincipal } from '$lib/server/principal.test-utils';

const list = vi.fn();
const createParchmentServerClient = vi.fn(async () => ({
	billing: { subscriptions: { list } }
}));

vi.mock('$lib/server/parchmentClient', () => ({ createParchmentServerClient }));

let load: typeof import('./+page.server').load;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	({ load } = await import('./+page.server'));
});

function signedInEvent() {
	const user = { id: 'user-123', email: 'member@example.com' };
	const session = { access_token: 'session-token', user } as Session;
	return {
		locals: {
			principal: cookieSessionPrincipal('member', {
				session,
				user: user as never,
				apiPlan: 'member',
				ppiAccess: true
			})
		}
	} as Parameters<typeof load>[0];
}

describe('/subscription page server load', () => {
	it('loads canonical subscriptions only through the session SDK client', async () => {
		const subscriptions = [
			{
				subscriptionId: 'sub_123',
				customerId: 'cus_123',
				checkoutSessionId: 'cs_123',
				status: 'active',
				cancelAtPeriodEnd: false,
				currentPeriodEnd: '2026-09-01T00:00:00.000Z',
				items: [
					{
						subscriptionItemId: 'si_1',
						priceId: 'price_1',
						purchaseKey: 'membership.monthly',
						productFamily: 'membership'
					},
					{
						subscriptionItemId: 'si_2',
						priceId: 'price_2',
						purchaseKey: 'ppi_addon.monthly',
						productFamily: 'ppi_addon'
					}
				]
			}
		];
		list.mockResolvedValue({ data: { subscriptions }, error: undefined });

		const result = (await load(signedInEvent())) as Record<string, unknown>;

		expect(createParchmentServerClient).toHaveBeenCalledWith(expect.anything(), {
			mode: 'session',
			preferHandling: 'inherit'
		});
		expect(list).toHaveBeenCalledOnce();
		expect(result.subscriptions).toEqual([
			{
				subscriptionId: 'sub_123',
				status: 'active',
				cancelAtPeriodEnd: false,
				currentPeriodEnd: '2026-09-01T00:00:00.000Z',
				items: [
					{ purchaseKey: 'membership.monthly', productFamily: 'membership' },
					{ purchaseKey: 'ppi_addon.monthly', productFamily: 'ppi_addon' }
				]
			}
		]);
		const serializedPageData = JSON.stringify(result.subscriptions);
		expect(serializedPageData).not.toContain('cus_123');
		expect(serializedPageData).not.toContain('cs_123');
		expect(serializedPageData).not.toContain('si_1');
		expect(serializedPageData).not.toContain('price_1');
		expect(result.accountState).toEqual({ role: 'member', apiPlan: 'member', ppiAccess: true });
	});

	it('does not call Parchment for an anonymous page load', async () => {
		const result = (await load({
			locals: { principal: anonymousPrincipal() }
		} as Parameters<typeof load>[0])) as Record<string, unknown>;

		expect(createParchmentServerClient).not.toHaveBeenCalled();
		expect(result).toEqual({ subscriptions: [], billingError: null, accountState: null });
	});

	it('keeps account presentation available when the canonical billing read is unavailable', async () => {
		list.mockRejectedValue(new Error('network unavailable'));

		const result = (await load(signedInEvent())) as Record<string, unknown>;

		expect(result.subscriptions).toEqual([]);
		expect(result.billingError).toBe('Billing details are temporarily unavailable.');
		expect(result.accountState).toEqual({ role: 'member', apiPlan: 'member', ppiAccess: true });
	});
});
