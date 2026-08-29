import { BILLING_OFFERS, type BillingOffer, type BillingOfferId } from './offers';

export type SelfServePlanId = 'intelligence' | 'both' | 'studio';
export type SelfServeProductFamily = 'ppi_addon' | 'bundle' | 'membership';

export interface SelfServePlan {
	id: SelfServePlanId;
	family: SelfServeProductFamily;
	name: string;
	eyebrow: string;
	badge: string;
	description: string;
	features: readonly string[];
	learnMoreHref: string;
	offer: BillingOffer & { offerId: BillingOfferId };
	iconPath: string;
}

/**
 * Canonical self-serve plan presentation shared by the homepage and the
 * authenticated subscription route. Billing authority still lives in
 * BILLING_OFFERS and Parchment; this module owns customer-facing framing.
 */
export const SELF_SERVE_PLANS: readonly SelfServePlan[] = [
	{
		id: 'intelligence',
		family: 'ppi_addon',
		name: 'Parchment Intelligence',
		eyebrow: 'For sourcing decisions',
		badge: 'Market intelligence',
		description:
			'See what changed across the market, compare live supplier offers, and ask Parchment to turn the evidence into a sharper sourcing decision.',
		features: [
			'Ask Parchment with catalog, supplier, portfolio, and market context',
			'Supplier comparisons, arrivals, delistings, and market signals',
			'Origin benchmarks, price history, and a weekly procurement brief'
		],
		learnMoreHref: '/subscription#intelligence-details',
		offer: BILLING_OFFERS.intelligenceMonthly,
		iconPath:
			'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
	},
	{
		id: 'both',
		family: 'bundle',
		name: 'Studio + Intelligence',
		eyebrow: 'For teams that buy and roast',
		badge: 'Best value',
		description:
			'Connect the outside market to your own inventory and production workflow, then ask Parchment across the complete decision.',
		features: [
			'Every Intelligence market and sourcing capability',
			'Every Studio inventory, roast, tasting, and margin capability',
			'Ask Parchment with both market evidence and roaster context'
		],
		learnMoreHref: '/subscription#both-details',
		offer: BILLING_OFFERS.bothMonthly,
		iconPath:
			'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.847-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z'
	},
	{
		id: 'studio',
		family: 'membership',
		name: 'Mallard Studio',
		eyebrow: 'For roaster operations',
		badge: 'Roaster workspace',
		description:
			'Carry each coffee from green inventory through roasting, tasting, and margin review, with Ask Parchment available inside the workflow.',
		features: [
			'Ask Parchment with inventory, roast, tasting, and sales context',
			'Green coffee inventory, lot tracking, and roast profiles',
			'Cupping notes, production records, and margin reporting'
		],
		learnMoreHref: '/subscription#studio-details',
		offer: BILLING_OFFERS.studioMonthly,
		iconPath:
			'M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819'
	}
] as const;

export function getSelfServePlan(id: SelfServePlanId): SelfServePlan {
	return SELF_SERVE_PLANS.find((plan) => plan.id === id)!;
}
