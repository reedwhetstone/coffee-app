import { render, screen, within } from '@testing-library/svelte';
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
				name: 'Harnessed systems beat Raw. Purveyors-specific lift did not emerge.'
			})
		).toBeVisible();
		expect(screen.getByText('Published benchmark · complete agent jury')).toBeVisible();
		expect(
			screen.getByText('Published V1 evidence, with an explicit calibration gap.')
		).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Thesis audit' })).toHaveAttribute('href', '#overview');
		expect(screen.getByRole('link', { name: 'Pairwise data' })).toHaveAttribute(
			'href',
			'#pairwise'
		);
		expect(screen.getByRole('link', { name: 'Treatments' })).toHaveAttribute('href', '#harnesses');
		expect(
			screen.getByRole('heading', {
				name: 'What V1 tested, including where our thesis failed.'
			})
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'A harnessed system beats Raw.' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Purveyors beats generic search.' })).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Parchment adds incremental quality.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'The failure modes matter more than the rank order.' })
		).toBeVisible();
		expect(screen.getByText(/provides no Parchment lift/i)).toBeVisible();
		expect(
			screen.getByRole('heading', {
				name: 'Always-on Parchment exposure created irrelevant work.'
			})
		).toBeVisible();
		expect(screen.getByText(/22 of 100 Parchment trials/i)).toBeVisible();
		expect(screen.getByText(/making 28 calls/i)).toBeVisible();
		expect(
			screen.getByText(/204,401 input tokens versus 35 calls and 125,439 tokens/i)
		).toBeVisible();
		expect(screen.getByText(/Four final answers carried an empty catalog result/i)).toBeVisible();
		expect(screen.getByText(/post hoc/i)).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Design implications for Parchment and Cherry.' })
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Gate specialized tools by intent' })).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Isolate the Cherry model contribution' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Make Cherry output progressively useful' })
		).toBeVisible();
		expect(screen.queryByRole('heading', { name: 'Retrieval beats Raw.' })).not.toBeInTheDocument();
		expect(screen.getByText(/no same-harness search-off arm/i)).toBeVisible();
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
			screen.getByRole('heading', {
				name: 'Exactly what changed between the four treatments.'
			})
		).toBeVisible();
		expect(screen.getByText(/does not name a different search engine/i)).toBeVisible();
		const treatmentTable = screen.getByRole('table', {
			name: /Agent runtime, system prompt, tool access, and step budget/i
		});
		expect(
			within(treatmentTable).getByRole('rowheader', { name: 'Purveyors Search' })
		).toBeVisible();
		expect(
			within(treatmentTable).getByRole('rowheader', { name: 'Purveyors + Parchment + Search' })
		).toBeVisible();
		expect(screen.getAllByText('Shared Brave search + page fetch')).toHaveLength(2);
		expect(screen.getByRole('heading', { name: 'Runtime and prompt both change.' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'One additional tool changes.' })).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'A frozen catalog, not live API access.' })
		).toBeVisible();
		expect(screen.getByText(/12 historical-control cases/i)).toBeVisible();
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
