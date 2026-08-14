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
		const first = getOrCreateCheckoutAttempt(storage, 'membership.monthly', createId);
		const admitted = persistCheckoutAdmission(storage, first, 'admission-one');
		const retry = getOrCreateCheckoutAttempt(storage, 'membership.monthly', createId);

		expect(admitted.admissionId).toBe('admission-one');
		expect(retry).toEqual(admitted);
		expect(createId).toHaveBeenCalledOnce();
	});

	it('replaces a different purchase attempt and clears only explicitly', () => {
		const storage = memoryStorage();
		getOrCreateCheckoutAttempt(storage, 'membership.monthly', () => 'request-one');
		expect(getOrCreateCheckoutAttempt(storage, 'api_plan.monthly', () => 'request-two')).toEqual({
			purchaseKey: 'api_plan.monthly',
			requestId: 'request-two',
			admissionId: null
		});
		clearCheckoutAttempt(storage);
		expect(readCheckoutAttempt(storage)).toBeNull();
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
