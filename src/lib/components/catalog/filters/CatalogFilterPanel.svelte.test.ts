import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogFilterPanel from './CatalogFilterPanel.svelte';

const { filterState } = vi.hoisted(() => {
	type Filters = Record<string, unknown>;
	let facetCounts: Record<string, { value: string; count: number }[]> = {};
	const createState = (filters: Filters) => ({
		filters,
		facetCounts,
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
			setFacetCounts: (next: typeof facetCounts) => {
				facetCounts = next;
				setFilters(current.filters);
			},
			current: () => current,
			setFilter: (key: string, value: unknown) => {
				const { [key]: _removed, ...others } = current.filters;
				setFilters(value === '' ? others : { ...others, [key]: value });
			},
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
		filterState.setFacetCounts({});
		filterState.setFilters({});
	});

	const renderPanel = () =>
		render(CatalogFilterPanel, {
			access: memberAccess,
			resultCount: 12,
			activeFilterCount: 0,
			onClose: () => {}
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

	it('does not apply a screen size the catalog would ignore', async () => {
		renderPanel();
		const lowest = screen.getByLabelText('Lowest screen size') as HTMLInputElement;

		for (const typed of ['7', '15.5', '21']) {
			await fireEvent.change(lowest, { target: { value: typed } });
			expect(filterState.current().filters).toEqual({});
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Screen size is a whole number from 8 to 20.'
			);
		}

		await fireEvent.change(lowest, { target: { value: '16' } });
		expect(filterState.current().filters).toEqual({ screen_size: { min: '16', max: '' } });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('does not apply a moisture limit outside 0 to 20, and keeps the limit already applied', async () => {
		filterState.setFilters({ moisture_max: 11 });
		renderPanel();
		const moisture = screen.getByLabelText('Moisture at most (%)') as HTMLInputElement;

		for (const typed of ['25', '0', '-3']) {
			await fireEvent.change(moisture, { target: { value: typed } });
			expect(filterState.current().filters).toEqual({ moisture_max: 11 });
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Moisture is a percentage above 0, up to 20.'
			);
		}

		await fireEvent.change(moisture, { target: { value: '12.5' } });
		expect(filterState.current().filters).toEqual({ moisture_max: 12.5 });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();

		await fireEvent.change(moisture, { target: { value: '30' } });
		expect(screen.getByRole('alert')).toBeInTheDocument();
		// The limit was cleared somewhere else, such as its chip or "Clear all".
		filterState.setFilters({});
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect(moisture.value).toBe('');
	});

	it('says no supplier states a protocol only when the protocol counts arrived', async () => {
		renderPanel();
		const section = document.querySelector('[data-catalog-grading]') as HTMLElement;

		// The counts could not be read: nothing is claimed about the coffees.
		expect(section).toHaveTextContent('Scoring protocols are unavailable right now.');
		expect(section).not.toHaveTextContent('No supplier in these results');

		filterState.setFacetCounts({
			score_protocols: [{ value: 'supplier_unspecified', count: 443 }]
		});
		await waitFor(() => expect(section).toHaveTextContent('No supplier in these results'));
		expect(section).not.toHaveTextContent('Scoring protocols are unavailable right now.');

		filterState.setFacetCounts({ score_protocols: [] });
		await waitFor(() => expect(section).toHaveTextContent('No supplier in these results'));
	});
});
