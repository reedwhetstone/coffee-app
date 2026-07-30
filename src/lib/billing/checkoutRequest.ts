const TERMINAL_CHECKOUT_CODES = new Set(['stripe_checkout_rejected', 'checkout_admission_closed']);

export interface CheckoutFailure {
	code: string | null;
	message: string;
}

export function checkoutRequestStorageKey(purchaseKey: string): string {
	return `checkout-request:${purchaseKey}`;
}

export function getOrCreateCheckoutRequestId(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	purchaseKey: string,
	createId: () => string
): string {
	const key = checkoutRequestStorageKey(purchaseKey);
	const existing = storage.getItem(key);
	if (existing) return existing;
	const created = createId();
	storage.setItem(key, created);
	return created;
}

export function clearCheckoutRequestId(
	storage: Pick<Storage, 'removeItem'>,
	purchaseKey: string
): void {
	storage.removeItem(checkoutRequestStorageKey(purchaseKey));
}

export function parseCheckoutFailure(payload: unknown): CheckoutFailure {
	if (!payload || typeof payload !== 'object') {
		return { code: null, message: 'Failed to create checkout session' };
	}
	const candidate = payload as {
		error?: unknown;
		message?: unknown;
	};
	if (typeof candidate.error === 'object' && candidate.error) {
		const structured = candidate.error as { code?: unknown; message?: unknown };
		return {
			code: typeof structured.code === 'string' ? structured.code : null,
			message:
				typeof structured.message === 'string'
					? structured.message
					: 'Failed to create checkout session'
		};
	}
	return {
		code: null,
		message:
			typeof candidate.error === 'string'
				? candidate.error
				: typeof candidate.message === 'string'
					? candidate.message
					: 'Failed to create checkout session'
	};
}

export function isTerminalCheckoutFailure(code: string | null): boolean {
	return code !== null && TERMINAL_CHECKOUT_CODES.has(code);
}
