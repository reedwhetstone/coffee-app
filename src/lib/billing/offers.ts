import { BILLING_PURCHASE_KEYS, type BillingPurchaseKey } from './purchaseKeys';

export interface BillingPurchaseItem {
	purchaseKey: BillingPurchaseKey;
	quantity: 1;
}

export interface BillingOffer {
	offerId: string;
	name: string;
	price: string;
	interval: '/month';
	trialDays: number | null;
	purchaseItems: readonly BillingPurchaseItem[];
}

interface BillingSubscriptionSummary {
	items: readonly { productFamily: string }[];
}

/**
 * Canonical new-sale checkout offers. Keep each item list ordered and complete:
 * the offer ID owns checkout identity while Parchment owns price resolution.
 */
export const BILLING_OFFERS = {
	studioMonthly: {
		offerId: 'studio-monthly',
		name: 'Mallard Studio',
		price: '$3',
		interval: '/month',
		trialDays: 5,
		purchaseItems: [{ purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly, quantity: 1 }]
	},
	intelligenceMonthly: {
		offerId: 'intelligence-monthly',
		name: 'Parchment Intelligence',
		price: '$5',
		interval: '/month',
		trialDays: 5,
		purchaseItems: [{ purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonMonthly, quantity: 1 }]
	},
	bothMonthly: {
		offerId: 'both-monthly',
		name: 'Studio + Intelligence',
		price: '$6',
		interval: '/month',
		trialDays: 5,
		purchaseItems: [
			{ purchaseKey: BILLING_PURCHASE_KEYS.membershipMonthly, quantity: 1 },
			{ purchaseKey: BILLING_PURCHASE_KEYS.ppiAddonBundleMonthly, quantity: 1 }
		]
	},
	apiMonthly: {
		offerId: 'api-monthly',
		name: 'Parchment API Origin',
		price: '$99',
		interval: '/month',
		trialDays: 5,
		purchaseItems: [{ purchaseKey: BILLING_PURCHASE_KEYS.apiPlanMonthly, quantity: 1 }]
	}
} as const satisfies Record<string, BillingOffer>;

export type BillingOfferId = (typeof BILLING_OFFERS)[keyof typeof BILLING_OFFERS]['offerId'];

const billingOffersById = new Map<BillingOfferId, BillingOffer>(
	Object.values(BILLING_OFFERS).map((offer) => [offer.offerId, offer])
);

export function getBillingOffer(offerId: string): BillingOffer | null {
	return billingOffersById.get(offerId as BillingOfferId) ?? null;
}

export function copyPurchaseItems(offer: BillingOffer): BillingPurchaseItem[] {
	return offer.purchaseItems.map((item) => ({ ...item }));
}

export function purchaseItemsMatchOffer(
	purchaseItems: readonly BillingPurchaseItem[],
	offer: BillingOffer
): boolean {
	return (
		purchaseItems.length === offer.purchaseItems.length &&
		purchaseItems.every((item, index) => {
			const expected = offer.purchaseItems[index];
			return item.purchaseKey === expected.purchaseKey && item.quantity === expected.quantity;
		})
	);
}

export function hasInteractiveBillingSubscription(
	subscriptions: readonly BillingSubscriptionSummary[]
): boolean {
	return subscriptions.some((subscription) =>
		subscription.items.some(
			(item) => item.productFamily === 'membership' || item.productFamily === 'ppi_addon'
		)
	);
}
