import { describe, expect, it, vi } from 'vitest';
import {
	clearCheckoutAttempt,
	getOrCreateCheckoutAttempt,
	isTerminalCheckoutFailure,
	isTerminalCheckoutStatus,
	parseCheckoutFailure,
	persistCheckoutAdmission,
	readCheckoutAttempt
} from './checkoutRequest';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

describe('Checkout attempt identity', () => {
	it('keeps one request ID and admission through ambiguous retries', () => {
		const storage = memoryStorage();
		const createId = vi.fn().mockReturnValueOnce('request-one').mockReturnValueOnce('request-two');
		const first = getOrCreateCheckoutAttempt(storage, 'studio-monthly', createId);
		const admitted = persistCheckoutAdmission(storage, first, 'admission-one');
		const retry = getOrCreateCheckoutAttempt(storage, 'studio-monthly', createId);

		expect(admitted.admissionId).toBe('admission-one');
		expect(retry).toEqual(admitted);
		expect(retry.purchaseItems).toEqual([{ purchaseKey: 'membership.monthly', quantity: 1 }]);
		expect(createId).toHaveBeenCalledOnce();
	});

	it('replaces a different offer item set and clears only explicitly', () => {
		const storage = memoryStorage();
		getOrCreateCheckoutAttempt(storage, 'studio-monthly', () => 'request-one');
		expect(getOrCreateCheckoutAttempt(storage, 'both-monthly', () => 'request-two')).toEqual({
			offerId: 'both-monthly',
			purchaseItems: [
				{ purchaseKey: 'membership.monthly', quantity: 1 },
				{ purchaseKey: 'ppi_addon.bundle_monthly', quantity: 1 }
			],
			requestId: 'request-two',
			admissionId: null
		});
		clearCheckoutAttempt(storage);
		expect(readCheckoutAttempt(storage)).toBeNull();
	});

	it('rotates legacy single-key attempts instead of replaying them', () => {
		const storage = memoryStorage();
		storage.setItem(
			'purveyors:pending-checkout',
			JSON.stringify({
				purchaseKey: 'membership.monthly',
				requestId: 'legacy-request',
				admissionId: 'legacy-admission'
			})
		);

		expect(getOrCreateCheckoutAttempt(storage, 'studio-monthly', () => 'new-request')).toEqual({
			offerId: 'studio-monthly',
			purchaseItems: [{ purchaseKey: 'membership.monthly', quantity: 1 }],
			requestId: 'new-request',
			admissionId: null
		});
	});

	it('rotates stored attempts whose item set no longer matches the offer', () => {
		const storage = memoryStorage();
		storage.setItem(
			'purveyors:pending-checkout',
			JSON.stringify({
				offerId: 'both-monthly',
				purchaseItems: [{ purchaseKey: 'membership.monthly', quantity: 1 }],
				requestId: 'stale-request',
				admissionId: 'stale-admission'
			})
		);

		const attempt = getOrCreateCheckoutAttempt(storage, 'both-monthly', () => 'new-request');
		expect(attempt.requestId).toBe('new-request');
		expect(attempt.admissionId).toBeNull();
		expect(attempt.purchaseItems).toHaveLength(2);
	});

	it('recognizes authoritative terminal outcomes', () => {
		expect(isTerminalCheckoutStatus('accepted')).toBe(false);
		expect(isTerminalCheckoutStatus('published')).toBe(false);
		expect(isTerminalCheckoutStatus('settled')).toBe(true);
		expect(isTerminalCheckoutStatus('closed')).toBe(true);
		expect(isTerminalCheckoutStatus('conflict')).toBe(true);
		expect(isTerminalCheckoutFailure('checkout_creation_ambiguous')).toBe(false);
		expect(isTerminalCheckoutFailure('checkout_replay_mismatch')).toBe(true);
	});

	it('parses structured and legacy error envelopes', () => {
		expect(
			parseCheckoutFailure({ error: { code: 'checkout_admission_closed', message: 'Start again' } })
		).toEqual({ code: 'checkout_admission_closed', message: 'Start again' });
		expect(parseCheckoutFailure({ error: 'Legacy failure' })).toEqual({
			code: null,
			message: 'Legacy failure'
		});
	});
});
