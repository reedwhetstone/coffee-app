const CHECKOUT_ATTEMPT_KEY = 'purveyors:pending-checkout';

const TERMINAL_CHECKOUT_CODES = new Set([
	'checkout_admission_closed',
	'checkout_conflict',
	'checkout_replay_mismatch',
	'stripe_checkout_rejected'
]);

export interface CheckoutAttempt {
	purchaseKey: string;
	requestId: string;
	admissionId: string | null;
}

export interface CheckoutFailure {
	code: string | null;
	message: string;
}

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readCheckoutAttempt(storage: ReadStorage): CheckoutAttempt | null {
	const raw = storage.getItem(CHECKOUT_ATTEMPT_KEY);
	if (!raw) return null;

	try {
		const candidate = JSON.parse(raw) as Partial<CheckoutAttempt>;
		if (
			typeof candidate.purchaseKey !== 'string' ||
			typeof candidate.requestId !== 'string' ||
			(candidate.admissionId !== null && typeof candidate.admissionId !== 'string')
		) {
			return null;
		}
		return {
			purchaseKey: candidate.purchaseKey,
			requestId: candidate.requestId,
			admissionId: candidate.admissionId ?? null
		};
	} catch {
		return null;
	}
}

export function getOrCreateCheckoutAttempt(
	storage: WriteStorage,
	purchaseKey: string,
	createId: () => string
): CheckoutAttempt {
	const existing = readCheckoutAttempt(storage);
	if (existing?.purchaseKey === purchaseKey) return existing;

	const created = { purchaseKey, requestId: createId(), admissionId: null };
	storage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(created));
	return created;
}

export function persistCheckoutAdmission(
	storage: WriteStorage,
	attempt: CheckoutAttempt,
	admissionId: string
): CheckoutAttempt {
	const updated = { ...attempt, admissionId };
	storage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(updated));
	return updated;
}

export function clearCheckoutAttempt(storage: Pick<Storage, 'removeItem'>): void {
	storage.removeItem(CHECKOUT_ATTEMPT_KEY);
}

export function parseCheckoutFailure(payload: unknown): CheckoutFailure {
	if (!payload || typeof payload !== 'object') {
		return { code: null, message: 'Failed to prepare checkout' };
	}
	const candidate = payload as { error?: unknown; message?: unknown };
	if (typeof candidate.error === 'object' && candidate.error) {
		const structured = candidate.error as { code?: unknown; message?: unknown };
		return {
			code: typeof structured.code === 'string' ? structured.code : null,
			message:
				typeof structured.message === 'string' ? structured.message : 'Failed to prepare checkout'
		};
	}
	return {
		code: null,
		message:
			typeof candidate.error === 'string'
				? candidate.error
				: typeof candidate.message === 'string'
					? candidate.message
					: 'Failed to prepare checkout'
	};
}

export function isTerminalCheckoutFailure(code: string | null): boolean {
	return code !== null && TERMINAL_CHECKOUT_CODES.has(code);
}

export function isTerminalCheckoutStatus(status: string): boolean {
	return status === 'settled' || status === 'closed' || status === 'conflict';
}
