import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearRoastCreateOperation,
	readRoastCreateOperation,
	reserveRoastCreateOperation,
	shouldRetainRoastCreateOperation
} from './create-operation';

describe('roast create operation envelope', () => {
	beforeEach(() => sessionStorage.clear());

	it('persists and reuses one owner-scoped key for the same payload', () => {
		const first = reserveRoastCreateOperation(
			sessionStorage,
			'owner-1',
			'profile-form',
			'{"batch":"one"}',
			() => 'operation-1'
		);
		const replay = reserveRoastCreateOperation(
			sessionStorage,
			'owner-1',
			'profile-form',
			'{"batch":"one"}',
			() => 'operation-2'
		);

		expect(first).toBe('operation-1');
		expect(replay).toBe('operation-1');
		expect(readRoastCreateOperation(sessionStorage, 'owner-1', 'profile-form')).toEqual({
			version: 1,
			idempotencyKey: 'operation-1',
			payload: '{"batch":"one"}'
		});
	});

	it('isolates owner envelopes and blocks a changed payload while unresolved', () => {
		reserveRoastCreateOperation(
			sessionStorage,
			'owner-1',
			'profile-form',
			'first',
			() => 'operation-1'
		);

		expect(() =>
			reserveRoastCreateOperation(
				sessionStorage,
				'owner-1',
				'profile-form',
				'changed',
				() => 'operation-2'
			)
		).toThrow('Retry the original request before changing it');
		expect(
			reserveRoastCreateOperation(
				sessionStorage,
				'owner-2',
				'profile-form',
				'changed',
				() => 'operation-2'
			)
		).toBe('operation-2');
	});

	it('isolates the form and live-roast workflows for one owner', () => {
		reserveRoastCreateOperation(
			sessionStorage,
			'owner-1',
			'profile-form',
			'form-payload',
			() => 'form-operation'
		);

		expect(
			reserveRoastCreateOperation(
				sessionStorage,
				'owner-1',
				'live-roast',
				'live-payload',
				() => 'live-operation'
			)
		).toBe('live-operation');
		expect(readRoastCreateOperation(sessionStorage, 'owner-1', 'profile-form')?.payload).toBe(
			'form-payload'
		);
	});

	it('rotates only after the caller clears a definitive operation', () => {
		reserveRoastCreateOperation(
			sessionStorage,
			'owner-1',
			'profile-form',
			'first',
			() => 'operation-1'
		);
		clearRoastCreateOperation(sessionStorage, 'owner-1', 'profile-form');

		expect(
			reserveRoastCreateOperation(
				sessionStorage,
				'owner-1',
				'profile-form',
				'changed',
				() => 'operation-2'
			)
		).toBe('operation-2');
	});

	it('classifies ambiguous and definitive HTTP outcomes', () => {
		expect(shouldRetainRoastCreateOperation(500)).toBe(true);
		expect(shouldRetainRoastCreateOperation(409)).toBe(true);
		expect(shouldRetainRoastCreateOperation(429)).toBe(true);
		expect(shouldRetainRoastCreateOperation(400)).toBe(false);
		expect(shouldRetainRoastCreateOperation(403)).toBe(false);
	});
});
