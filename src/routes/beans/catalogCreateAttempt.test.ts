import { beforeEach, describe, expect, it } from 'vitest';
import {
	CATALOG_CREATE_RETRY_WINDOW_MS,
	advanceCatalogCreateQueue,
	catalogCreateQueueStorageKey,
	clearCatalogCreateQueue,
	createCatalogCreateQueue,
	isCatalogCreateQueueExpired,
	readCatalogCreateQueue,
	writeCatalogCreateQueue
} from './catalogCreateAttempt';

describe('catalog create attempt persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('round-trips exact serialized payloads in an owner-scoped queue', () => {
		const firstPayload = '{"catalog_id":7,"notes":"exact  spacing","purchased_qty_lbs":5}';
		const secondPayload = '{"catalog_id":8,"purchased_qty_lbs":2}';
		const queue = createCatalogCreateQueue(
			'owner-a',
			[
				{ idempotencyKey: 'key-1', payloadJson: firstPayload },
				{ idempotencyKey: 'key-2', payloadJson: secondPayload }
			],
			1_000
		);

		expect(writeCatalogCreateQueue(localStorage, queue)).toBe(true);
		expect(readCatalogCreateQueue(localStorage, 'owner-a')).toEqual(queue);
		expect(readCatalogCreateQueue(localStorage, 'owner-b')).toBeNull();
		expect(readCatalogCreateQueue(localStorage, 'owner-a')?.items[0].payloadJson).toBe(
			firstPayload
		);
	});

	it('advances completed items without changing later exact payloads', () => {
		const queue = createCatalogCreateQueue(
			'owner-a',
			[
				{ idempotencyKey: 'key-1', payloadJson: '{"catalog_id":7}' },
				{ idempotencyKey: 'key-2', payloadJson: '{"catalog_id":8}' }
			],
			1_000
		);

		expect(advanceCatalogCreateQueue(queue)).toEqual({
			...queue,
			completedCount: 1,
			items: [queue.items[1]]
		});
	});

	it('removes malformed state instead of retrying an unknown payload', () => {
		const key = catalogCreateQueueStorageKey('owner-a');
		localStorage.setItem(key, '{"version":1,"ownerId":"owner-a","items":[]}');

		expect(readCatalogCreateQueue(localStorage, 'owner-a')).toBeNull();
		expect(localStorage.getItem(key)).toBeNull();
	});

	it('stops retries before the upstream 24-hour replay expiry', () => {
		const queue = createCatalogCreateQueue(
			'owner-a',
			[{ idempotencyKey: 'key-1', payloadJson: '{}' }],
			10_000
		);

		expect(isCatalogCreateQueueExpired(queue, 10_000 + CATALOG_CREATE_RETRY_WINDOW_MS - 1)).toBe(
			false
		);
		expect(isCatalogCreateQueueExpired(queue, 10_000 + CATALOG_CREATE_RETRY_WINDOW_MS)).toBe(true);
	});

	it('clears only the current owner queue', () => {
		writeCatalogCreateQueue(
			localStorage,
			createCatalogCreateQueue('owner-a', [{ idempotencyKey: 'key-a', payloadJson: '{}' }], 1_000)
		);
		writeCatalogCreateQueue(
			localStorage,
			createCatalogCreateQueue('owner-b', [{ idempotencyKey: 'key-b', payloadJson: '{}' }], 1_000)
		);

		expect(clearCatalogCreateQueue(localStorage, 'owner-a')).toBe(true);
		expect(readCatalogCreateQueue(localStorage, 'owner-a')).toBeNull();
		expect(readCatalogCreateQueue(localStorage, 'owner-b')?.items[0].idempotencyKey).toBe('key-b');
	});
});
