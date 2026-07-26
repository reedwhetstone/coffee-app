import { describe, expect, it, vi } from 'vitest';
import { setTrackedLotState } from './trackedLots';

describe('setTrackedLotState', () => {
	it.each([true, false])('sends the explicit desired state %s', async (tracked) => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					catalogId: 42,
					tracked,
					trackedAt: tracked ? '2026-07-26T12:00:00Z' : null,
					priceAtTracking: tracked ? 7.1 : null
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await expect(setTrackedLotState(fetcher, 42, tracked)).resolves.toMatchObject({
			catalogId: 42,
			tracked
		});
		expect(fetcher).toHaveBeenCalledWith('/api/catalog/42/track', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tracked })
		});
	});

	it('throws on a failed response so optimistic callers can roll back', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
		await expect(setTrackedLotState(fetcher, 42, true)).rejects.toThrow('status 503');
	});
});
