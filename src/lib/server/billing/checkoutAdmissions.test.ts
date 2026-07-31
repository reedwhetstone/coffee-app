import { describe, expect, it } from 'vitest';

import {
	buildCheckoutAdmissionMetadata,
	checkoutAdmissionContextFromMetadata,
	checkoutAdmissionsReadyForAccountDeletion,
	checkoutPurchaseFingerprint,
	normalizeCheckoutStripePriceIds,
	resolveCheckoutAdmissionRollout,
	verifyPublishedCheckoutReplay
} from './checkoutAdmissions';

const partialAdmissionMetadata: Array<Record<string, string>> = [
	{ checkout_request_id: 'request-123' },
	{ checkout_purchase_fingerprint: 'fingerprint-123' }
];

describe('checkoutPurchaseFingerprint', () => {
	it('is stable across normalized equivalent purchase ordering and changes with the purchase set', () => {
		const first = checkoutPurchaseFingerprint(['price_b', 'price_a']);
		const reordered = checkoutPurchaseFingerprint([' price_a', 'price_b', 'price_a ']);
		const changed = checkoutPurchaseFingerprint(['price_a', 'price_c']);

		expect(first).toMatch(/^[a-f0-9]{64}$/);
		expect(reordered).toBe(first);
		expect(changed).not.toBe(first);
		expect(normalizeCheckoutStripePriceIds([' price_b ', 'price_a', 'price_b'])).toEqual([
			'price_a',
			'price_b'
		]);
	});
});

describe('published checkout replay verification', () => {
	const expected = {
		admissionId: 'admission-123',
		requestId: 'request-123',
		purchaseFingerprint: checkoutPurchaseFingerprint(['price_b', 'price_a'])
	};
	const session = {
		client_reference_id: 'admission-123',
		client_secret: 'cs_secret',
		status: 'open',
		metadata: buildCheckoutAdmissionMetadata(expected)
	};

	it.each([
		['exact replay', expected, session, true],
		[
			'order-equivalent replay',
			{ ...expected, purchaseFingerprint: checkoutPurchaseFingerprint(['price_a', 'price_b']) },
			session,
			true
		],
		[
			'changed bundle',
			{ ...expected, purchaseFingerprint: checkoutPurchaseFingerprint(['price_a', 'price_c']) },
			session,
			false
		],
		[
			'incomplete metadata',
			expected,
			{
				...session,
				metadata: Object.fromEntries(
					Object.entries(session.metadata).filter(([key]) => key !== 'checkout_request_id')
				)
			},
			false
		],
		['completed session', expected, { ...session, status: 'complete' }, false],
		['missing client secret', expected, { ...session, client_secret: null }, false]
	] as const)('%s', (_label, replayExpectation, replaySession, valid) => {
		expect(verifyPublishedCheckoutReplay(replaySession, replayExpectation)).toBe(valid);
	});
});

describe('resolveCheckoutAdmissionRollout', () => {
	it('rejects a legacy drain without managed Checkout creation', () => {
		expect(() =>
			resolveCheckoutAdmissionRollout({
				PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED: 'false',
				PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED: 'true'
			})
		).toThrow(
			'PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED=true requires PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED=true.'
		);
	});

	it('allows disabled, clean-cutover, and zero-downtime states', () => {
		expect(resolveCheckoutAdmissionRollout({})).toEqual({
			admissionsEnabled: false,
			legacyDrainEnabled: false
		});
		expect(
			resolveCheckoutAdmissionRollout({
				PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED: 'true'
			})
		).toEqual({
			admissionsEnabled: true,
			legacyDrainEnabled: false
		});
		expect(
			resolveCheckoutAdmissionRollout({
				PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED: 'true',
				PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED: 'true'
			})
		).toEqual({
			admissionsEnabled: true,
			legacyDrainEnabled: true
		});
	});

	it('only permits account deletion after the managed Checkout cutover is clean', () => {
		expect(
			checkoutAdmissionsReadyForAccountDeletion({
				PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED: 'true'
			})
		).toBe(true);
		expect(
			checkoutAdmissionsReadyForAccountDeletion({
				PARCHMENT_CHECKOUT_ADMISSIONS_ENABLED: 'true',
				PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_ENABLED: 'true'
			})
		).toBe(false);
		expect(checkoutAdmissionsReadyForAccountDeletion({})).toBe(false);
	});
});

describe('checkoutAdmissionContextFromMetadata', () => {
	it('returns no context for pre-cutover sessions without admission metadata', () => {
		expect(checkoutAdmissionContextFromMetadata({}, 'cs_legacy')).toBeNull();
		expect(
			checkoutAdmissionContextFromMetadata({ supabase_user_id: 'legacy-user' }, 'cs_legacy')
		).toBeNull();
	});

	it('returns context for complete admission metadata', () => {
		expect(
			checkoutAdmissionContextFromMetadata(
				{
					parchment_admission_id: 'admission-123',
					checkout_request_id: 'request-123'
				},
				'cs_managed'
			)
		).toEqual({
			admissionId: 'admission-123',
			requestId: 'request-123',
			stripeSessionId: 'cs_managed'
		});
	});

	it.each(partialAdmissionMetadata)('rejects partial admission metadata: %o', (metadata) => {
		expect(() => checkoutAdmissionContextFromMetadata(metadata, 'cs_partial')).toThrow(
			'Managed checkout session is missing Checkout admission metadata'
		);
	});
});
