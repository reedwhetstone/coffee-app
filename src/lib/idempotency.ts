type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type PendingOperationEnvelope = {
	version: 1;
	operations: Record<string, string>;
};

function storageKey(ownerId: string | null | undefined, scope: string): string {
	return `purveyors:pending-idempotency:${ownerId || 'session'}:${scope}`;
}

function readOperations(storage: StorageLike, key: string): Record<string, string> {
	const raw = storage.getItem(key);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Partial<PendingOperationEnvelope>;
		if (parsed.version === 1 && parsed.operations && typeof parsed.operations === 'object') {
			return Object.fromEntries(
				Object.entries(parsed.operations).filter(
					([payload, id]) => typeof payload === 'string' && typeof id === 'string' && id.length > 0
				)
			);
		}
	} catch {
		// Corrupt browser state cannot be replayed safely.
	}
	storage.removeItem(key);
	return {};
}

function writeOperations(
	storage: StorageLike,
	key: string,
	operations: Record<string, string>
): void {
	if (Object.keys(operations).length === 0) {
		storage.removeItem(key);
		return;
	}
	storage.setItem(
		key,
		JSON.stringify({ version: 1, operations } satisfies PendingOperationEnvelope)
	);
}

/** Reuse one operation key for the same payload until it succeeds or definitively fails. */
export function reserveIdempotencyKey(
	storage: StorageLike | null,
	ownerId: string | null | undefined,
	scope: string,
	payload: string,
	createId: () => string = () => crypto.randomUUID()
): string {
	if (!storage) return createId();
	const key = storageKey(ownerId, scope);
	const operations = readOperations(storage, key);
	const existing = operations[payload];
	if (existing) return existing;
	const idempotencyKey = createId();
	operations[payload] = idempotencyKey;
	writeOperations(storage, key, operations);
	return idempotencyKey;
}

export function clearIdempotencyKey(
	storage: StorageLike | null,
	ownerId: string | null | undefined,
	scope: string,
	payload: string
): void {
	if (!storage) return;
	const key = storageKey(ownerId, scope);
	const operations = readOperations(storage, key);
	delete operations[payload];
	writeOperations(storage, key, operations);
}

/** Preserve the key for network/ambiguous upstream outcomes. */
export function shouldRetainIdempotencyKey(status: number): boolean {
	return status >= 500 || status === 409 || status === 429;
}
