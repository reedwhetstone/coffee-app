import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readPriceIndexForAgent } from './agentPriceIndex';

function createMockClient(result: unknown) {
	return {
		priceIndex: {
			list: vi.fn().mockResolvedValue(result)
		}
	};
}

const priceIndexItem = {
	date: '2026-06-09',
	origin: 'Ethiopia',
	process: 'Natural',
	grade: 'G1',
	wholesale: false,
	price: {
		min: 5.5,
		max: 12,
		avg: 8.25,
		median: 8,
		p25: 6.75,
		p75: 9.5,
		stdev: 1.2
	},
	sample: { suppliers: 4, listings: 23, aggregationTier: 2 },
	provenance: { synthetic: false }
};

describe('readPriceIndexForAgent', () => {
	it('queries the SDK with a bounded ISO date window and maps the response shape', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-26T12:00:00.000Z'));
		const client = createMockClient({ data: { data: [priceIndexItem] } });

		const result = await readPriceIndexForAgent(
			{ origin: 'Ethiopia', process: 'natural', days: 30, wholesale: false, limit: 20 },
			client as never
		);

		expect(client.priceIndex.list).toHaveBeenCalledWith({
			page: 1,
			limit: 20,
			order: 'desc',
			from: '2026-06-26',
			origin: 'Ethiopia',
			process: 'natural',
			wholesale: 'false'
		});
		expect(result).toEqual({
			snapshots: [
				{
					date: '2026-06-09',
					origin: 'Ethiopia',
					process: 'Natural',
					grade: 'G1',
					wholesale: false,
					price: { min: 5.5, p25: 6.75, median: 8, avg: 8.25, p75: 9.5, max: 12 },
					suppliers: 4,
					listings: 23,
					synthetic: false
				}
			],
			total_returned: 1,
			window_days: 30,
			filters_applied: { origin: 'Ethiopia', process: 'natural', wholesale: false },
			source: { table: 'price_index_snapshots', aggregate_only: true }
		});
	});

	it('clamps the lookback and limit before calling Parchment', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-26T12:00:00.000Z'));
		const client = createMockClient({ data: { data: [] } });

		const result = await readPriceIndexForAgent({ days: 9999, limit: 500 }, client as never);

		expect(result.window_days).toBe(365);
		expect(client.priceIndex.list).toHaveBeenCalledWith({
			page: 1,
			limit: 60,
			order: 'desc',
			from: '2025-07-26'
		});
	});

	it('authorizes repeat calls through the request-bound SDK client', async () => {
		const client = createMockClient({ data: { data: [priceIndexItem] } });

		await readPriceIndexForAgent({ origin: 'Ethiopia' }, client as never);
		await readPriceIndexForAgent({ origin: 'Ethiopia' }, client as never);

		expect(client.priceIndex.list).toHaveBeenCalledTimes(2);
	});

	it('surfaces API errors and does not cache them', async () => {
		const client = createMockClient({
			error: { error: { code: 'auth_required', message: 'Authentication required' } }
		});

		await expect(readPriceIndexForAgent({}, client as never)).rejects.toThrow(
			'Parchment price index query failed: Authentication required'
		);
		await expect(readPriceIndexForAgent({}, client as never)).rejects.toThrow(
			'Parchment price index query failed: Authentication required'
		);
		expect(client.priceIndex.list).toHaveBeenCalledTimes(2);
	});

	it('contains no direct Supabase query in the retired reader', () => {
		const source = readFileSync(resolve('src/lib/server/agentPriceIndex.ts'), 'utf8');

		expect(source).not.toContain('createAdminClient');
		expect(source).not.toMatch(/\.from\(['"]price_index_snapshots['"]\)/);
	});
});
