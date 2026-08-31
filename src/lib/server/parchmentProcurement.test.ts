import { describe, expect, it, vi } from 'vitest';
import {
	getActiveSourcingBriefMatches,
	getSourcingBriefMatches,
	listActiveSourcingBriefs,
	type SourcingBriefResource
} from './parchmentProcurement';

const brief = {
	id: 'brief-1',
	name: 'Ethiopia naturals',
	criteria: { version: 1, country: 'Ethiopia', processing: 'Natural' },
	cadence: 'manual',
	isActive: true,
	lastRunAt: null,
	createdAt: '2026-07-01T00:00:00Z',
	updatedAt: '2026-07-02T00:00:00Z'
} as unknown as SourcingBriefResource;

function listBody(rows: SourcingBriefResource[] = [brief]) {
	return {
		data: rows,
		meta: {
			resource: 'procurement-briefs',
			namespace: '/v1/procurement/briefs',
			version: 'v1',
			auth: { kind: 'session', role: 'member', apiPlan: null }
		}
	};
}

function matchBody({
	page,
	total,
	ids,
	briefOverride = brief,
	criteria = briefOverride.criteria,
	totalOverride
}: {
	page: number;
	total: number;
	ids: number[];
	briefOverride?: SourcingBriefResource;
	criteria?: Record<string, unknown>;
	totalOverride?: number;
}) {
	const effectiveTotal = totalOverride ?? total;
	const totalPages = effectiveTotal === 0 ? 0 : Math.ceil(effectiveTotal / 100);
	return {
		data: ids.map((id) => ({ id, matchReasons: ['country'] })),
		pagination: {
			page,
			limit: 100,
			total: effectiveTotal,
			totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1
		},
		meta: {
			resource: 'procurement-brief-matches',
			namespace: '/v1/procurement/briefs/:id/matches',
			version: 'v1',
			generatedAt: '2026-08-30T12:00:00Z',
			auth: { kind: 'session', role: 'member', apiPlan: null },
			brief: briefOverride,
			criteria,
			limitations: []
		}
	};
}

function makeClient(input: { list?: unknown; matches?: unknown[] } = {}) {
	return {
		procurement: {
			briefs: {
				list: vi.fn().mockResolvedValue(input.list ?? { data: listBody() }),
				matches: vi.fn().mockImplementation(async () => {
					const result = input.matches?.shift();
					return result ?? { data: matchBody({ page: 1, total: 0, ids: [] }) };
				})
			}
		}
	};
}

describe('listActiveSourcingBriefs', () => {
	it('returns a presentation prefix from a strict canonical list envelope', async () => {
		const second = { ...brief, id: 'brief-2', name: 'Second brief' };
		const client = makeClient({ list: { data: listBody([brief, second]) } });

		await expect(listActiveSourcingBriefs(client as never, 1)).resolves.toEqual([brief]);
		expect(client.procurement.briefs.list).toHaveBeenCalledOnce();
	});

	it.each([
		['missing body', { data: undefined }],
		['missing rows', { data: { ...listBody(), data: undefined } }],
		[
			'wrong namespace',
			{
				data: { ...listBody(), meta: { ...listBody().meta, namespace: '/wrong' } }
			}
		],
		[
			'inactive row',
			{
				data: listBody([{ ...brief, isActive: false } as SourcingBriefResource])
			}
		],
		[
			'missing criteria version',
			{
				data: listBody([
					{
						...brief,
						criteria: { country: 'Ethiopia' }
					} as unknown as SourcingBriefResource
				])
			}
		],
		[
			'unsupported criteria field',
			{
				data: listBody([
					{
						...brief,
						criteria: { version: 1, varietal: 'Gesha' }
					} as unknown as SourcingBriefResource
				])
			}
		],
		[
			'malformed criteria field type',
			{
				data: listBody([
					{
						...brief,
						criteria: { version: 1, country: 42, stocked_days: 2.5 }
					} as unknown as SourcingBriefResource
				])
			}
		],
		['duplicate brief ids', { data: listBody([brief, brief]) }]
	])('rejects a malformed list envelope: %s', async (_label, result) => {
		await expect(listActiveSourcingBriefs(makeClient({ list: result }) as never)).rejects.toThrow(
			'Invalid Parchment procurement response'
		);
	});

	it('surfaces API errors unchanged', async () => {
		const error = { message: 'Parchment unavailable' };
		await expect(listActiveSourcingBriefs(makeClient({ list: { error } }) as never)).rejects.toBe(
			error
		);
	});
});

describe('getSourcingBriefMatches', () => {
	it('exhausts 100-row pages and preserves canonical total separately from unique IDs', async () => {
		const firstPageIds = Array.from({ length: 100 }, (_, index) => index + 1);
		const client = makeClient({
			matches: [
				{ data: matchBody({ page: 1, total: 101, ids: firstPageIds }) },
				{ data: matchBody({ page: 2, total: 101, ids: [101] }) }
			]
		});

		await expect(getSourcingBriefMatches(client as never, brief)).resolves.toEqual({
			briefId: brief.id,
			briefName: brief.name,
			criteria: brief.criteria,
			totalMatchCount: 101,
			matchingIds: [...firstPageIds, 101]
		});
		expect(client.procurement.briefs.matches).toHaveBeenNthCalledWith(1, brief.id, {
			page: 1,
			limit: 100
		});
		expect(client.procurement.briefs.matches).toHaveBeenNthCalledWith(2, brief.id, {
			page: 2,
			limit: 100
		});
	});

	it('rejects a page that overlaps an earlier page', async () => {
		const ids = Array.from({ length: 100 }, (_, index) => index + 1);
		const client = makeClient({
			matches: [
				{ data: matchBody({ page: 1, total: 200, ids }) },
				{ data: matchBody({ page: 2, total: 200, ids }) }
			]
		});

		await expect(getSourcingBriefMatches(client as never, brief)).rejects.toThrow(
			'duplicates id 1 from an earlier page'
		);
	});

	it('rejects duplicate ids within one page', async () => {
		const ids = Array.from({ length: 99 }, (_, index) => index + 1);
		const client = makeClient({
			matches: [{ data: matchBody({ page: 1, total: 100, ids: [...ids, 99] }) }]
		});

		await expect(getSourcingBriefMatches(client as never, brief)).rejects.toThrow(
			'match page 1 contains duplicate ids'
		);
	});

	it('rejects an empty page while pagination says matches remain', async () => {
		const body = matchBody({ page: 1, total: 101, ids: [] });
		await expect(
			getSourcingBriefMatches(makeClient({ matches: [{ data: body }] }) as never, brief)
		).rejects.toThrow('returned 0 rows; expected 100');
	});

	it('rejects totals that change between pages', async () => {
		const ids = Array.from({ length: 100 }, (_, index) => index + 1);
		const client = makeClient({
			matches: [
				{ data: matchBody({ page: 1, total: 101, ids }) },
				{ data: matchBody({ page: 2, total: 102, ids: [101, 102] }) }
			]
		});

		await expect(getSourcingBriefMatches(client as never, brief)).rejects.toThrow('total changed');
	});

	it('rejects criteria and brief metadata drift', async () => {
		const changed = {
			...brief,
			criteria: { version: 1 as const, country: 'Colombia' }
		} as unknown as SourcingBriefResource;
		const client = makeClient({
			matches: [
				{
					data: matchBody({
						page: 1,
						total: 1,
						ids: [1],
						briefOverride: changed
					})
				}
			]
		});

		await expect(getSourcingBriefMatches(client as never, brief)).rejects.toThrow(
			'brief metadata is mismatched'
		);
	});

	it('rejects unsupported criteria in match metadata', async () => {
		const body = matchBody({
			page: 1,
			total: 1,
			ids: [1],
			criteria: { ...brief.criteria, supplier: 'Example Importer' }
		});

		await expect(
			getSourcingBriefMatches(makeClient({ matches: [{ data: body }] }) as never, brief)
		).rejects.toThrow('meta.criteria.supplier is not supported');
	});

	it('rejects malformed criteria in match metadata', async () => {
		const body = matchBody({
			page: 1,
			total: 1,
			ids: [1],
			criteria: { ...brief.criteria, wholesale_only: 'yes' }
		});

		await expect(
			getSourcingBriefMatches(makeClient({ matches: [{ data: body }] }) as never, brief)
		).rejects.toThrow('meta.criteria.wholesale_only must be a boolean');
	});

	it('rejects malformed match rows', async () => {
		const body = matchBody({ page: 1, total: 1, ids: [1] });
		body.data = [{ id: 1, matchReasons: [null] }] as never;
		await expect(
			getSourcingBriefMatches(makeClient({ matches: [{ data: body }] }) as never, brief)
		).rejects.toThrow('matchReasons must be a string array');
	});
});

describe('getActiveSourcingBriefMatches', () => {
	it('uses the strict list and match adapters as one canonical consumer path', async () => {
		const client = makeClient({
			list: { data: listBody([brief]) },
			matches: [{ data: matchBody({ page: 1, total: 1, ids: [42] }) }]
		});

		await expect(getActiveSourcingBriefMatches(client as never, 5)).resolves.toEqual([
			expect.objectContaining({ briefId: brief.id, totalMatchCount: 1, matchingIds: [42] })
		]);
	});
});
