import { describe, expect, it } from 'vitest';
import { clearIdempotencyKey, reserveIdempotencyKey } from './idempotency';

function storage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key)
	};
}

describe('idempotency key storage', () => {
	it('reuses keys per payload and allows independent payloads', () => {
		const browserStorage = storage();
		let sequence = 0;
		const createId = () => `operation-${++sequence}`;

		expect(
			reserveIdempotencyKey(browserStorage, 'member-1', 'profile-upload', 'payload-a', createId)
		).toBe('operation-1');
		expect(
			reserveIdempotencyKey(browserStorage, 'member-1', 'profile-upload', 'payload-a', createId)
		).toBe('operation-1');
		expect(
			reserveIdempotencyKey(browserStorage, 'member-1', 'profile-upload', 'payload-b', createId)
		).toBe('operation-2');

		clearIdempotencyKey(browserStorage, 'member-1', 'profile-upload', 'payload-a');
		expect(
			reserveIdempotencyKey(browserStorage, 'member-1', 'profile-upload', 'payload-a', createId)
		).toBe('operation-3');
	});
});
