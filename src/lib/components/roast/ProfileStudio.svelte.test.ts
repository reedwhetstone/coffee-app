import { cleanup, render, screen, within } from '@testing-library/svelte';
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

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function stubFetch() {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === '/api/reference-profiles' && !init?.method) return json({ data: [reference] });
		throw new Error(`Unexpected request: ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('Profile Studio', () => {
	it('sends comparison to its own page instead of drawing it here', async () => {
		const fetchMock = stubFetch();
		render(ProfileStudio, { roasts, enabled: true });

		const link = await screen.findByRole('link', { name: 'Compare roasts' });
		expect(link).toHaveAttribute('href', '/roast/compare');
		expect(
			screen.getByText('Line up any two roasts or saved references. Both curves start at charge.')
		).toBeInTheDocument();

		// No pickers, Compare button, or result are left in the section.
		expect(screen.queryByLabelText(/\((A|B)\)$/)).toBeNull();
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
		expect(screen.queryByRole('table')).toBeNull();
		expect(
			fetchMock.mock.calls.some(([url]) => String(url) === '/api/reference-profiles/compare')
		).toBe(false);
	});

	it('still offers every recorded roast to save as a reference, and none with nothing recorded', () => {
		stubFetch();
		render(ProfileStudio, { roasts, enabled: true });

		const select = screen.getByRole('heading', { name: 'Save a historical roast' })
			.parentElement as HTMLElement;
		const options = within(select)
			.getAllByRole('option')
			.map((option) => option.textContent ?? '');
		expect(options).toHaveLength(3);
		expect(options[1]).toContain('Roast #4529');
		expect(options[2]).toContain('Colombia Huila');
	});

	it('does not offer comparison to an account without Mallard Studio', () => {
		stubFetch();
		render(ProfileStudio, { roasts, enabled: false });

		expect(screen.queryByRole('link', { name: 'Compare roasts' })).toBeNull();
		expect(screen.getByRole('link', { name: 'Unlock Mallard Studio' })).toBeInTheDocument();
	});
});
