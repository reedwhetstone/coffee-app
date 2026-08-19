import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawPreview from '../../../../static/benchmarks/coffeebench-public-export-v3.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawPreview);

describe('CoffeeBench v0 report', () => {
	it('leads with the measured preview status and unavailable quality disclosure', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Can a model make a defensible coffee decision?' })
		).toBeVisible();
		expect(screen.getByText('Uncalibrated single-judge preview')).toBeVisible();
		expect(screen.getByText('Measured preview, not a quality leaderboard.')).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Purpose' })).toHaveAttribute('href', '#overview');
		expect(screen.getByRole('link', { name: 'Findings' })).toHaveAttribute('href', '#findings');
		expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute(
			'href',
			'#methodology'
		);
		expect(screen.getByRole('link', { name: 'Limitations' })).toHaveAttribute(
			'href',
			'#limitations'
		);
		expect(
			screen.getByRole('heading', {
				name: 'This run measured reliability and operations, but not a defensible quality ranking.'
			})
		).toBeVisible();
		expect(screen.getAllByText('15%').length).toBeGreaterThan(0);
		expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
		expect(
			screen.getByText('0 of 600 pairwise ballots supplied an eligible model-backed preference.')
		).toBeVisible();
		expect(screen.getByText('Subject trials')).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Does the system make the model better?' })
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Can the answer be trusted?' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Is the lift worth operating?' })).toBeVisible();
	});

	it('renders the matched comparison track in mobile cards and desktop tables', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(screen.getAllByText('System comparison track').length).toBeGreaterThan(0);
		expect(
			screen.getAllByLabelText('System comparison track subject details').length
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText('System comparison track complete precomputed result table').length
		).toBeGreaterThan(0);
		expect(screen.getAllByText('model track').length).toBeGreaterThan(0);
		expect(screen.getAllByText('system track').length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Token provenance:/).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/Provenance exact/).length).toBeGreaterThan(0);
		expect(screen.getAllByText('Token totals · / task').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Cost totals · / task').length).toBeGreaterThan(0);
	});

	it('does not fabricate empty quality and operational-tradeoff charts', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Bradley–Terry quality views unavailable' })
		).toBeVisible();
		expect(screen.queryByRole('heading', { name: 'Quality forest' })).not.toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: 'Quality vs. tokens' })).not.toBeInTheDocument();
		expect(screen.getAllByText('No rank').length).toBeGreaterThan(0);
	});

	it('publishes harness, provenance, and byte-identical artifact download access', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'What each subject was allowed to be.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Public identities, without sealed content.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'One preview judge family; human calibration not run.' })
		).toBeVisible();
		expect(screen.getByText('Not run')).toBeVisible();
		expect(screen.getByText('Result content SHA-256')).toBeVisible();
		expect(screen.getByText(benchmark.identities.result_content_sha256)).toBeVisible();
		const links = screen.getAllByRole('link', { name: 'Download sanitized JSON' });
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
	});
});
