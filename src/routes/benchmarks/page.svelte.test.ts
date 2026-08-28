import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import BenchmarksPage from './+page.svelte';

describe('Benchmark index', () => {
	it('uses the PV-Microlot brand while preserving the published V1 route', () => {
		render(BenchmarksPage, {
			data: { benchmark: { status: 'published', caseCount: 20, subjectTrialCount: 400 } } as never
		});

		expect(
			screen.getByRole('heading', {
				name: 'PV-Microlot: Agentic Coffee Specialist Benchmark'
			})
		).toBeVisible();
		expect(screen.getByText('Published V1 findings')).toBeVisible();
		expect(screen.getByRole('link', { name: /Explore PV-Microlot/i })).toHaveAttribute(
			'href',
			'/benchmarks/coffeebench-v1'
		);
		expect(screen.queryByText(/CoffeeBench/i)).not.toBeInTheDocument();
	});
});
