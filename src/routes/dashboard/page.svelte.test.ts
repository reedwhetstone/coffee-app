import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import DashboardPage from './+page.svelte';
import type { PageData } from './$types';

function createData(
	role: 'viewer' | 'member' | 'admin',
	ppiAccess: boolean,
	options: { emptyWorkspace?: boolean } = {}
): PageData {
	return {
		auth: {
			isSignedIn: true,
			user: { id: 'user-1', email: 'coffee@example.com' },
			role,
			ppiAccess
		},
		trackedLots: options.emptyWorkspace
			? []
			: [
					{
						catalogId: 7,
						name: 'Tracked Ethiopia',
						source: 'Importer One',
						country: 'Ethiopia',
						processing: 'Washed',
						stocked: true,
						unstockedDate: null,
						currentPrice: 6.25,
						priceDelta: -0.5
					},
					{
						catalogId: 8,
						name: 'Delisted Colombia',
						source: 'Importer Two',
						country: 'Colombia',
						processing: 'Natural',
						stocked: false,
						unstockedDate: '2026-08-29',
						currentPrice: null,
						priceDelta: -0.5
					}
				],
		activeBriefs: options.emptyWorkspace
			? []
			: [
					{
						id: 'brief-1',
						name: 'Washed Ethiopia brief',
						criteriaDescription: 'Ethiopia · Washed · up to $7/lb',
						catalogHref: '/catalog?country=Ethiopia&processing=Washed'
					}
				],
		recentArrivals: options.emptyWorkspace
			? []
			: [
					{
						id: 21,
						name: 'Fresh Kenya',
						source: 'Importer Three',
						country: 'Kenya',
						processing: 'Washed',
						cost_lb: null,
						price_per_lb: null,
						price_tiers: [{ min_lbs: 1, price: 7.4 }]
					}
				]
	} as unknown as PageData;
}

describe('adaptive dashboard', () => {
	it('presents Parchment Intelligence users with the Cherry Green Agent and sourcing work', () => {
		render(DashboardPage, { data: createData('viewer', true) });

		expect(screen.getByRole('heading', { name: 'Cherry Green Agent' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Open Cherry Green Agent/ })).toHaveAttribute(
			'href',
			expect.stringContaining('source=dashboard')
		);
		expect(screen.getByRole('heading', { name: 'Tracked coffees' })).toBeInTheDocument();
		expect(screen.getByText('Washed Ethiopia brief')).toBeInTheDocument();
		expect(screen.getByText('Fresh Kenya')).toBeInTheDocument();
		expect(screen.getByText('$7.40/lb')).toBeInTheDocument();
		expect(
			screen.getByRole('link', { name: /Review tracked changes with Cherry Green Agent/ })
		).toHaveAttribute('href', expect.stringContaining('source=dashboard'));
		expect(
			screen.getByRole('link', { name: /Prioritize briefs with Cherry Green Agent/ })
		).toHaveAttribute('href', expect.stringContaining('source=dashboard'));
		expect(screen.queryByRole('heading', { name: 'Plan or log a roast' })).toBeNull();
	});

	it('presents Mallard Studio users with the Cherry Roast Agent and roastery actions', () => {
		render(DashboardPage, { data: createData('member', false) });

		expect(screen.getByRole('heading', { name: 'Cherry Roast Agent' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Plan or log a roast' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Review sales and margin' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'View Parchment Intelligence' })).toBeInTheDocument();
	});

	it('connects both subscriptions and counts overlapping watchlist signals once', () => {
		render(DashboardPage, { data: createData('member', true) });

		expect(screen.getByRole('heading', { name: 'Cherry Synthesis Agent' })).toBeInTheDocument();
		expect(screen.getByText('Parchment Intelligence + Mallard Studio')).toBeInTheDocument();
		expect(screen.getAllByText('2', { selector: 'dd' })).toHaveLength(2);
		expect(screen.queryByText('Extend the system')).toBeNull();
	});

	it('keeps the viewer dashboard truthful when no Cherry AI agent is unlocked', () => {
		render(DashboardPage, { data: createData('viewer', false) });

		expect(
			screen.getByRole('heading', { name: 'Coffee-native AI for the work ahead' })
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Explore Cherry AI plans/ })).toHaveAttribute(
			'href',
			'/subscription'
		);
		expect(screen.queryByRole('heading', { name: 'Continue your work' })).toBeNull();
	});

	it('shows the canonical empty brief workflow to a PPI-only viewer', () => {
		render(DashboardPage, { data: createData('viewer', true, { emptyWorkspace: true }) });

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
		render(DashboardPage, { data: createData('viewer', false, { emptyWorkspace: true }) });

		expect(screen.queryByLabelText('Your sourcing workspace')).not.toBeInTheDocument();
	});
});
