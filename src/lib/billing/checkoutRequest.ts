import {
	copyPurchaseItems,
	getBillingOffer,
	purchaseItemsMatchOffer,
	type BillingOfferId,
	type BillingPurchaseItem
} from './offers';

const CHECKOUT_ATTEMPT_KEY = 'purveyors:pending-checkout';

const TERMINAL_CHECKOUT_CODES = new Set([
	'checkout_admission_closed',
	'checkout_conflict',
	'checkout_replay_mismatch',
	'stripe_checkout_rejected'
]);

export interface CheckoutAttempt {
	offerId: BillingOfferId;
	purchaseItems: BillingPurchaseItem[];
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
		const offer = typeof candidate.offerId === 'string' ? getBillingOffer(candidate.offerId) : null;
		if (
			!offer ||
			!Array.isArray(candidate.purchaseItems) ||
			!candidate.purchaseItems.every(
				(item) =>
					typeof item === 'object' &&
					item !== null &&
					typeof item.purchaseKey === 'string' &&
					item.quantity === 1
			) ||
			!purchaseItemsMatchOffer(candidate.purchaseItems, offer) ||
			typeof candidate.requestId !== 'string' ||
			(candidate.admissionId !== null && typeof candidate.admissionId !== 'string')
		) {
			return null;
		}
		return {
			offerId: offer.offerId as BillingOfferId,
			purchaseItems: copyPurchaseItems(offer),
			requestId: candidate.requestId,
			admissionId: candidate.admissionId ?? null
		};
	} catch {
		return null;
	}
}

export function getOrCreateCheckoutAttempt(
	storage: WriteStorage,
	offerId: BillingOfferId,
	createId: () => string
): CheckoutAttempt {
	const offer = getBillingOffer(offerId);
	if (!offer) throw new Error('Unknown billing offer');

	const existing = readCheckoutAttempt(storage);
	if (existing?.offerId === offerId && purchaseItemsMatchOffer(existing.purchaseItems, offer)) {
		return existing;
	}

	const created: CheckoutAttempt = {
		offerId,
		purchaseItems: copyPurchaseItems(offer),
		requestId: createId(),
		admissionId: null
	};
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
