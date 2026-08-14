import { describe, expect, it, vi } from 'vitest';
import {
	clearSubscriptionMutationRequestId,
	getOrCreateSubscriptionMutationRequestId,
	isPendingSubscriptionMutation,
	isTerminalSubscriptionMutation,
	subscriptionMutationStorageKey
} from './subscriptionMutation';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		values
	};
}

describe('subscription mutation request identity', () => {
	it('keeps one request ID for ambiguous retries of the same target state', () => {
		const storage = memoryStorage();
		const createId = vi.fn().mockReturnValueOnce('request-one').mockReturnValueOnce('request-two');
		expect(getOrCreateSubscriptionMutationRequestId(storage, 'sub_1', true, createId)).toBe(
			'request-one'
		);
		expect(getOrCreateSubscriptionMutationRequestId(storage, 'sub_1', true, createId)).toBe(
			'request-one'
		);
		expect(createId).toHaveBeenCalledOnce();
	});

	it('separates cancel and resume identities and clears terminal operations', () => {
		const storage = memoryStorage();
		getOrCreateSubscriptionMutationRequestId(storage, 'sub_1', true, () => 'cancel-id');
		getOrCreateSubscriptionMutationRequestId(storage, 'sub_1', false, () => 'resume-id');
		expect(storage.values.size).toBe(2);
		clearSubscriptionMutationRequestId(storage, 'sub_1', true);
		expect(storage.values.has(subscriptionMutationStorageKey('sub_1', true))).toBe(false);
		expect(storage.values.has(subscriptionMutationStorageKey('sub_1', false))).toBe(true);
	});

	it('distinguishes pending and terminal upstream states', () => {
		expect(isPendingSubscriptionMutation('accepted')).toBe(true);
		expect(isPendingSubscriptionMutation('attempting')).toBe(true);
		expect(isTerminalSubscriptionMutation('succeeded')).toBe(true);
		expect(isTerminalSubscriptionMutation('superseded')).toBe(true);
		expect(isTerminalSubscriptionMutation('conflict')).toBe(true);
	});
});
