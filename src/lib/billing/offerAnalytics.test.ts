import { beforeEach, describe, expect, it, vi } from 'vitest';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@vercel/analytics/sveltekit', () => ({ track }));

import { trackBillingOfferEvent } from './offerAnalytics';

describe('billing offer analytics', () => {
	beforeEach(() => track.mockReset());

	it('records stable offer metadata without provider identifiers', () => {
		trackBillingOfferEvent('billing_checkout_started', 'both-monthly');

		expect(track).toHaveBeenCalledWith('billing_checkout_started', {
			offerId: 'both-monthly',
			offerName: 'Studio + Intelligence',
			price: '$6',
			interval: '/month',
			trialDays: 5
		});
	});
});
