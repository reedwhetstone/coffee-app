import type { PageServerLoad } from './$types';
import { getPageAuthState } from '$lib/server/pageAuth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

export const load: PageServerLoad = async (event) => {
	const { user, role } = getPageAuthState(event.locals.principal);

	if (!user) {
		return {
			subscriptions: [],
			billingError: null,
			accountState: null
		};
	}

	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		const result = await client.billing.subscriptions.list();
		const subscriptions = (result.data?.subscriptions ?? []).map((subscription) => ({
			subscriptionId: subscription.subscriptionId,
			status: subscription.status,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			currentPeriodEnd: subscription.currentPeriodEnd,
			items: subscription.items.map((item) => ({
				purchaseKey: item.purchaseKey,
				productFamily: item.productFamily
			}))
		}));

		return {
			subscriptions,
			billingError: result.error?.error?.message ?? null,
			accountState: {
				role,
				apiPlan: event.locals.principal.apiPlan ?? 'viewer',
				ppiAccess: event.locals.principal.ppiAccess
			}
		};
	} catch {
		return {
			subscriptions: [],
			billingError: 'Billing details are temporarily unavailable.',
			accountState: {
				role,
				apiPlan: event.locals.principal.apiPlan ?? 'viewer',
				ppiAccess: event.locals.principal.ppiAccess
			}
		};
	}
};
