import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogFilterPanel from './CatalogFilterPanel.svelte';

const { filterState } = vi.hoisted(() => {
	type Filters = Record<string, unknown>;
	const createState = (filters: Filters) => ({
		filters,
		facetCounts: {},
		uniqueValues: {},
		vocabulary: null,
		unstandardizedVarietyCount: null,
		optionsStatus: 'ready',
		showWholesale: true,
		wholesaleOnly: false
	});
	let current = createState({});
	const subscribers = new Set<(value: typeof current) => void>();
	const setFilters = (filters: Filters) => {
		current = createState(filters);
		for (const callback of subscribers) callback(current);
	};

	return {
		filterState: {
			subscribe(callback: (value: typeof current) => void) {
				subscribers.add(callback);
				callback(current);
				return () => subscribers.delete(callback);
			},
			setFilters,
			setFilter: (key: string, value: unknown) => setFilters({ ...current.filters, [key]: value }),
			clearFilters: () => setFilters({}),
			setSupplierScope: () => {}
		}
	};
});

vi.mock('$lib/stores/filterStore', () => ({ filterStore: filterState }));

const memberAccess = {
	canUseProcessFacets: true,
	canUseAdvancedFilters: true,
	canUsePriceRanges: true,
	canUsePriceScoreRanges: true,
	canUseAdvancedSorts: true,
	canUseWholesaleOnly: true
};

describe('CatalogFilterPanel', () => {
	beforeEach(() => {
		filterState.setFilters({});
	});

	it('clears an elevation range that was edited into inverted bounds', async () => {
		filterState.setFilters({ elevation_masl: { min: '1200', max: '1900' } });
		render(CatalogFilterPanel, {
			access: memberAccess,
			resultCount: 12,
			activeFilterCount: 1,
			onClose: () => {}
		});
		const lowest = screen.getByLabelText('Lowest elevation') as HTMLInputElement;
		const highest = screen.getByLabelText('Highest elevation') as HTMLInputElement;

		await fireEvent.change(lowest, { target: { value: '2500' } });
		expect(screen.getByRole('alert')).toHaveTextContent(
			'The lowest elevation cannot be above the highest.'
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(lowest.value).toBe('');
		expect(highest.value).toBe('');
	});
});
