import { describe, expect, it, vi } from 'vitest';
import {
	createParchmentRoasts,
	deleteParchmentRoast,
	deleteParchmentRoastBatch,
	updateParchmentRoast
} from './parchmentRoastMutations';

function profile(id = 41) {
	return {
		roast_id: id,
		coffee_id: 7,
		batch_name: 'Tuesday batch',
		coffee_name: 'Ethiopia Test',
		last_updated: '2026-09-01T18:00:00Z',
		user: 'owner-1'
	};
}

function client() {
	return {
		roasts: {
			create: vi.fn(),
			createBatch: vi.fn(),
			update: vi.fn(),
			replaceLiveCurve: vi.fn(),
			delete: vi.fn(),
			deleteBatch: vi.fn()
		}
	};
}

describe('Parchment roast mutations', () => {
	it('maps one legacy snake-case create and returns the canonical profile', async () => {
		const parchment = client();
		parchment.roasts.create.mockResolvedValue({ data: { data: profile() } });

		const result = await createParchmentRoasts(
			parchment as never,
			{
				coffee_id: 7,
				coffee_name: 'Ethiopia Test',
				batch_name: 'Tuesday batch',
				roast_date: '2026-09-01T12:00:00Z',
				oz_in: 16,
				oz_out: null,
				roast_notes: 'Light development'
			},
			'roast-create-1'
		);

		expect(parchment.roasts.create).toHaveBeenCalledWith(
			{
				coffeeId: 7,
				coffeeName: 'Ethiopia Test',
				batchName: 'Tuesday batch',
				roastDate: '2026-09-01T12:00:00Z',
				ozIn: 16,
				notes: 'Light development'
			},
			{ idempotencyKey: 'roast-create-1' }
		);
		expect(result).toEqual({ isBatch: false, profiles: [profile()] });
	});

	it('creates one payload-bound named batch and omits null weights', async () => {
		const parchment = client();
		parchment.roasts.createBatch.mockResolvedValue({
			data: {
				data: {
					batchName: 'Tuesday batch',
					profiles: [profile(41), { ...profile(42), coffee_id: 8 }]
				}
			}
		});

		const result = await createParchmentRoasts(
			parchment as never,
			{
				batch_name: 'Tuesday batch',
				roast_date: '2026-09-01T12:00:00Z',
				roast_notes: 'Test batch',
				batch_beans: [
					{ coffee_id: 7, coffee_name: 'Ethiopia Test', oz_in: 16, oz_out: null },
					{ coffee_id: 8, coffee_name: 'Kenya Test', oz_in: 12, oz_out: 10 }
				]
			},
			'batch-create-1'
		);

		expect(parchment.roasts.createBatch).toHaveBeenCalledWith(
			{
				batchName: 'Tuesday batch',
				roastDate: '2026-09-01T12:00:00Z',
				notes: 'Test batch',
				items: [
					{ coffeeId: 7, coffeeName: 'Ethiopia Test', ozIn: 16 },
					{ coffeeId: 8, coffeeName: 'Kenya Test', ozIn: 12, ozOut: 10 }
				]
			},
			'batch-create-1'
		);
		expect(result).toEqual({
			isBatch: true,
			profiles: [profile(41), { ...profile(42), coffee_id: 8 }]
		});
	});

	it('requires a browser-stable idempotency key for batch creation', async () => {
		await expect(
			createParchmentRoasts(client() as never, {
				batch_name: 'Tuesday batch',
				batch_beans: [{ coffee_id: 7 }]
			})
		).rejects.toMatchObject({
			status: 400,
			message: 'Idempotency-Key is required for roast batch creation'
		});
	});

	it('preserves explicit clears and omits last_updated from metadata writes', async () => {
		const parchment = client();
		parchment.roasts.update.mockResolvedValue({ data: { data: profile() } });

		await updateParchmentRoast(
			parchment as never,
			41,
			{
				oz_in: null,
				oz_out: 12,
				roast_notes: null,
				roast_targets: null,
				weight_loss_percent: 999,
				user: 'untrusted-owner',
				last_updated: 'client-generated-write-time'
			},
			'2026-09-01T18:00:00Z'
		);

		expect(parchment.roasts.update).toHaveBeenCalledWith(
			41,
			{ ozIn: null, ozOut: 12, notes: null, targets: null },
			{ ifMatch: '2026-09-01T18:00:00Z' }
		);
	});

	it('uses the source-aware live-curve command for browser telemetry', async () => {
		const parchment = client();
		parchment.roasts.replaceLiveCurve.mockResolvedValue({ data: { data: profile() } });

		await updateParchmentRoast(parchment as never, 41, {
			temperatureEntries: [
				{
					roast_id: 41,
					time_seconds: 5,
					bean_temp: 120,
					environmental_temp: null,
					data_source: 'live'
				}
			],
			eventEntries: [
				{
					roast_id: 41,
					time_seconds: 5,
					event_type: 10,
					event_value: null,
					event_string: 'charge',
					category: 'milestone',
					subcategory: '',
					user_generated: true,
					automatic: false
				}
			],
			last_updated: 'ignored-client-write-time'
		});

		expect(parchment.roasts.replaceLiveCurve).toHaveBeenCalledWith(
			41,
			{
				temperatures: [
					{
						timeSeconds: 5,
						beanTemp: 120,
						environmentalTemp: null,
						dataSource: 'live'
					}
				],
				events: [
					{
						timeSeconds: 5,
						eventType: 10,
						eventValue: null,
						eventString: 'charge',
						category: 'milestone',
						subcategory: '',
						userGenerated: true,
						automatic: false
					}
				]
			},
			undefined
		);
		expect(parchment.roasts.update).not.toHaveBeenCalled();
	});

	it('rejects a non-atomic mixed metadata and live-curve request', async () => {
		await expect(
			updateParchmentRoast(client() as never, 41, {
				roast_notes: 'metadata',
				temperatureEntries: []
			})
		).rejects.toMatchObject({
			status: 400,
			message: 'Profile metadata and live curve data must be saved separately'
		});
	});

	it('verifies canonical single and batch delete acknowledgements', async () => {
		const parchment = client();
		parchment.roasts.delete.mockResolvedValue({ data: { data: { id: 41, deleted: true } } });
		parchment.roasts.deleteBatch.mockResolvedValue({
			data: {
				data: { batchName: 'Tuesday batch', ids: [41, 42], deleted: true }
			}
		});

		await deleteParchmentRoast(parchment as never, 41);
		await deleteParchmentRoastBatch(parchment as never, 'Tuesday batch');

		expect(parchment.roasts.delete).toHaveBeenCalledWith(41);
		expect(parchment.roasts.deleteBatch).toHaveBeenCalledWith('Tuesday batch');
	});
});
