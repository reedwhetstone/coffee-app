import { describe, expect, it } from 'vitest';
import {
	batchCoffees,
	batchLabel,
	batchOptionLabels,
	batchSaleHref,
	batchSpanLabel,
	deleteBatchConfirmation,
	groupRoastsByBatch,
	logSaleLink,
	parseBatchId,
	readBatchFilter,
	readSalePrefill,
	roastListHref,
	roastSaleHref,
	saleHref
} from './roast-batches';

const OCT_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEP_24 = 'aaaaaaaa-0000-4000-8000-000000000002';
const GUJI = 'aaaaaaaa-0000-4000-8000-000000000003';
const LATE = 'aaaaaaaa-0000-4000-8000-000000000004';

const params = (query: string) => new URLSearchParams(query);

// "Wednesday roast" is roasted every week: Oct 1 and Sep 24 are two batches with one name.
// The late session starts on Sep 30 and its last roast drops after midnight.
const roasts = [
	{
		roast_id: 4531,
		batch_id: OCT_1,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	},
	{
		roast_id: 4530,
		batch_id: OCT_1,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		coffee_id: 102,
		coffee_name: 'Colombia Sierra Nevada'
	},
	{
		roast_id: 4527,
		batch_id: LATE,
		batch_name: 'Late session',
		roast_date: '2026-10-01T00:00:00+00:00',
		coffee_id: 103,
		coffee_name: 'Kenya Nyeri'
	},
	{
		roast_id: 4526,
		batch_id: LATE,
		batch_name: 'Late session',
		roast_date: '2026-09-30',
		coffee_id: 103,
		coffee_name: 'Kenya Nyeri'
	},
	{
		roast_id: 4529,
		batch_id: GUJI,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	},
	{
		roast_id: 4521,
		batch_id: SEP_24,
		batch_name: 'Wednesday roast',
		roast_date: '2026-09-24',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	}
];

describe('grouping roasts into batches', () => {
	it('groups by batch ID, newest batch first, with each batch’s roasts newest first', () => {
		const batches = groupRoastsByBatch(roasts);

		expect(batches.map((batch) => batch.id)).toEqual([OCT_1, LATE, GUJI, SEP_24]);
		expect(batches.map((batch) => batch.roasts.map((roast) => roast.roast_id))).toEqual([
			[4531, 4530],
			[4527, 4526],
			[4529],
			[4521]
		]);
	});

	it('keeps two batches that share a name apart', () => {
		const wednesdays = groupRoastsByBatch(roasts).filter(
			(batch) => batch.name === 'Wednesday roast'
		);

		expect(wednesdays.map((batch) => [batch.id, batch.date, batch.roasts.length])).toEqual([
			[OCT_1, '2026-10-01', 2],
			[SEP_24, '2026-09-24', 1]
		]);
	});

	it('keeps two batches apart even when they share a name and a day', () => {
		const morning = { ...roasts[0], roast_id: 1, batch_id: OCT_1 };
		const evening = { ...roasts[0], roast_id: 2, batch_id: SEP_24 };

		expect(groupRoastsByBatch([morning, evening]).map((batch) => batch.id)).toEqual([
			SEP_24,
			OCT_1
		]);
	});

	it('keeps a batch whose roasts span two days together, dated by its first day', () => {
		const late = groupRoastsByBatch(roasts).find((batch) => batch.id === LATE)!;

		expect(late.roasts).toHaveLength(2);
		expect(late.date).toBe('2026-09-30');
		expect(late.lastDate).toBe('2026-10-01');
		expect(batchSpanLabel(late, 2026)).toBe('Sep 30 to Oct 1');
	});

	it('gives a one-day batch no span', () => {
		const wednesday = groupRoastsByBatch(roasts)[0];

		expect(wednesday.lastDate).toBeNull();
		expect(batchSpanLabel(wednesday, 2026)).toBeNull();
	});

	it('keeps a roast that arrived without a batch ID with the roasts of its name and day', () => {
		const batches = groupRoastsByBatch([
			{ roast_id: 2, batch_name: 'Old batch', roast_date: '2026-08-02' },
			{ roast_id: 1, batch_name: 'Old batch', roast_date: '2026-08-02' },
			{ roast_id: 3, batch_name: 'Old batch', roast_date: '2026-08-09', batch_id: 'not-an-id' }
		]);

		expect(batches.map((batch) => [batch.id, batch.date, batch.roasts.length])).toEqual([
			[null, '2026-08-09', 1],
			[null, '2026-08-02', 2]
		]);
		expect(batchSaleHref(batches[0])).toBeNull();
	});

	it('returns nothing for no roasts', () => {
		expect(groupRoastsByBatch([])).toEqual([]);
	});
});

describe('naming a batch', () => {
	const batches = groupRoastsByBatch(roasts);

	it('leads with the date, because a name can repeat', () => {
		expect(batches.map((batch) => batchLabel(batch, 2026))).toEqual([
			'Oct 1 · Wednesday roast',
			'Sep 30 · Late session',
			'Sep 27 · Guji drop test',
			'Sep 24 · Wednesday roast'
		]);
	});

	it('adds the year to a batch from an earlier year', () => {
		expect(batchLabel(batches[0], 2027)).toBe('Oct 1, 2026 · Wednesday roast');
	});

	it('falls back to the name alone when no roast carries a date', () => {
		expect(batchLabel({ name: 'Undated', date: null })).toBe('Undated');
	});

	it('lists the coffees roasted in a batch once each', () => {
		expect(batchCoffees(batches[0])).toEqual([
			{ id: 101, name: 'Ethiopia Wush Wush' },
			{ id: 102, name: 'Colombia Sierra Nevada' }
		]);
		expect(batchCoffees(batches[1])).toEqual([{ id: 103, name: 'Kenya Nyeri' }]);
	});

	it('labels batches in a picker by date and name when that tells them apart', () => {
		expect([...batchOptionLabels(batches, 2026).values()]).toEqual([
			'Oct 1 · Wednesday roast',
			'Sep 30 · Late session',
			'Sep 27 · Guji drop test',
			'Sep 24 · Wednesday roast'
		]);
	});

	it('adds the coffee to batches that share a name and a day', () => {
		const sameDay = groupRoastsByBatch([
			{ ...roasts[0], roast_id: 11, batch_id: OCT_1 },
			{ ...roasts[1], roast_id: 12, batch_id: SEP_24 },
			{ ...roasts[4] }
		]);

		expect(Object.fromEntries(batchOptionLabels(sameDay, 2026))).toEqual({
			[OCT_1]: 'Oct 1 · Wednesday roast · Ethiopia Wush Wush',
			[SEP_24]: 'Oct 1 · Wednesday roast · Colombia Sierra Nevada',
			[GUJI]: 'Sep 27 · Guji drop test'
		});
	});

	it('adds the roast numbers when name, day, and coffee all match', () => {
		const twins = groupRoastsByBatch([
			{ ...roasts[0], roast_id: 11, batch_id: OCT_1 },
			{ ...roasts[0], roast_id: 12, batch_id: SEP_24 }
		]);

		expect(Object.fromEntries(batchOptionLabels(twins, 2026))).toEqual({
			[OCT_1]: 'Oct 1 · Wednesday roast · Ethiopia Wush Wush · #11',
			[SEP_24]: 'Oct 1 · Wednesday roast · Ethiopia Wush Wush · #12'
		});
	});
});

describe('the roast list’s ?batch= filter', () => {
	it('reads a batch ID', () => {
		expect(readBatchFilter(params(`batch=${OCT_1}`))).toBe(OCT_1);
		expect(readBatchFilter(params(`coffee=101&batch=${OCT_1.toUpperCase()}`))).toBe(OCT_1);
	});

	it.each(['', 'batch=', 'batch=Wednesday%20roast', 'batch=4531', `batch=${OCT_1}x`])(
		'reads no filter from "%s"',
		(query) => {
			expect(readBatchFilter(params(query))).toBeNull();
		}
	);

	it('links back to the list as it was narrowed', () => {
		expect(roastListHref()).toBe('/roast');
		expect(roastListHref({ coffee: 101 })).toBe('/roast?coffee=101');
		expect(roastListHref({ batch: OCT_1 })).toBe(`/roast?batch=${OCT_1}`);
		expect(roastListHref({ coffee: 101, batch: OCT_1 })).toBe(`/roast?coffee=101&batch=${OCT_1}`);
	});

	it('carries every filter the list was narrowed by, and escapes a search', () => {
		expect(roastListHref({ coffee: 101, range: '30d', q: 'guji', market: 'wholesale' })).toBe(
			'/roast?coffee=101&range=30d&q=guji&market=wholesale'
		);
		expect(roastListHref({ from: '2026-09-01', to: '2026-09-30', q: 'drop & rest #2' })).toBe(
			'/roast?from=2026-09-01&to=2026-09-30&q=drop%20%26%20rest%20%232'
		);
		expect(roastListHref({ coffee: null, batch: null, range: null, q: '', market: null })).toBe(
			'/roast'
		);
	});

	it('reads a batch ID only when it is one', () => {
		expect(parseBatchId(` ${OCT_1} `)).toBe(OCT_1);
		expect(parseBatchId(null)).toBeNull();
		expect(parseBatchId('Wednesday roast')).toBeNull();
	});
});

describe('"Log sale" links', () => {
	const batches = groupRoastsByBatch(roasts);

	it('fills in the coffee, the batch, and the roast from a roast', () => {
		expect(roastSaleHref(roasts[0])).toBe(`/profit?modal=new&coffee=101&batch=${OCT_1}&roast=4531`);
		expect(logSaleLink(roasts[0])).toEqual([
			{ label: 'Log sale', href: `/profit?modal=new&coffee=101&batch=${OCT_1}&roast=4531` }
		]);
	});

	it('offers nothing for a roast with no batch ID or no coffee', () => {
		expect(logSaleLink({ roast_id: 9, coffee_id: 101 })).toEqual([]);
		expect(logSaleLink({ roast_id: 9, batch_id: OCT_1, coffee_id: null })).toEqual([]);
	});

	it('fills in the batch and its coffee from a batch of one coffee', () => {
		expect(batchSaleHref(batches[1])).toBe(`/profit?modal=new&coffee=103&batch=${LATE}`);
	});

	it('leaves the coffee to the form for a batch of several coffees', () => {
		expect(batchSaleHref(batches[0])).toBe(`/profit?modal=new&batch=${OCT_1}`);
	});

	it('fills in the coffee when the list is narrowed to one', () => {
		// Narrowed to one coffee, the list holds only that coffee's roasts of the batch.
		const narrowed = groupRoastsByBatch(roasts.filter((roast) => roast.coffee_id === 102));

		expect(batchSaleHref(narrowed[0])).toBe(`/profit?modal=new&coffee=102&batch=${OCT_1}`);
	});

	it('opens the empty form with nothing filled in', () => {
		expect(saleHref()).toBe('/profit?modal=new');
	});

	it('reads back what a link filled in', () => {
		expect(readSalePrefill(params(`modal=new&coffee=101&batch=${OCT_1}&roast=4531`))).toEqual({
			coffeeId: 101,
			batchId: OCT_1,
			roastId: 4531
		});
		expect(readSalePrefill(params('modal=new'))).toEqual({
			coffeeId: null,
			batchId: null,
			roastId: null
		});
	});

	it('leaves out a value it cannot read', () => {
		expect(
			readSalePrefill(params('modal=new&coffee=abc&batch=Wednesday%20roast&roast=-1'))
		).toEqual({ coffeeId: null, batchId: null, roastId: null });
	});
});

describe('the delete-batch confirmation', () => {
	const batches = groupRoastsByBatch(roasts);

	it('names the batch by name and date and says how many roasts go with it', () => {
		expect(deleteBatchConfirmation(batches[0])).toBe(
			'Delete the batch “Wednesday roast” from Oct 1, 2026? This removes its 2 roasts and everything recorded for them, and cannot be undone. Sales recorded against the batch are kept.'
		);
	});

	it('tells the other batch with the same name apart by its date', () => {
		expect(deleteBatchConfirmation(batches[3])).toBe(
			'Delete the batch “Wednesday roast” from Sep 24, 2026? This removes its 1 roast and everything recorded for it, and cannot be undone. Sales recorded against the batch are kept.'
		);
	});

	it('leaves the date out when no roast carries one', () => {
		expect(deleteBatchConfirmation({ name: 'Undated', date: null, roasts: [roasts[0]] })).toContain(
			'Delete the batch “Undated”? This removes its 1 roast'
		);
	});
});
