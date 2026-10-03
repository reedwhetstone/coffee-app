import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { components } from '@purveyors/sdk';
import ProfileStudio from './ProfileStudio.svelte';
import type { PickerRoast } from '$lib/roast/profile-picker-model';

type Summary = components['schemas']['ReferenceProfileSummary'];

const reference: Summary = {
	id: 'ref-1',
	title: 'newnewtest',
	notes: null,
	sourceClass: 'artisan_upload',
	status: 'active',
	currentRevisionId: 'ref-1-revision',
	createdAt: '2026-09-28T00:00:00Z',
	updatedAt: '2026-09-28T00:00:00Z'
};

const roasts: PickerRoast[] = [
	{
		roast_id: 12,
		coffee_name: 'Colombia Huila',
		batch_name: 'Colombia Huila',
		roast_date: '2026-08-12',
		oz_out: 13
	},
	{
		// Imported from Artisan last week; no output weight entered yet.
		roast_id: 4529,
		coffee_name: 'Ethiopia Guji Gogogu Natural',
		batch_name: 'Ethiopia Guji Gogogu Natural - Green Batch - 8/4/2025',
		roast_date: '2026-09-30',
		data_source: 'artisan_import'
	},
	{ roast_id: 13, coffee_name: 'Set up, never roasted', roast_date: '2026-10-01' }
];

const comparison = {
	alignment: 'charge',
	targetUnit: 'F',
	left: { type: 'reference_revision', id: 'ref-1-revision', revision: '1' },
	right: { type: 'executed_roast', id: '4529', revision: 'r' },
	series: [
		{
			id: 'bean-temperature',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			points: [
				{ timeMilliseconds: 0, left: 380, right: 390, delta: 10 },
				{ timeMilliseconds: 60_000, left: 210, right: -1, delta: -211 },
				{ timeMilliseconds: 120_000, left: 250, right: 262, delta: 12 }
			]
		},
		{
			id: 'environmental-temperature',
			name: 'ET',
			kind: 'environmental_temperature',
			unit: 'F',
			points: [
				{ timeMilliseconds: 0, left: -1, right: -1, delta: 0 },
				{ timeMilliseconds: 120_000, left: -1, right: -1, delta: 0 }
			]
		}
	],
	milestones: [
		{ name: 'charge', leftMilliseconds: 0, rightMilliseconds: 0, deltaMilliseconds: 0 },
		{
			name: 'dry_end',
			leftMilliseconds: 300_000,
			rightMilliseconds: 255_000,
			deltaMilliseconds: -45_000
		},
		{
			name: 'drop',
			leftMilliseconds: 720_000,
			rightMilliseconds: 498_500,
			deltaMilliseconds: -221_500
		}
	]
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function stubFetch() {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === '/api/reference-profiles/compare') return json({ data: comparison });
		if (url === '/api/reference-profiles' && !init?.method) return json({ data: [reference] });
		throw new Error(`Unexpected request: ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

async function choose(label: string, optionName: RegExp) {
	await fireEvent.focus(screen.getByRole('combobox', { name: label }));
	// The page also has native selects; the picker's own choices live in its listbox.
	await fireEvent.click(
		within(screen.getByRole('listbox')).getByRole('option', { name: optionName })
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('Profile Studio comparison', () => {
	it('offers a recent Artisan roast without an output weight and says what is not listed', async () => {
		stubFetch();
		render(ProfileStudio, { roasts, enabled: true });

		expect(await screen.findByText('1 saved reference · 2 roasts')).toBeInTheDocument();
		expect(
			screen.getByText('1 roast with nothing recorded yet is not listed.')
		).toBeInTheDocument();

		await fireEvent.focus(screen.getByRole('combobox', { name: 'Second profile (B)' }));
		const options = within(screen.getByRole('listbox'))
			.getAllByRole('option')
			.map((option) => option.textContent ?? '');
		expect(options[0]).toContain('newnewtest');
		expect(options[1]).toContain('Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4529');
		expect(options[2]).toContain('Colombia Huila');
		expect(options).toHaveLength(3);
	});

	it('names the two profiles A and B and explains milestone timing in plain words', async () => {
		const fetchMock = stubFetch();
		render(ProfileStudio, { roasts, enabled: true });
		await screen.findByText('1 saved reference · 2 roasts');

		await choose('First profile (A)', /newnewtest/);
		await choose('Second profile (B)', /Roast #4529/);
		await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

		expect(await screen.findByText('Measured comparison')).toBeInTheDocument();
		const request = fetchMock.mock.calls.find(
			([url]) => String(url) === '/api/reference-profiles/compare'
		);
		expect(JSON.parse(String(request?.[1]?.body))).toEqual({
			left: { kind: 'reference_profile', id: 'ref-1' },
			right: { kind: 'executed_roast', id: '4529' },
			targetUnit: 'F'
		});

		expect(screen.getByText('Artisan file · Saved Sep 28, 2026 · Solid lines')).toBeInTheDocument();
		// The Cherry prompt names each profile by coffee and date, never by record number.
		const cherry = new URL(
			screen.getByRole('link', { name: /Discuss with Cherry/ }).getAttribute('href') ?? '',
			'https://purveyors.io'
		);
		expect(cherry.searchParams.get('prompt')).toBe(
			'Discuss the measured differences between newnewtest, a saved reference and Ethiopia Guji Gogogu Natural, roasted Sep 30, 2026, and help me decide what to preserve or change.'
		);
		expect(cherry.searchParams.get('right_id')).toBe('4529');
		expect(
			screen.getByText('Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4529 · Dashed lines')
		).toBeInTheDocument();

		const rows = within(screen.getByRole('table')).getAllByRole('row');
		expect(
			rows.map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim()))
		).toEqual([
			['Milestone', 'A', 'B', 'Difference'],
			['Dry end', '5:00', '4:15', 'B was 45 sec earlier'],
			['Drop', '12:00', '8:19', 'B was 3 min 42 sec earlier']
		]);

		// Only real readings are drawn: no ET series, and no long labels on the chart.
		// The chart bundle loads on demand, so allow for its first import.
		expect(
			await screen.findByRole('button', { name: 'A · BT (°F)' }, { timeout: 10_000 })
		).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'B · BT (°F)' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /ET/ })).not.toBeInTheDocument();
		expect(document.body.textContent).not.toContain('dry_end');
	});

	it('turns an alignment failure into a next step', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) =>
				String(input) === '/api/reference-profiles/compare'
					? json({ error: 'Both profiles require a CHARGE milestone for charge alignment' }, 400)
					: json({ data: [reference] })
			)
		);
		render(ProfileStudio, { roasts, enabled: true });
		await screen.findByText('1 saved reference · 2 roasts');

		await choose('First profile (A)', /newnewtest/);
		await choose('Second profile (B)', /Colombia Huila/);
		await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'One of these profiles has no charge time recorded, so the two curves cannot be lined up.'
		);
	});
});
