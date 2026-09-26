import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { components } from '@purveyors/sdk';
import ProfileGeneration from './ProfileGeneration.svelte';

type Summary = components['schemas']['ReferenceProfileSummary'];
type Chart = components['schemas']['ReferenceProfileChart'];

const summary = (id: string, title: string): Summary => ({
	id,
	title,
	notes: null,
	sourceClass: 'artisan_upload',
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt: '2026-09-22T00:00:00Z',
	updatedAt: '2026-09-22T00:00:00Z'
});

const chart = (
	temperatureUnit: 'C' | 'F',
	chargeTimeMilliseconds: number | null = null
): Chart => ({
	temperatureUnit,
	chargeTimeMilliseconds,
	series: [
		{
			id: 'bt',
			name: 'BT',
			kind: 'bean_temperature',
			unit: temperatureUnit,
			deviceIndex: 0,
			channel: 2,
			points: [
				{ timeMilliseconds: 0, value: 100 },
				{ timeMilliseconds: 600_000, value: 200 }
			]
		}
	],
	events: []
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function deferred() {
	let resolve!: (value: Response) => void;
	const promise = new Promise<Response>((done) => (resolve = done));
	return { promise, resolve };
}

function previewBody(parent: Summary, body: string, source: Chart) {
	const input = JSON.parse(body);
	return {
		data: {
			parentRevisionId: parent.currentRevisionId,
			title: input.title,
			changes: input.changes,
			chart: source,
			exportEligible: true
		}
	};
}

async function choose(id: string) {
	const select = screen.getByLabelText('Parent reference');
	await fireEvent.change(select, { target: { value: id } });
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

describe('Profile Studio planned reference', () => {
	it('applies the Celsius bound on the first preview and ignores a late chart for an old parent', async () => {
		const fahrenheit = summary('f', 'Fahrenheit reference');
		const celsius = summary('c', 'Celsius reference');
		const lateFahrenheitChart = deferred();
		const fetchMock = vi.fn((url: string) =>
			url.includes('/f/')
				? lateFahrenheitChart.promise
				: Promise.resolve(json({ data: { chart: chart('C') } }))
		);
		vi.stubGlobal('fetch', fetchMock);
		render(ProfileGeneration, {
			profiles: [fahrenheit, celsius],
			ownerId: 'owner',
			onSaved: vi.fn()
		});

		await choose('f');
		await choose('c');
		await waitFor(() => expect(screen.getByLabelText(/Change \(°C/)).toHaveAttribute('max', '10'));
		lateFahrenheitChart.resolve(json({ data: { chart: chart('F') } }));
		await fireEvent.input(screen.getByLabelText(/Change \(/), { target: { value: '15' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('at most 10°C');
		expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/preview'))).toBe(false);
	});

	it('sends charge-relative inputs as logger time and locks the parent while a preview is in flight', async () => {
		const parent = summary('a', 'Charged reference');
		const source = chart('F', 30_000);
		const pendingPreview = deferred();
		const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
			url.endsWith('/preview')
				? pendingPreview.promise
				: Promise.resolve(json({ data: { chart: source } }))
		);
		vi.stubGlobal('fetch', fetchMock);
		render(ProfileGeneration, { profiles: [parent], ownerId: 'owner', onSaved: vi.fn() });

		await choose('a');
		await fireEvent.input(screen.getByLabelText('Start (minutes from roast start)'), {
			target: { value: '1' }
		});
		await fireEvent.input(screen.getByLabelText('End (minutes from roast start)'), {
			target: { value: '2' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));

		await waitFor(() => expect(screen.getByLabelText('Parent reference')).toBeDisabled());
		const previewCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/preview'));
		const body = JSON.parse(String(previewCall?.[1]?.body));
		expect(body.changes.temperatureAdjustments[0]).toMatchObject({
			startMilliseconds: 90_000,
			endMilliseconds: 150_000
		});
		pendingPreview.resolve(json(previewBody(parent, JSON.stringify(body), source)));
		expect(await screen.findByText(/from 1 to 2 minutes/)).toBeInTheDocument();
		expect(screen.getByLabelText('Parent reference')).not.toBeDisabled();
	});

	it('allows another plan from the same parent after a new preview', async () => {
		const parent = summary('a', 'Reference');
		const source = chart('F');
		const onSaved = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string, init?: RequestInit) => {
				if (url.endsWith('/chart')) return Promise.resolve(json({ data: { chart: source } }));
				if (url.endsWith('/preview'))
					return Promise.resolve(json(previewBody(parent, String(init?.body), source)));
				return Promise.resolve(
					json(
						{
							data: {
								...summary(`plan-${Math.random()}`, 'Next-batch plan'),
								sourceClass: 'generated_revision'
							}
						},
						201
					)
				);
			})
		);
		render(ProfileGeneration, { profiles: [parent], ownerId: 'owner', onSaved });

		await choose('a');
		await fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Save planned reference' }));
		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(screen.getByRole('button', { name: 'Save planned reference' })).toBeDisabled();

		await fireEvent.input(screen.getByLabelText(/Change \(/), { target: { value: '-5' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Save planned reference' })).not.toBeDisabled()
		);
	});
});
