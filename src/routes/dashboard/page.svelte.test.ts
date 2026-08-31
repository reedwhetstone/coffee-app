import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import DashboardPage from './+page.svelte';
import type { PageData } from './$types';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto }));

function dashboardData(ppiAccess: boolean): PageData {
	return {
		auth: {
			isSignedIn: true,
			user: { id: 'viewer-1', email: 'viewer@example.com' },
			role: 'viewer',
			ppiAccess
		},
		recentArrivals: [],
		trackedLots: [],
		trackedCatalog: [],
		activeBriefs: []
	} as unknown as PageData;
}

describe('/dashboard sourcing brief entitlement copy', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows the canonical empty brief workflow to a PPI-only viewer', () => {
		render(DashboardPage, { data: dashboardData(true) });

		expect(screen.getByLabelText('Your sourcing workspace')).toBeInTheDocument();
		expect(screen.getByText(/No active sourcing briefs/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Parchment API docs' })).toHaveAttribute(
			'href',
			'https://api.purveyors.io/docs'
		);
		expect(
			screen.queryByText(/Sourcing briefs are a Mallard Studio workflow/)
		).not.toBeInTheDocument();
	});

	it('does not expose the sourcing workspace to a non-entitled viewer', () => {
		render(DashboardPage, { data: dashboardData(false) });

		expect(screen.queryByLabelText('Your sourcing workspace')).not.toBeInTheDocument();
	});
});
