import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ProfileGeneration from './ProfileGeneration.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const candidate = {
	roastId: 4531,
	roastRevision: 'revision-4531',
	label: 'Ethiopia · Oct 1',
	batchName: 'Wednesday roast',
	coffeeName: 'Ethiopia',
	roastDate: '2026-10-01',
	reference: {
		profileId: 'bbbbbbbb-0000-4000-8000-000000004531',
		revisionId: 'bbbbbbbb-1111-4000-8000-000000004531',
		saved: false
	}
};
const chart = {
	temperatureUnit: 'F',
	chargeTimeMilliseconds: 30000,
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: 'F',
			deviceIndex: 0,
			channel: 2,
			points: [
				{ timeMilliseconds: 30000, value: 100 },
				{ timeMilliseconds: 330000, value: 200 }
			]
		}
	],
	events: []
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function mockFetch(options: { failGenerate?: boolean; noFile?: boolean } = {}) {
	let generateFailures = options.failGenerate ? 1 : 0;
	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		if (url === '/api/reference-profiles') return response({ data: [] });
		if (url.endsWith('/candidates'))
			return response({
				data: { roasts: [candidate], eligibleCount: 1, totalRoastCount: 7, ineligibleRoastCount: 6 }
			});
		if (url.endsWith('/chart/4531')) return response({ data: { chart } });
		if (url.endsWith('/from-roast/preview')) {
			if (options.noFile)
				return response(
					{ code: 'roast_artisan_source_unavailable', reason: 'artisan_file_not_retained' },
					400
				);
			const input = JSON.parse(String(init?.body));
			return response({
				data: {
					parentRevisionId: candidate.reference.revisionId,
					title: input.title,
					changes: input.changes,
					chart,
					exportEligible: true
				}
			});
		}
		if (url === '/api/reference-profiles/from-roast')
			return response(
				{
					data: {
						id: candidate.reference.profileId,
						currentRevisionId: candidate.reference.revisionId
					}
				},
				201
			);
		if (url.endsWith('/generated')) {
			if (generateFailures--) return response({ error: 'Saving the plan failed' }, 503);
			return response(
				{
					data: {
						id: 'aaaaaaaa-0000-4000-8000-000000000009',
						currentRevisionId: 'aaaaaaaa-1111-4000-8000-000000000009',
						title: 'Next-batch plan'
					}
				},
				201
			);
		}
		throw new Error(`Unexpected ${url}`);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

describe('plan editor', () => {
	it('lists candidates newest first and counts roasts that cannot be used', async () => {
		mockFetch();
		render(ProfileGeneration, {
			link: { kind: 'from', side: { type: 'roast', id: 4531 } },
			ownerId: 'owner'
		});
		expect(
			await screen.findByText(/6 older roasts were imported before Artisan files were kept/)
		).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Ethiopia · Oct 1' })).toBeInTheDocument();
	});

	it('previews read-only, saves a roast reference once, and reuses it after generation fails', async () => {
		const fetchMock = mockFetch({ failGenerate: true });
		render(ProfileGeneration, {
			link: { kind: 'from', side: { type: 'roast', id: 4531 } },
			ownerId: 'owner'
		});
		await screen.findByRole('option', { name: 'Ethiopia · Oct 1' });
		await fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
		await screen.findByText(/Plan preview · not saved yet/);
		const previewCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/from-roast/preview'));
		expect(previewCall).toBeDefined();
		const previewInput = JSON.parse(String(previewCall?.[1]?.body));
		expect(previewInput).toMatchObject({ roastId: 4531, roastRevision: 'revision-4531' });
		expect(previewInput.changes.temperatureAdjustments[0]).toMatchObject({
			startMilliseconds: 30000,
			endMilliseconds: 330000,
			delta: 5
		});
		expect(fetchMock.mock.calls.some(([url]) => url === '/api/reference-profiles/from-roast')).toBe(
			false
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Saving the plan failed');
		await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));
		await screen.findByRole('link', { name: 'Download for Artisan (.alog)' });
		expect(
			fetchMock.mock.calls.filter(([url]) => url === '/api/reference-profiles/from-roast')
		).toHaveLength(1);
		expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/generated'))).toHaveLength(2);
	});

	it('shows the no-file reason as a next step', async () => {
		mockFetch({ noFile: true });
		render(ProfileGeneration, {
			link: { kind: 'from', side: { type: 'roast', id: 4531 } },
			ownerId: 'owner'
		});
		await screen.findByRole('option', { name: 'Ethiopia · Oct 1' });
		await fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent("Import the roast's .alog again")
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});
});
