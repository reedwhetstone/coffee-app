import { describe, expect, it } from 'vitest';

import { POST } from './+server';

describe('POST /api/stripe/create-customer', () => {
	it('rejects the retired unfenced customer-creation route', async () => {
		const responses = await Promise.all([POST({} as never), POST({} as never)]);

		expect(responses.map((response) => response.status)).toEqual([410, 410]);
		expect(responses[0].headers.get('cache-control')).toBe('no-store');
		expect(await responses[0].json()).toEqual({
			error: {
				code: 'stripe_customer_creation_retired',
				message: 'Use the Checkout flow to create Stripe customer identities.'
			}
		});
	});
});
