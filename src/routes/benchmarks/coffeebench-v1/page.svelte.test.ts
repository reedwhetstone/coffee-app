import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import rawPublished from '../../../../static/benchmarks/coffeebench-public-export-v5.json';
import { COFFEEBENCH_RESULT_PATH, parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';
import CoffeeBenchPage from './+page.svelte';

const benchmark = parseCoffeeBenchPublicExport(rawPublished);

describe('CoffeeBench V1 report', () => {
	it('leads with a reader-facing abstract and the three core findings', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'The harness mattered more than the specialist tools.' })
		).toBeVisible();
		expect(screen.getByText('CoffeeBench V1 · Research report')).toBeVisible();
		expect(screen.getByRole('navigation', { name: 'CoffeeBench report sections' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Abstract' })).toHaveAttribute('href', '#abstract');
		expect(screen.getByRole('link', { name: 'Results' })).toHaveAttribute('href', '#results');
		expect(screen.getByRole('link', { name: 'Judge votes' })).toHaveAttribute('href', '#jury');
		expect(
			screen.getByText(/CoffeeBench V1 asked how much the system around a fixed model changes/i)
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Three findings changed what we want to test next.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'A capable harness beat a raw request.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Purveyors led directionally, not decisively.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'An irrelevant tool became a distraction.' })
		).toBeVisible();
		expect(screen.queryByText('Missing or unresolved evidence')).not.toBeInTheDocument();
		expect(screen.getAllByText('1,800').length).toBeGreaterThan(0);
	});

	it('turns the result and treatment distinctions into visible figures', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(screen.getByRole('heading', { name: 'No harness separated cleanly.' })).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Current-information cases widened the gap.' })
		).toBeVisible();
		expect(
			screen.getByRole('heading', {
				name: 'Raw used less time and fewer reported input/output tokens, not better answers.'
			})
		).toBeVisible();
		expect(
			screen.getByText(
				'Reported input/output tokens only; reasoning-token usage was unavailable for every treatment. Successful-task median latency and jury-marked unacceptable answers are also shown. Bar lengths are scaled within each metric.'
			)
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'One model, four systems around it.' })
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Raw' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Pi Search' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Purveyors Search' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Purveyors + Parchment + Search' })).toBeVisible();
		expect(
			screen.getByText(
				/Purveyors versus Parchment changes only whether the catalog tool is exposed/i
			)
		).toBeVisible();
	});

	it('shows every judge-family breakdown and switches cohorts', async () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Every matchup, broken down by model family.' })
		).toBeVisible();
		expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(6);
		expect(screen.getAllByText('Google').length).toBeGreaterThanOrEqual(6);
		expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(6);
		expect(screen.getAllByText(/Pi Search vs Raw/).length).toBeGreaterThan(0);

		await fireEvent.click(screen.getByRole('button', { name: 'Historical control' }));
		expect(screen.getByRole('button', { name: 'Historical control' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(6);

		await fireEvent.click(screen.getByRole('button', { name: 'Live web' }));
		expect(screen.getByRole('button', { name: 'Live web' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(6);
	});

	it('explains the cost boundary and preserves full data access', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', { name: 'Why total cost is only available for Raw' })
		).toBeVisible();
		expect(screen.getByText(/Model-call cost was captured for every treatment/i)).toBeVisible();
		expect(screen.getByText(/requires a complete model-plus-tool total/i)).toBeVisible();
		expect(
			screen.getByText(/Brave search and Parchment tool calls did not have pinned marginal prices/i)
		).toBeVisible();
		expect(
			screen.getByText(/one model on 20 cases with an agent jury and no human calibration/i)
		).toBeVisible();
		expect(screen.getByText('Full aggregate metrics')).toBeVisible();
		expect(screen.getByText('Result identity and provenance')).toBeVisible();
		const link = screen.getByRole('link', { name: /Download the aggregate result JSON/i });
		expect(link).toHaveAttribute('href', COFFEEBENCH_RESULT_PATH);
		expect(link).toHaveAttribute('download', '');
		expect(
			screen.getByRole('columnheader', { name: 'Reported input/output tokens / task' })
		).toBeInTheDocument();
	});

	it('states the research program enabled by V1', () => {
		render(CoffeeBenchPage, { data: { benchmark } as never });

		expect(
			screen.getByRole('heading', {
				name: 'What we think this means, and what we will do with it.'
			})
		).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Route specialized tools by intent.' })
		).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Isolate the Cherry model.' })).toBeVisible();
		expect(
			screen.getByRole('heading', { name: 'Design output for progressive disclosure.' })
		).toBeVisible();
	});
});
