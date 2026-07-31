import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createCheckoutSession: vi.fn()
}));

vi.mock('stripe', () => ({
	default: class Stripe {
		checkout = { sessions: { create: mocks.createCheckoutSession } };
	}
}));

vi.mock('$lib/supabase-admin', () => ({ createAdminClient: vi.fn() }));

import { createCheckoutSession } from './stripe';

describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createCheckoutSession.mockResolvedValue({
			id: 'cs_managed',
			client_secret: 'cs_secret'
		});
	});

	it('uses only the admission identifier for managed Stripe correlation', async () => {
		await createCheckoutSession(
			['price_123'],
			null,
			'user-private',
			'owner@example.com',
			'https://app.test',
			{
				admissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
				requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
				purchaseFingerprint: 'fingerprint-123'
			}
		);

		const [params, options] = mocks.createCheckoutSession.mock.calls[0];
		expect(params.client_reference_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
		expect(params.metadata).toEqual({
			parchment_admission_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			checkout_request_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
			checkout_purchase_fingerprint: 'fingerprint-123'
		});
		expect(params.subscription_data.metadata).toEqual(params.metadata);
		expect(JSON.stringify(params)).not.toContain('user-private');
		expect(options).toEqual({ idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
	});
});
