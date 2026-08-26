import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawPublished from '../../../../static/benchmarks/coffeebench-public-export-v5.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawPublished);

describe('CoffeeBench V1 report', () => {
	it('leads with the thesis, legitimate conclusion, and publication boundary', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', {
				name: 'Retrieval changes the answer more than the search harness.'
			})
		).toBeVisible();
		expect(screen.getByText('Published benchmark · complete agent jury')).toBeVisible();
		expect(
			screen.getByText('Published V1 evidence, with an explicit calibration gap.')
		).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Thesis' })).toHaveAttribute('href', '#overview');
		expect(screen.getByRole('link', { name: 'Pairwise data' })).toHaveAttribute(
			'href',
			'#pairwise'
		);
		expect(
			screen.getByRole('heading', {
				name: 'One decisive result, two useful signals, and one unresolved contest.'
			})
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Retrieval beats Raw.' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'No search harness wins clearly.' })).toBeVisible();
		expect(screen.getAllByText('1,200').length).toBeGreaterThan(0);
		expect(screen.getAllByText('1,800').length).toBeGreaterThan(0);
	});

	it('publishes all matchup rows, raw counts, and jury-family splits', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'The complete pairwise evidence, not just the ranking.' })
		).toBeVisible();
		expect(screen.getAllByText('300 ballots per matchup')).toHaveLength(1);
		expect(screen.getAllByText('180 ballots per matchup')).toHaveLength(1);
		expect(screen.getAllByText('120 ballots per matchup')).toHaveLength(1);
		expect(screen.getAllByText(/Pi Search vs Raw/)).toHaveLength(3);
		expect(screen.getAllByText(/Purveyors Search vs Raw/).length).toBeGreaterThanOrEqual(3);
		expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
	});

	it('renders quality, rubric, and operations independently', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Three independent tracks, no composite score.' })
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Pairwise quality' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Absolute rubric' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Operational reliability' })).toBeVisible();
		expect(screen.getByText('Overall independent-track CoffeeBench result')).toBeInTheDocument();
		expect(screen.getAllByText('Purveyors Search').length).toBeGreaterThan(0);
		expect(screen.getAllByText('#1').length).toBeGreaterThan(0);
		expect(screen.getAllByText('0.582 · 0.547–0.619').length).toBeGreaterThan(0);
		expect(
			screen.getByText(/Costs are unavailable for the three harnessed treatments/i)
		).toBeVisible();
		expect(
			screen.getByRole('heading', {
				name: 'Historical-control and live-web results stay visible.'
			})
		).toBeVisible();
	});

	it('publishes jury, harness, provenance, and byte-identical artifact access', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'What each subject was allowed to be.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Three judge families; calibration not run.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Public identities, without sealed content.' })
		).toBeVisible();
		expect(screen.getByText('Result content SHA-256')).toBeVisible();
		expect(screen.getByText(benchmark.identities.result_content_sha256)).toBeVisible();
		const link = screen.getByRole('link', { name: 'Download sanitized JSON' });
		expect(link).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
	});
});
