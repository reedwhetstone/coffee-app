import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawFixture from '../../../../static/benchmarks/coffeebench-public-export-v2.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawFixture);

describe('CoffeeBench v0 report', () => {
	it('keeps overview, comparison, evidence, methodology, and limitations reachable', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Can a model make a defensible coffee decision?' })
		).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '#overview');
		expect(screen.getByRole('link', { name: 'Methodology' })).toHaveAttribute(
			'href',
			'#methodology'
		);
		expect(screen.getByRole('link', { name: 'Limitations' })).toHaveAttribute(
			'href',
			'#limitations'
		);
		expect(screen.getByText('Contract preview, not a benchmark result')).toBeVisible();
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
			screen.getByRole('img', {
				name: /DeepSeek V4 Raw: quality .*canonical total tokens per attempted task/i
			})
		).toBeVisible();
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
		for (const link of screen.getAllByRole('link', { name: 'Download sanitized JSON' })) {
			expect(link).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
		}
	});
});
