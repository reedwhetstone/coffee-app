const STORAGE_PREFIX = 'purveyors:pending-catalog-inventory-create';

// Parchment's generic idempotency replay expires after 24 hours. Stop retries
// five minutes early so a request cannot cross the upstream expiry in flight.
export const CATALOG_CREATE_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000 - 5 * 60 * 1000;

export type PendingCatalogCreateItemStatus = 'pending' | 'rejected';

export type PendingCatalogCreateItem = {
	idempotencyKey: string;
	payloadJson: string;
	createdAt: string;
	status: PendingCatalogCreateItemStatus;
	error?: string;
};

export type PendingCatalogCreateQueue = {
	version: 1;
	ownerId: string;
	queueId: string;
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
		!Number.isFinite(Date.parse(item.createdAt)) ||
		(item.status !== undefined && item.status !== 'pending' && item.status !== 'rejected') ||
		(item.error !== undefined && typeof item.error !== 'string')
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

function parseQueue(value: unknown, ownerId: string): PendingCatalogCreateQueue | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const queue = value as Record<string, unknown>;
	if (
		queue.version === 1 &&
		queue.ownerId === ownerId &&
		typeof queue.completedCount === 'number' &&
		Number.isSafeInteger(queue.completedCount) &&
		queue.completedCount >= 0 &&
		Array.isArray(queue.items) &&
		queue.items.length > 0 &&
		queue.items.every(isValidItem)
	) {
		const items = queue.items as Array<PendingCatalogCreateItem & { status?: string }>;
		return {
			version: 1,
			ownerId,
			queueId:
				typeof queue.queueId === 'string' && queue.queueId.length > 0
					? queue.queueId
					: items[0].idempotencyKey,
			completedCount: queue.completedCount,
			items: items.map((item) => ({
				...item,
				status: item.status === 'rejected' ? 'rejected' : 'pending'
			}))
		};
	}
	return null;
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
		queueId: items[0]?.idempotencyKey ?? '',
		completedCount: 0,
		items: items.map((item) => ({ ...item, createdAt, status: 'pending' }))
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

export function markCatalogCreateQueueRejected(
	queue: PendingCatalogCreateQueue,
	error: string
): PendingCatalogCreateQueue {
	const [current, ...remaining] = queue.items;
	if (!current) return queue;
	return {
		...queue,
		items: [{ ...current, status: 'rejected', error }, ...remaining]
	};
}

export function replaceRejectedCatalogCreateItem(
	queue: PendingCatalogCreateQueue,
	replacement: { idempotencyKey: string; payloadJson: string },
	now = Date.now()
): PendingCatalogCreateQueue | null {
	const [current, ...remaining] = queue.items;
	if (current?.status !== 'rejected') return null;
	const createdAt = new Date(now).toISOString();

	return {
		...queue,
		items: [
			{
				...replacement,
				createdAt,
				status: 'pending'
			},
			// The tail has never been submitted because processing stops at the
			// rejected row. Preserve its exact payload/key while starting its safe
			// replay clock when the corrected queue can make progress again.
			...remaining.map((item) => ({ ...item, createdAt }))
		]
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
		const parsed = parseQueue(JSON.parse(raw), ownerId);
		if (parsed) return parsed;
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
	queue: PendingCatalogCreateQueue,
	expectedQueueId: string | null = null
): boolean {
	if (queue.items.length === 0) return false;
	try {
		const current = readCatalogCreateQueue(storage, queue.ownerId);
		if (expectedQueueId === null ? current !== null : current?.queueId !== expectedQueueId) {
			return false;
		}
		storage.setItem(catalogCreateQueueStorageKey(queue.ownerId), JSON.stringify(queue));
		return true;
	} catch {
		return false;
	}
}

export function clearCatalogCreateQueue(
	storage: CatalogAttemptStorage,
	ownerId: string,
	expectedQueueId?: string
): boolean {
	try {
		if (expectedQueueId !== undefined) {
			const current = readCatalogCreateQueue(storage, ownerId);
			if (current?.queueId !== expectedQueueId) return false;
		}
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
	if (current?.status === 'rejected') return false;
	return !current || now >= Date.parse(current.createdAt) + CATALOG_CREATE_RETRY_WINDOW_MS;
}

export function allocateCatalogShippingCents(total: number, itemCount: number): number[] {
	if (itemCount <= 0) return [];
	const totalCents = Math.max(0, Math.round((Number.isFinite(total) ? total : 0) * 100));
	const baseCents = Math.floor(totalCents / itemCount);
	const remainder = totalCents - baseCents * itemCount;
	return Array.from(
		{ length: itemCount },
		(_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100
	);
}
