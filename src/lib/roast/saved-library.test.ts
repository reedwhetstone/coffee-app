import { describe, expect, it } from 'vitest';
import type { SavedReference } from './roast-plan';
import { libraryRows, readOpenReference, referenceNameFromFile, savedHref } from './saved-library';

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const KEPT = 'aaaaaaaa-0000-4000-8000-000000000002';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';
const SNAPSHOT = 'aaaaaaaa-0000-4000-8000-000000000004';

function reference(overrides: Partial<SavedReference>): SavedReference {
	return {
		id: KEEPER,
		title: 'Guji natural, September keeper',
		notes: null,
		sourceClass: 'artisan_upload',
		status: 'active',
		artisanFileAvailable: true,
		currentRevisionId: `${overrides.id ?? KEEPER}-revision`,
		createdAt: '2026-09-28T12:00:00Z',
		updatedAt: '2026-09-28T12:00:00Z',
		sourceRoast: null,
		...overrides
	};
}

const keeper = reference({});
const kept = reference({
	id: KEPT,
	title: 'Colombia Sierra Nevada, Sept 24',
	sourceClass: 'executed_roast',
	createdAt: '2026-09-25T12:00:00Z',
	sourceRoast: { id: 4507, revision: 'revision-4507' }
});
const plan = reference({
	id: PLAN,
	title: 'Guji plan: +5°F through drying',
	sourceClass: 'generated_revision',
	artisanFileAvailable: false,
	createdAt: '2026-10-02T12:00:00Z'
});
const snapshot = reference({
	id: SNAPSHOT,
	title: 'Older Guji curve',
	sourceClass: 'executed_roast',
	artisanFileAvailable: false,
	createdAt: '2026-09-25T12:00:00Z',
	sourceRoast: { id: 4480, revision: 'revision-4480' }
});

describe('the saved library link', () => {
	it('opens the library, or one reference’s curve in it', () => {
		expect(savedHref()).toBe('/roast/saved');
		expect(savedHref(null)).toBe('/roast/saved');
		expect(savedHref(KEEPER)).toBe(`/roast/saved?ref=${KEEPER}`);
	});

	it('reads the open reference from the link, and nothing that is not a reference ID', () => {
		expect(readOpenReference(new URLSearchParams(`ref=${KEEPER}`))).toBe(KEEPER);
		expect(readOpenReference(new URLSearchParams(`ref=${KEEPER.toUpperCase()}`))).toBe(KEEPER);
		expect(readOpenReference(new URLSearchParams(''))).toBeNull();
		expect(readOpenReference(new URLSearchParams('ref=4531'))).toBeNull();
		expect(readOpenReference(new URLSearchParams(`ref=${KEEPER}/../x`))).toBeNull();
	});
});

describe('library rows', () => {
	it('lists every reference and plan newest first, each with its source and date', () => {
		const rows = libraryRows([kept, keeper, plan]);

		expect(rows.map((row) => [row.option.title, row.option.detail])).toEqual([
			['Guji plan: +5°F through drying', 'Plan · Saved Oct 2, 2026'],
			['Guji natural, September keeper', 'Artisan file · Saved Sep 28, 2026'],
			['Colombia Sierra Nevada, Sept 24', 'Saved from a roast · Saved Sep 25, 2026']
		]);
		expect(rows.map((row) => row.isPlan)).toEqual([true, false, false]);
	});

	it('orders two saved at the same moment by name', () => {
		expect(libraryRows([snapshot, kept]).map((row) => row.id)).toEqual([KEPT, SNAPSHOT]);
	});

	it('downloads a plan from its own file and a reference from the file it was added from', () => {
		const [planRow, keeperRow, keptRow] = libraryRows([kept, keeper, plan]);

		expect(planRow.downloadHref).toBe(
			`/api/reference-profiles/${PLAN}/revisions/${PLAN}-revision/export`
		);
		expect(keeperRow.downloadHref).toBe(`/api/reference-profiles/${KEEPER}/artisan-file`);
		expect(keptRow.downloadHref).toBe(`/api/reference-profiles/${KEPT}/artisan-file`);
	});

	it('offers a plan only from what still has a file Artisan can read', () => {
		const byId = Object.fromEntries(
			libraryRows([kept, keeper, plan, snapshot]).map((row) => [row.id, row.canPlan])
		);

		expect(byId).toEqual({ [KEEPER]: true, [KEPT]: true, [PLAN]: true, [SNAPSHOT]: false });
	});

	it('records only an uploaded Artisan file as a roast', () => {
		const archivedUpload = reference({ id: SNAPSHOT, artisanFileAvailable: false });
		const byId = Object.fromEntries(
			libraryRows([kept, keeper, plan]).map((row) => [row.id, row.canRecordAsRoast])
		);

		expect(byId).toEqual({ [KEEPER]: true, [KEPT]: false, [PLAN]: false });
		expect(libraryRows([archivedUpload])[0].canRecordAsRoast).toBe(false);
	});
});

describe('the name an added file is saved under', () => {
	it.each([
		['Guji_natural 09-28.alog', 'Guji natural 09-28'],
		['keeper.alog.json', 'keeper'],
		['export.JSON', 'export'],
		['  spaced   out  .alog', 'spaced out'],
		['.alog', 'Artisan reference']
	])('names %s as %s', (fileName, name) => {
		expect(referenceNameFromFile(fileName)).toBe(name);
	});

	it('keeps a long file name within the length a name can be', () => {
		expect(referenceNameFromFile(`${'a'.repeat(300)}.alog`)).toHaveLength(120);
	});
});
