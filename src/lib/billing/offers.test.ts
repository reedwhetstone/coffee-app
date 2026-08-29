import { describe, expect, it } from 'vitest';
import {
	BILLING_OFFERS,
	getBillingOffer,
	hasBundledBillingSubscription,
	hasInteractiveBillingSubscription,
	purchaseItemsMatchOffer
} from './offers';
import { BILLING_PURCHASE_KEYS } from './purchaseKeys';

describe('billing offers', () => {
	it('defines the monthly Studio, Intelligence, and combined new-sale prices', () => {
		expect(BILLING_OFFERS.studioMonthly).toMatchObject({
			offerId: 'studio-monthly',
			price: '$3',
			trialDays: 5,
			purchaseItems: [{ purchaseKey: 'membership.monthly', quantity: 1 }]
		});
		expect(BILLING_OFFERS.intelligenceMonthly).toMatchObject({
			offerId: 'intelligence-monthly',
			price: '$5',
			trialDays: 5,
			purchaseItems: [{ purchaseKey: 'ppi_addon.monthly', quantity: 1 }]
		});
		expect(BILLING_OFFERS.bothMonthly).toMatchObject({
			offerId: 'both-monthly',
			price: '$6',
			trialDays: 5,
			purchaseItems: [
				{ purchaseKey: 'membership.monthly', quantity: 1 },
				{ purchaseKey: 'ppi_addon.bundle_monthly', quantity: 1 }
			]
		});
	});

	it('keeps API checkout pricing and purchase-key behavior unchanged', () => {
		expect(BILLING_OFFERS.apiMonthly).toMatchObject({
			offerId: 'api-monthly',
			price: '$99',
			trialDays: 5,
			purchaseItems: [{ purchaseKey: 'api_plan.monthly', quantity: 1 }]
		});
	});

	it('preserves historical annual keys without exposing annual new-sale offers', () => {
		expect(BILLING_PURCHASE_KEYS.membershipAnnual).toBe('membership.annual');
		expect(BILLING_PURCHASE_KEYS.ppiAddonAnnual).toBe('ppi_addon.annual');
		expect(Object.values(BILLING_OFFERS).every((offer) => offer.interval === '/month')).toBe(true);
	});

	it('treats ordered complete item sets as part of offer identity', () => {
		const offer = getBillingOffer('both-monthly');
		expect(offer).not.toBeNull();
		expect(purchaseItemsMatchOffer(BILLING_OFFERS.bothMonthly.purchaseItems, offer!)).toBe(true);
		expect(
			purchaseItemsMatchOffer(
				[BILLING_OFFERS.bothMonthly.purchaseItems[1], BILLING_OFFERS.bothMonthly.purchaseItems[0]],
				offer!
			)
		).toBe(false);
	});

	it('holds every new interactive checkout when an interactive subscription already exists', () => {
		expect(hasInteractiveBillingSubscription([])).toBe(false);
		expect(
			hasInteractiveBillingSubscription([
				{ status: 'active', items: [{ productFamily: 'api_plan' }] }
			])
		).toBe(false);
		expect(
			hasInteractiveBillingSubscription([
				{ status: 'active', items: [{ productFamily: 'membership' }] }
			])
		).toBe(true);
		expect(
			hasInteractiveBillingSubscription([
				{ status: 'trialing', items: [{ productFamily: 'ppi_addon' }] }
			])
		).toBe(true);
	});

	it('does not treat canceled historical interactive snapshots as active', () => {
		expect(
			hasInteractiveBillingSubscription([
				{ status: 'canceled', items: [{ productFamily: 'membership' }] }
			])
		).toBe(false);
		expect(
			hasBundledBillingSubscription([
				{
					status: 'canceled',
					items: [{ productFamily: 'membership' }, { productFamily: 'ppi_addon' }]
				}
			])
		).toBe(false);
	});

	it('recognizes a bundle only when both product families share one subscription', () => {
		expect(
			hasBundledBillingSubscription([
				{ status: 'active', items: [{ productFamily: 'membership' }] },
				{ status: 'active', items: [{ productFamily: 'ppi_addon' }] }
			])
		).toBe(false);
		expect(
			hasBundledBillingSubscription([
				{
					status: 'active',
					items: [{ productFamily: 'membership' }, { productFamily: 'ppi_addon' }]
				}
			])
		).toBe(true);
	});
});
