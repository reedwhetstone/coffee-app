import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawPreview from '../../../../static/benchmarks/coffeebench-public-export-v4.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawPreview);

describe('CoffeeBench v0 report', () => {
	it('leads with the uncalibrated three-family agent-jury status and limits', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Can a model make a defensible coffee decision?' })
		).toBeVisible();
		expect(screen.getByText('Uncalibrated three-family agent-jury preview')).toBeVisible();
		expect(screen.getByText('Agent-jury evidence, not human ground truth.')).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Purpose' })).toHaveAttribute('href', '#overview');
		expect(screen.getByRole('link', { name: 'Independent tracks' })).toHaveAttribute(
			'href',
			'#tracks'
		);
		expect(
			screen.getByRole('heading', {
				name: 'Purveyors Search ranked first in agent-jury quality, with important caveats.'
			})
		).toBeVisible();
		expect(screen.getByText(/top three intervals overlap/i)).toBeVisible();
		expect(screen.getAllByText('1,200').length).toBeGreaterThan(0);
		expect(screen.getAllByText('1,800').length).toBeGreaterThan(0);
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
		expect(screen.getAllByText('Openai').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
		expect(
			screen.getByRole('heading', { name: 'Public identities, without sealed content.' })
		).toBeVisible();
		expect(screen.getByText('Result content SHA-256')).toBeVisible();
		expect(screen.getByText(benchmark.identities.result_content_sha256)).toBeVisible();
		const link = screen.getByRole('link', { name: 'Download sanitized JSON' });
		expect(link).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
	});
});
