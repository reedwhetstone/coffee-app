import { describe, expect, it, vi } from 'vitest';
import { listActiveSourcingBriefs } from './parchmentProcurement';

function makeClient(result: unknown) {
	return {
		procurement: {
			briefs: {
				list: vi.fn().mockResolvedValue(result)
			}
		}
	};
}

const briefs = [
	{
		id: 'brief-2',
		name: 'Newest',
		criteria: { version: 1, country: 'Ethiopia' },
		cadence: 'manual',
		isActive: true,
		lastRunAt: null,
		createdAt: '2026-07-02T00:00:00Z',
		updatedAt: '2026-07-02T00:00:00Z'
	},
	{
		id: 'brief-1',
		name: 'Older',
		criteria: { version: 1, country: 'Colombia' },
		cadence: 'manual',
		isActive: true,
		lastRunAt: null,
		createdAt: '2026-07-01T00:00:00Z',
		updatedAt: '2026-07-01T00:00:00Z'
	}
];

describe('listActiveSourcingBriefs', () => {
	it('returns the canonical response rows', async () => {
		const client = makeClient({ data: { data: briefs } });

		await expect(listActiveSourcingBriefs(client as never)).resolves.toEqual(briefs);
		expect(client.procurement.briefs.list).toHaveBeenCalledOnce();
	});

	it('takes a presentation-sized prefix without changing API ordering', async () => {
		const client = makeClient({ data: { data: briefs } });

		await expect(listActiveSourcingBriefs(client as never, 1)).resolves.toEqual([briefs[0]]);
	});

	it('returns an empty list for a missing response body', async () => {
		const client = makeClient({ data: undefined });

		await expect(listActiveSourcingBriefs(client as never)).resolves.toEqual([]);
	});

	it('surfaces API errors to the caller', async () => {
		const error = { message: 'Parchment unavailable' };
		const client = makeClient({ error });

		await expect(listActiveSourcingBriefs(client as never)).rejects.toBe(error);
	});
});
