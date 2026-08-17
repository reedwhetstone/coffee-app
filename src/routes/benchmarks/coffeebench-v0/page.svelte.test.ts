import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawFixture from '../../../../static/benchmarks/coffeebench-public-export-v2.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawFixture);

describe('CoffeeBench v0 report', () => {
	it('leads with purpose and unmistakable fixture status before the example result surface', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Can a model make a defensible coffee decision?' })
		).toBeVisible();
		expect(screen.getByText('Example data · full run not started')).toBeVisible();
		expect(screen.getByText('Example data only. No benchmark result exists yet.')).toBeVisible();
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
				name: 'The full benchmark panel has not run. There are no performance findings yet.'
			})
		).toBeVisible();
		expect(screen.getByText('None yet')).toBeVisible();
		expect(screen.getByText('Planned subject trials')).toBeVisible();
		expect(
			screen.getByText(/Every result value below is deterministic example data/)
		).toBeVisible();
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
		expect(screen.getAllByText(/Provenance provider_derived/).length).toBeGreaterThan(0);
		expect(screen.getAllByText('Token totals · / task').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Cost totals · / task').length).toBeGreaterThan(0);
	});

	it('renders the required quality forest and operational tradeoff views', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(screen.getByRole('heading', { name: 'Quality forest' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Quality vs. tokens' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Quality vs. cost' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Quality vs. latency' })).toBeVisible();
		expect(
			screen.getByRole('button', {
				name: /DeepSeek V4 Raw: quality .*canonical total tokens per attempted task/i
			})
		).toBeVisible();
		expect(screen.getAllByText('How to read this chart')).toHaveLength(4);
		expect(
			screen.getAllByRole('img', { name: /Bradley-Terry quality score scale from/i })
		).toHaveLength(4);
		expect(
			screen.getByRole('img', { name: /Canonical tokens.*scale from 1,284 to 1,749/i })
		).toBeVisible();
		expect(
			screen.getByRole('img', { name: /Normalized USD.*scale from \$0\.0050 to \$0\.0080/i })
		).toBeVisible();
		expect(
			screen.getByRole('img', {
				name: /p50 end-to-end latency.*scale from 1,050 ms to 1,500 ms/i
			})
		).toBeVisible();
		expect(screen.getByText(/a relative measure rather than percent correct/i)).toBeVisible();
		expect(screen.getAllByText('Illustrative fixture').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Example values').length).toBeGreaterThan(0);
	});

	it('publishes harness, provenance, and byte-identical artifact download access', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'What each subject was allowed to be.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Public identities, without sealed content.' })
		).toBeVisible();
		expect(screen.getByText('Majority decisions')).toBeVisible();
		expect(screen.getByText('Unresolved majorities')).toBeVisible();
		expect(screen.getByText('Result content SHA-256')).toBeVisible();
		expect(screen.getByText(benchmark.identities.result_content_sha256)).toBeVisible();
		const links = screen.getAllByRole('link', { name: 'Download sanitized JSON' });
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
	});
});
