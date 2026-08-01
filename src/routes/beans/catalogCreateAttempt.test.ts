import { beforeEach, describe, expect, it } from 'vitest';
import {
	CATALOG_CREATE_RETRY_WINDOW_MS,
	allocateCatalogShippingCents,
	advanceCatalogCreateQueue,
	catalogCreateQueueStorageKey,
	clearCatalogCreateQueue,
	createCatalogCreateQueue,
	isCatalogCreateQueueExpired,
	markCatalogCreateQueueRejected,
	readCatalogCreateQueue,
	replaceRejectedCatalogCreateItem,
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

	it('replaces only a rejected row while preserving the queue identity and exact tail', () => {
		const queue = createCatalogCreateQueue(
			'owner-a',
			[
				{ idempotencyKey: 'key-1', payloadJson: '{"catalog_id":7}' },
				{ idempotencyKey: 'key-2', payloadJson: '{"catalog_id":8,"notes":"exact  tail"}' }
			],
			1_000
		);
		const rejected = markCatalogCreateQueueRejected(queue, 'Invalid quantity');
		const replaced = replaceRejectedCatalogCreateItem(
			rejected,
			{ idempotencyKey: 'key-3', payloadJson: '{"catalog_id":7,"purchased_qty_lbs":3}' },
			2_000
		);

		expect(replaced).toEqual({
			...queue,
			items: [
				{
					idempotencyKey: 'key-3',
					payloadJson: '{"catalog_id":7,"purchased_qty_lbs":3}',
					createdAt: new Date(2_000).toISOString(),
					status: 'pending'
				},
				{ ...queue.items[1], createdAt: new Date(2_000).toISOString() }
			]
		});
	});

	it('uses queue identity compare-and-set semantics', () => {
		const first = createCatalogCreateQueue(
			'owner-a',
			[{ idempotencyKey: 'key-1', payloadJson: '{"catalog_id":7}' }],
			1_000
		);
		const competing = createCatalogCreateQueue(
			'owner-a',
			[{ idempotencyKey: 'key-2', payloadJson: '{"catalog_id":8}' }],
			1_000
		);

		expect(writeCatalogCreateQueue(localStorage, first)).toBe(true);
		expect(writeCatalogCreateQueue(localStorage, competing)).toBe(false);
		expect(
			writeCatalogCreateQueue(localStorage, { ...first, completedCount: 1 }, first.queueId)
		).toBe(true);
		expect(clearCatalogCreateQueue(localStorage, 'owner-a', competing.queueId)).toBe(false);
		expect(readCatalogCreateQueue(localStorage, 'owner-a')?.queueId).toBe(first.queueId);
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

	it('allocates shared catalog shipping in deterministic whole cents', () => {
		expect(allocateCatalogShippingCents(5.01, 2)).toEqual([2.51, 2.5]);
		expect(allocateCatalogShippingCents(1, 3)).toEqual([0.34, 0.33, 0.33]);
		expect(allocateCatalogShippingCents(0, 0)).toEqual([]);
	});
});
