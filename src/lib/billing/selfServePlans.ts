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
			'See what changed across the market, compare live supplier offers, and use Cherry AI to turn the evidence into a sharper sourcing decision.',
		features: [
			'Cherry Green Agent with catalog, supplier, portfolio, and market context',
			'Supplier comparisons, arrivals, delistings, and market signals',
			'Origin benchmarks, price history, and a weekly procurement brief'
		],
		learnMoreHref: '/subscription#intelligence-details',
		offer: BILLING_OFFERS.intelligenceMonthly
	},
	{
		id: 'both',
		family: 'bundle',
		name: 'Mallard Studio + Parchment Intelligence',
		eyebrow: 'For teams that buy and roast',
		badge: 'Best value',
		description:
			'Connect the outside market to your own inventory and production workflow, then use Cherry AI across the complete decision.',
		features: [
			'Every Parchment Intelligence market and sourcing capability',
			'Every Mallard Studio inventory, roast, tasting, and margin capability',
			'Cherry Synthesis Agent with market evidence and roaster context'
		],
		learnMoreHref: '/subscription#both-details',
		offer: BILLING_OFFERS.bothMonthly
	},
	{
		id: 'studio',
		family: 'membership',
		name: 'Mallard Studio',
		eyebrow: 'For roaster operations',
		badge: 'Roaster workspace',
		description:
			'Carry each coffee from green inventory through roasting, tasting, and margin review, with Cherry AI available inside the workflow.',
		features: [
			'Cherry Roaster Agent with inventory, roast, tasting, and sales context',
			'Green coffee inventory, lot tracking, and roast profiles',
			'Cupping notes, production records, and margin reporting'
		],
		learnMoreHref: '/subscription#studio-details',
		offer: BILLING_OFFERS.studioMonthly
	}
] as const;

export function getSelfServePlan(id: SelfServePlanId): SelfServePlan {
	return SELF_SERVE_PLANS.find((plan) => plan.id === id)!;
}
