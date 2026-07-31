const STORAGE_PREFIX = 'purveyors:pending-catalog-inventory-create';

// Parchment's generic idempotency replay expires after 24 hours. Stop retries
// five minutes early so a request cannot cross the upstream expiry in flight.
export const CATALOG_CREATE_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

export type PendingCatalogCreateItem = {
	idempotencyKey: string;
	payloadJson: string;
	createdAt: string;
};

export type PendingCatalogCreateQueue = {
	version: 1;
	ownerId: string;
	completedCount: number;
	items: PendingCatalogCreateItem[];
};

type CatalogAttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function catalogCreateQueueStorageKey(ownerId: string): string {
	return `${STORAGE_PREFIX}:${ownerId}`;
}

function isValidItem(value: unknown): value is PendingCatalogCreateItem {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	if (
		typeof item.idempotencyKey !== 'string' ||
		item.idempotencyKey.length === 0 ||
		typeof item.payloadJson !== 'string' ||
		typeof item.createdAt !== 'string' ||
		!Number.isFinite(Date.parse(item.createdAt))
	) {
		return false;
	}

	try {
		const payload = JSON.parse(item.payloadJson);
		return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
	} catch {
		return false;
	}
}

function isValidQueue(value: unknown, ownerId: string): value is PendingCatalogCreateQueue {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const queue = value as Record<string, unknown>;
	return (
		queue.version === 1 &&
		queue.ownerId === ownerId &&
		typeof queue.completedCount === 'number' &&
		Number.isSafeInteger(queue.completedCount) &&
		queue.completedCount >= 0 &&
		Array.isArray(queue.items) &&
		queue.items.length > 0 &&
		queue.items.every(isValidItem)
	);
}

export function createCatalogCreateQueue(
	ownerId: string,
	items: Array<{ idempotencyKey: string; payloadJson: string }>,
	now = Date.now()
): PendingCatalogCreateQueue {
	const createdAt = new Date(now).toISOString();
	return {
		version: 1,
		ownerId,
		completedCount: 0,
		items: items.map((item) => ({ ...item, createdAt }))
	};
}

export function advanceCatalogCreateQueue(
	queue: PendingCatalogCreateQueue
): PendingCatalogCreateQueue {
	return {
		...queue,
		completedCount: queue.completedCount + 1,
		items: queue.items.slice(1)
	};
}

export function readCatalogCreateQueue(
	storage: CatalogAttemptStorage,
	ownerId: string
): PendingCatalogCreateQueue | null {
	const key = catalogCreateQueueStorageKey(ownerId);
	try {
		const raw = storage.getItem(key);
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		if (isValidQueue(parsed, ownerId)) return parsed;
		storage.removeItem(key);
		return null;
	} catch {
		try {
			storage.removeItem(key);
		} catch {
			// Storage is unavailable. The caller must not submit a new mutation
			// unless it can persist the replacement queue first.
		}
		return null;
	}
}

export function writeCatalogCreateQueue(
	storage: CatalogAttemptStorage,
	queue: PendingCatalogCreateQueue
): boolean {
	if (queue.items.length === 0) return false;
	try {
		storage.setItem(catalogCreateQueueStorageKey(queue.ownerId), JSON.stringify(queue));
		return true;
	} catch {
		return false;
	}
}

export function clearCatalogCreateQueue(storage: CatalogAttemptStorage, ownerId: string): boolean {
	try {
		storage.removeItem(catalogCreateQueueStorageKey(ownerId));
		return true;
	} catch {
		return false;
	}
}

export function isCatalogCreateQueueExpired(
	queue: PendingCatalogCreateQueue,
	now = Date.now()
): boolean {
	const current = queue.items[0];
	return !current || now >= Date.parse(current.createdAt) + CATALOG_CREATE_RETRY_WINDOW_MS;
}
