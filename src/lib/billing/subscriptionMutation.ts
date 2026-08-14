const PREFIX = 'purveyors:subscription-mutation';

export function subscriptionMutationStorageKey(
	subscriptionId: string,
	cancelAtPeriodEnd: boolean
): string {
	return `${PREFIX}:${subscriptionId}:${cancelAtPeriodEnd ? 'cancel' : 'resume'}`;
}

export function getOrCreateSubscriptionMutationRequestId(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	subscriptionId: string,
	cancelAtPeriodEnd: boolean,
	createId: () => string
): string {
	const key = subscriptionMutationStorageKey(subscriptionId, cancelAtPeriodEnd);
	const existing = storage.getItem(key);
	if (existing) return existing;
	const created = createId();
	storage.setItem(key, created);
	return created;
}

export function clearSubscriptionMutationRequestId(
	storage: Pick<Storage, 'removeItem'>,
	subscriptionId: string,
	cancelAtPeriodEnd: boolean
): void {
	storage.removeItem(subscriptionMutationStorageKey(subscriptionId, cancelAtPeriodEnd));
}

export function isPendingSubscriptionMutation(status: string): boolean {
	return status === 'accepted' || status === 'attempting';
}

export function isTerminalSubscriptionMutation(status: string): boolean {
	return status === 'succeeded' || status === 'superseded' || status === 'conflict';
}
