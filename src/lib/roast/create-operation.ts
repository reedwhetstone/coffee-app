type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type RoastCreateScope = 'profile-form' | 'live-roast';

export type RoastCreatePayload = {
	batch_name: string;
	batch_beans: {
		coffee_id: number;
		coffee_name: string;
		oz_in: number | null;
		oz_out: number | null;
	}[];
	roast_date: string;
	roast_notes: string;
	roast_targets: string;
};

type PendingRoastCreateEnvelope = {
	version: 1;
	idempotencyKey: string;
	payload: string;
};

export type PendingRoastCreateOperation = Readonly<
	Pick<PendingRoastCreateEnvelope, 'idempotencyKey' | 'payload'>
>;

function isNullableNumber(value: unknown): value is number | null {
	return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/** Parse the exact form payload persisted for a recoverable profile creation. */
export function parseRoastCreatePayload(payload: string): RoastCreatePayload | null {
	try {
		const parsed = JSON.parse(payload) as Partial<RoastCreatePayload>;
		if (
			typeof parsed.batch_name !== 'string' ||
			typeof parsed.roast_date !== 'string' ||
			typeof parsed.roast_notes !== 'string' ||
			typeof parsed.roast_targets !== 'string' ||
			!Array.isArray(parsed.batch_beans) ||
			parsed.batch_beans.length === 0
		) {
			return null;
		}

		if (
			!parsed.batch_beans.every(
				(bean) =>
					typeof bean === 'object' &&
					bean !== null &&
					typeof bean.coffee_id === 'number' &&
					Number.isFinite(bean.coffee_id) &&
					typeof bean.coffee_name === 'string' &&
					isNullableNumber(bean.oz_in) &&
					isNullableNumber(bean.oz_out)
			)
		) {
			return null;
		}

		return parsed as RoastCreatePayload;
	} catch {
		return null;
	}
}

function storageKey(ownerId: string | null, scope: RoastCreateScope): string | null {
	return ownerId ? `purveyors:pending-roast-create:${ownerId}:${scope}` : null;
}

function readEnvelope(storage: StorageLike, key: string): PendingRoastCreateEnvelope | null {
	const raw = storage.getItem(key);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<PendingRoastCreateEnvelope>;
		if (
			parsed.version === 1 &&
			typeof parsed.idempotencyKey === 'string' &&
			parsed.idempotencyKey.length > 0 &&
			typeof parsed.payload === 'string'
		) {
			return parsed as PendingRoastCreateEnvelope;
		}
	} catch {
		// Corrupt browser state cannot be recovered safely.
	}
	storage.removeItem(key);
	return null;
}

export function readRoastCreateOperation(
	storage: StorageLike,
	ownerId: string | null,
	scope: RoastCreateScope
): PendingRoastCreateOperation | null {
	const key = storageKey(ownerId, scope);
	if (!key) return null;
	return readEnvelope(storage, key);
}

/**
 * Reuse one owner-scoped, payload-bound operation key across ambiguous create
 * outcomes and reloads. A different payload is blocked until the earlier
 * operation reaches a definitive outcome, preventing an accidental duplicate
 * with a new key while the first request may already have committed.
 */
export function reserveRoastCreateOperation(
	storage: StorageLike,
	ownerId: string | null,
	scope: RoastCreateScope,
	payload: string,
	createId: () => string = () => crypto.randomUUID()
): string {
	const key = storageKey(ownerId, scope);
	if (!key) return createId();

	const pending = readEnvelope(storage, key);
	if (pending) {
		if (pending.payload !== payload) {
			throw new Error(
				'A previous roast creation has an unresolved result. Retry the original request before changing it.'
			);
		}
		return pending.idempotencyKey;
	}

	const idempotencyKey = createId();
	storage.setItem(
		key,
		JSON.stringify({ version: 1, idempotencyKey, payload } satisfies PendingRoastCreateEnvelope)
	);
	return idempotencyKey;
}

export function clearRoastCreateOperation(
	storage: StorageLike,
	ownerId: string | null,
	scope: RoastCreateScope
): void {
	const key = storageKey(ownerId, scope);
	if (key) storage.removeItem(key);
}

/** Keep the operation identity only when the response could be ambiguous or retryable. */
export function shouldRetainRoastCreateOperation(status: number): boolean {
	return status >= 500 || status === 409 || status === 429;
}
