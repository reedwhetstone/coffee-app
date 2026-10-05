import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { components } from '@purveyors/sdk';
import ProfileComparison from './ProfileComparison.svelte';
import type { PickerRoast } from '$lib/roast/profile-picker-model';
import type { CompareSide, CompareSides } from '$lib/roast/compare-sides';

type Summary = components['schemas']['ReferenceProfileSummary'];

const KEEPER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000003';

const reference = (
	id: string,
	title: string,
	createdAt: string,
	sourceClass: Summary['sourceClass'] = 'artisan_upload'
): Summary => ({
	id,
	title,
	notes: null,
	sourceClass,
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt,
	updatedAt: createdAt
});

const references = [
	reference(KEEPER, 'Guji natural, September keeper', '2026-09-28T00:00:00Z'),
	reference(PLAN, 'Guji plan: +5°F through drying', '2026-10-02T00:00:00Z', 'generated_revision')
];

const roasts: PickerRoast[] = [
	{
		roast_id: 4531,
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		charge_time: 0
	},
	{
		roast_id: 4530,
		coffee_id: 102,
		coffee_name: 'Colombia Sierra Nevada',
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		charge_time: 0
	},
	{
		roast_id: 4507,
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		batch_name: 'Wednesday roast',
		roast_date: '2026-09-17',
		charge_time: 0
	},
	{
		roast_id: 4529,
		coffee_id: 101,
		coffee_name: 'Ethiopia Yirgacheffe Wush Wush',
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		data_source: 'artisan_import'
	},
	{ roast_id: 4540, coffee_id: 101, coffee_name: 'Set up, never roasted', roast_date: '2026-10-04' }
];

const milestone = (name: string, leftMilliseconds: number, rightMilliseconds: number) => ({
	name,
	leftMilliseconds,
	rightMilliseconds,
	deltaMilliseconds: rightMilliseconds - leftMilliseconds
});

const comparison = {
	alignment: 'charge',
	targetUnit: 'F',
	left: { type: 'executed_roast', id: '4531', revision: 'l' },
	right: { type: 'executed_roast', id: '4507', revision: 'r' },
	series: [
		{
			id: 'bean-temperature',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			points: [
				{ timeMilliseconds: 0, left: 380, right: 390, delta: 10 },
				{ timeMilliseconds: 60_000, left: 210, right: 215, delta: 5 },
				{ timeMilliseconds: 120_000, left: 250, right: 262, delta: 12 }
			]
		}
	],
	milestones: [
		milestone('charge', 0, 0),
		milestone('dry_end', 266_000, 260_000),
		milestone('fc_start', 498_000, 453_000),
		milestone('drop', 618_000, 605_000)
	]
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function stubFetch(
	compare: () => Response = () => json({ data: comparison }),
	listed: Summary[] = references
) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === '/api/reference-profiles/compare') return compare();
		if (url === '/api/reference-profiles' && !init?.method) return json({ data: listed });
		throw new Error(`Unexpected request: ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

const roastSide = (id: number): CompareSide => ({ type: 'roast', id });
const referenceSide = (id: string): CompareSide => ({ type: 'ref', id });

/** Draws the comparison for a link, and follows the link as the page would when a side changes. */
function open(a: CompareSide | null, b: CompareSide | null, listedRoasts = roasts) {
	const onChange = vi.fn((next: CompareSides) => void view.rerender({ a: next.a, b: next.b }));
	const view = render(ProfileComparison, { roasts: listedRoasts, a, b, onChange });
	return { ...view, onChange };
}

const compareRequests = (fetchMock: ReturnType<typeof stubFetch>) =>
	fetchMock.mock.calls
		.filter(([url]) => String(url) === '/api/reference-profiles/compare')
		.map(([, init]) => JSON.parse(String(init?.body)));

function optionsOf(listbox: HTMLElement) {
	return within(listbox)
		.getAllByRole('option')
		.map((option) => option.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}

function headingsOf(listbox: HTMLElement) {
	return within(listbox)
		.getAllByRole('group')
		.map((group) => group.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim());
}

function tableRows() {
	return within(screen.getByRole('table'))
		.getAllByRole('row')
		.map((row) =>
			[...row.querySelectorAll('th, td')].map((cell) =>
				// A phone shows "A" and "B" beside each time; the column headings carry them otherwise.
				[...cell.childNodes]
					.filter((node) => !(node instanceof HTMLElement && node.classList.contains('sm:hidden')))
					.map((node) => node.textContent)
					.join('')
					.trim()
			)
		);
}

/** True when `first` comes before `second` in the document. */
function precedes(first: Element, second: Element): boolean {
	return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('comparison with one side chosen', () => {
	it('opens the second picker and says what is being compared', async () => {
		stubFetch();
		open(roastSide(4531), null);

		const second = screen.getByRole('combobox', { name: 'Second (B)' });
		await waitFor(() => expect(second).toHaveAttribute('aria-expanded', 'true'));
		expect(second).toHaveFocus();
		expect(screen.getByRole('listbox', { name: 'Second (B)' })).toBeInTheDocument();
		expect(
			screen.getByText(
				'Choose a second roast or saved reference to compare with Ethiopia Yirgacheffe Wush Wush, Oct 1.'
			)
		).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'First (A)' })).toHaveValue(
			'Ethiopia Yirgacheffe Wush Wush'
		);
	});

	it("lists the same coffee's other roasts first, most recent first", async () => {
		stubFetch();
		open(roastSide(4531), null);
		await screen.findByText('Guji natural, September keeper');

		const listbox = screen.getByRole('listbox', { name: 'Second (B)' });
		expect(headingsOf(listbox)).toEqual(['Same coffee 2', 'Saved references 2', 'Other roasts 1']);
		const options = optionsOf(listbox);
		expect(options).toEqual([
			'Ethiopia Yirgacheffe Wush Wush Roasted Sep 27, 2026 · Guji drop test · Roast #4529',
			'Ethiopia Yirgacheffe Wush Wush Roasted Sep 17, 2026 · Wednesday roast · Roast #4507',
			'Guji plan: +5°F through drying Plan · Saved Oct 2, 2026',
			'Guji natural, September keeper Artisan file · Saved Sep 28, 2026',
			'Colombia Sierra Nevada Roasted Oct 1, 2026 · Wednesday roast · Roast #4530'
		]);
		// The roast already chosen is not offered against itself, and a roast with nothing
		// recorded is not offered at all.
		expect(options.join(' ')).not.toContain('#4531');
		expect(options.join(' ')).not.toContain('never roasted');
		expect(
			screen.getByText('1 roast with nothing recorded yet is not listed.')
		).toBeInTheDocument();
	});

	it('writes the second choice to the link, which runs the comparison', async () => {
		const fetchMock = stubFetch();
		const { onChange } = open(roastSide(4531), null);

		await fireEvent.click(
			within(await screen.findByRole('listbox', { name: 'Second (B)' })).getByRole('option', {
				name: /Roast #4507/
			})
		);

		expect(onChange).toHaveBeenCalledWith({ a: roastSide(4531), b: roastSide(4507) });
		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		expect(compareRequests(fetchMock)).toEqual([
			{
				left: { kind: 'executed_roast', id: '4531' },
				right: { kind: 'executed_roast', id: '4507' },
				targetUnit: 'F'
			}
		]);
	});

	it('does not open a picker when no side is chosen', async () => {
		stubFetch();
		open(null, null);
		await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/reference-profiles'));

		expect(screen.queryByRole('listbox')).toBeNull();
		expect(screen.queryByText(/Choose a second roast/)).toBeNull();
	});
});

describe('comparison with both sides chosen', () => {
	it('is on screen when the page opens, with the largest difference stated above the chart', async () => {
		const fetchMock = stubFetch();
		open(roastSide(4531), roastSide(4507));

		const largest = await screen.findByText('First crack: B was 45 sec earlier');
		expect(compareRequests(fetchMock)).toHaveLength(1);
		expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
		expect(screen.queryByRole('listbox')).toBeNull();

		// A and B are named with what they are, and each roast links back to itself.
		const key = document.querySelector<HTMLElement>('dl[aria-label="Compared"]')!;
		expect(key).toHaveTextContent(
			'A Ethiopia Yirgacheffe Wush Wush Roasted Oct 1, 2026 · Wednesday roast · Roast #4531 · Solid lines'
		);
		expect(key).toHaveTextContent(
			'B Ethiopia Yirgacheffe Wush Wush Roasted Sep 17, 2026 · Wednesday roast · Roast #4507 · Dashed lines'
		);
		const links = within(key).getAllByRole('link');
		expect(links.map((link) => link.getAttribute('href'))).toEqual([
			'/roast?roast=4531',
			'/roast?roast=4507'
		]);

		expect(tableRows()).toEqual([
			['Milestone', 'A', 'B', 'Difference'],
			['Dry end', '4:26', '4:20', 'B was 6 sec earlier'],
			['First crack', '8:18', '7:33', 'B was 45 sec earlier'],
			['Drop', '10:18', '10:05', 'B was 13 sec earlier']
		]);

		// The chart bundle loads on demand, so allow for its first import.
		const series = await screen.findByRole('button', { name: 'A · BT (°F)' }, { timeout: 10_000 });
		expect(screen.getByRole('button', { name: 'B · BT (°F)' })).toBeInTheDocument();
		expect(precedes(key, largest)).toBe(true);
		expect(precedes(largest, series)).toBe(true);
		expect(precedes(series, screen.getByRole('table'))).toBe(true);
		expect(document.body.textContent).not.toContain('fc_start');
	});

	it('names each side by coffee and date for Cherry AI, never by record number', async () => {
		stubFetch();
		open(roastSide(4531), referenceSide(KEEPER));

		const cherry = new URL(
			(await screen.findByRole('link', { name: 'Discuss with Cherry AI' })).getAttribute('href') ??
				'',
			'https://purveyors.io'
		);
		expect(cherry.pathname).toBe('/chat');
		expect(cherry.searchParams.get('prompt')).toBe(
			'Discuss the measured differences between Ethiopia Yirgacheffe Wush Wush, roasted Oct 1, 2026 and Guji natural, September keeper, a saved reference, and help me decide what to preserve or change.'
		);
		expect(cherry.searchParams.get('left_kind')).toBe('executed_roast');
		expect(cherry.searchParams.get('left_id')).toBe('4531');
		expect(cherry.searchParams.get('right_kind')).toBe('reference_profile');
		expect(cherry.searchParams.get('right_id')).toBe(KEEPER);
	});

	it('shows a milestone only one side recorded as not recorded, not as a difference', async () => {
		stubFetch(() =>
			json({
				data: {
					...comparison,
					// Parchment lists only what both sides recorded, so first crack is absent here.
					milestones: comparison.milestones.filter((entry) => entry.name !== 'fc_start')
				},
				sideMilestones: {
					left: [
						{ name: 'charge', milliseconds: 0 },
						{ name: 'dry_end', milliseconds: 266_000 },
						{ name: 'drop', milliseconds: 618_000 }
					],
					right: [
						{ name: 'charge', milliseconds: 0 },
						{ name: 'dry_end', milliseconds: 260_000 },
						{ name: 'fc_start', milliseconds: 453_000 },
						{ name: 'drop', milliseconds: 605_000 }
					]
				}
			})
		);
		open(roastSide(4531), roastSide(4507));

		// The largest difference is taken from milestones both sides recorded.
		expect(await screen.findByText('Drop: B was 13 sec earlier')).toBeInTheDocument();
		expect(tableRows()).toEqual([
			['Milestone', 'A', 'B', 'Difference'],
			['Dry end', '4:26', '4:20', 'B was 6 sec earlier'],
			['First crack', 'Not recorded', '7:33', 'First crack not recorded for A'],
			['Drop', '10:18', '10:05', 'B was 13 sec earlier']
		]);
	});

	it('compares two saved references with no roast involved', async () => {
		const fetchMock = stubFetch();
		open(referenceSide(KEEPER), referenceSide(PLAN), []);

		expect(await screen.findByText('First crack: B was 45 sec earlier')).toBeInTheDocument();
		expect(compareRequests(fetchMock)).toEqual([
			{
				left: { kind: 'reference_profile', id: KEEPER },
				right: { kind: 'reference_profile', id: PLAN },
				targetUnit: 'F'
			}
		]);
		expect(screen.getByText('Artisan file · Saved Sep 28, 2026 · Solid lines')).toBeInTheDocument();
		expect(screen.getByText('Plan · Saved Oct 2, 2026 · Dashed lines')).toBeInTheDocument();
		// A saved reference has no roast to go back to.
		expect(screen.queryByRole('link', { name: 'Guji natural, September keeper' })).toBeNull();
	});

	it('compares again when a side is changed', async () => {
		const fetchMock = stubFetch();
		const { onChange } = open(roastSide(4531), roastSide(4507));
		await screen.findByText('First crack: B was 45 sec earlier');

		await fireEvent.focus(screen.getByRole('combobox', { name: 'Second (B)' }));
		await fireEvent.click(
			within(screen.getByRole('listbox', { name: 'Second (B)' })).getByRole('option', {
				name: /September keeper/
			})
		);

		expect(onChange).toHaveBeenLastCalledWith({ a: roastSide(4531), b: referenceSide(KEEPER) });
		await waitFor(() => expect(compareRequests(fetchMock)).toHaveLength(2));
		expect(compareRequests(fetchMock)[1].right).toEqual({ kind: 'reference_profile', id: KEEPER });
	});

	it('turns an alignment failure into a next step', async () => {
		stubFetch(() =>
			json({ error: 'Both profiles require a CHARGE milestone for charge alignment' }, 400)
		);
		open(roastSide(4531), roastSide(4529));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'One of these has no charge time recorded, so the two curves cannot be lined up. Choose one with a recorded curve.'
		);
		expect(screen.queryByRole('table')).toBeNull();
	});
});

describe('a comparison link that cannot be drawn', () => {
	it('says when a roast in the link is not among the roasts', async () => {
		const fetchMock = stubFetch();
		open(roastSide(999), roastSide(4507));

		expect(await screen.findByRole('alert')).toHaveTextContent('That roast could not be found');
		expect(compareRequests(fetchMock)).toEqual([]);
	});

	it('says when a roast in the link has nothing recorded', async () => {
		stubFetch();
		open(roastSide(4540), null);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'That roast has no recorded curve to compare'
		);
	});

	it('says when a saved reference in the link is gone, once the list has loaded', async () => {
		stubFetch();
		open(referenceSide('bbbbbbbb-0000-4000-8000-000000000009'), roastSide(4507));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'That saved reference could not be found'
		);
	});

	it('invites a first roast when there is nothing to compare', async () => {
		stubFetch(undefined, []);
		open(null, null, [roasts[4]]);

		expect(
			await screen.findByText('Record or import a roast, and it will appear here to compare.')
		).toBeInTheDocument();
		expect(screen.queryByRole('combobox')).toBeNull();
	});
});
