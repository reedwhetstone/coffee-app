import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import EvalsPage from './+page.svelte';

describe('Cherry Evals index', () => {
	it('uses the Cherry Evals family and preserves the PV-Microlot experiment name', () => {
		render(EvalsPage, {
			data: { benchmark: { status: 'published', caseCount: 20, subjectTrialCount: 400 } } as never
		});

		expect(
			screen.getByRole('heading', {
				name: 'PV-Microlot: Agentic Coffee Specialist Benchmark'
			})
		).toBeVisible();
		expect(screen.getByText('Published V1 findings')).toBeVisible();
		expect(screen.getAllByText('Cherry Evals')).toHaveLength(2);
		expect(
			screen.getByText(
				'Domain benchmarks for green coffee, sensory analysis, sourcing, and roasting.'
			)
		).toBeVisible();
		expect(screen.getByRole('link', { name: /Explore PV-Microlot/i })).toHaveAttribute(
			'href',
			'/evals/coffeebench-v1'
		);
		expect(screen.queryByText(/CoffeeBench/i)).not.toBeInTheDocument();
	});
});
