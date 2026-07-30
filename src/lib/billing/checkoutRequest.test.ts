import { describe, expect, it, vi } from 'vitest';

import {
	checkoutRequestStorageKey,
	clearCheckoutRequestId,
	getOrCreateCheckoutRequestId,
	isTerminalCheckoutFailure,
	parseCheckoutFailure
} from './checkoutRequest';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		values
	};
}

describe('Checkout request identity', () => {
	it('keeps one request ID through retryable client initialization failures', () => {
		const storage = memoryStorage();
		const createId = vi.fn().mockReturnValueOnce('request-one').mockReturnValueOnce('request-two');

		const first = getOrCreateCheckoutRequestId(storage, 'membership.monthly', createId);
		const retry = getOrCreateCheckoutRequestId(storage, 'membership.monthly', createId);

		expect(first).toBe('request-one');
		expect(retry).toBe('request-one');
		expect(createId).toHaveBeenCalledTimes(1);
	});

	it('rotates only after an authoritative terminal response or completion', () => {
		const storage = memoryStorage();
		storage.setItem(checkoutRequestStorageKey('membership.monthly'), 'request-one');

		expect(isTerminalCheckoutFailure('checkout_creation_ambiguous')).toBe(false);
		expect(isTerminalCheckoutFailure('stripe_checkout_rejected')).toBe(true);
		expect(isTerminalCheckoutFailure('checkout_admission_closed')).toBe(true);
		expect(isTerminalCheckoutFailure('checkout_replay_mismatch')).toBe(true);

		clearCheckoutRequestId(storage, 'membership.monthly');
		const next = getOrCreateCheckoutRequestId(storage, 'membership.monthly', () => 'request-two');
		expect(next).toBe('request-two');
	});

	it('parses structured and legacy error envelopes', () => {
		expect(
			parseCheckoutFailure({
				error: { code: 'checkout_admission_closed', message: 'Start again' }
			})
		).toEqual({ code: 'checkout_admission_closed', message: 'Start again' });
		expect(parseCheckoutFailure({ error: 'Legacy failure' })).toEqual({
			code: null,
			message: 'Legacy failure'
		});
	});
});
