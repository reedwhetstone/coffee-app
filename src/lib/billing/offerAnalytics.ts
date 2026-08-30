import { track } from '@vercel/analytics/sveltekit';
import { getBillingOffer, type BillingOfferId } from './offers';

export type BillingOfferEvent =
	| 'billing_offer_impression'
	| 'billing_checkout_started'
	| 'billing_checkout_settled';

/**
 * Emit stable offer-level funnel events without sending provider Price IDs or
 * account data. Vercel Analytics safely no-ops when its browser collector is
 * unavailable, including local development and blocked clients.
 */
export function trackBillingOfferEvent(event: BillingOfferEvent, offerId: BillingOfferId): void {
	const offer = getBillingOffer(offerId);
	if (!offer) return;

	track(event, {
		offerId: offer.offerId,
		offerName: offer.name,
		price: offer.price,
		interval: offer.interval,
		trialDays: offer.trialDays ?? 0
	});
}
