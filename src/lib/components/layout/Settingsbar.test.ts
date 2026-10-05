import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settingsbar from './Settingsbar.svelte';

type SettingsbarStoreValue = {
	sortField: string;
	sortDirection: string;
	showWholesale: boolean;
	filters: Record<string, unknown>;
	uniqueValues: Record<string, unknown>;
};

const { afterNavigate, pageState, storeState, filterStore } = vi.hoisted(() => {
	const storeState = {
		value: {
			sortField: 'stocked_date',
			sortDirection: 'desc',
			showWholesale: false,
			filters: {},
			uniqueValues: {}
		} as SettingsbarStoreValue,
		set(nextValue: SettingsbarStoreValue) {
			this.value = nextValue;
		},
		subscribe(run: (value: SettingsbarStoreValue) => void) {
			run(this.value);
			return () => {};
		}
	};

	return {
		afterNavigate: vi.fn(),
		pageState: {
			url: new URL('http://localhost/beans')
		},
		storeState,
		filterStore: {
			subscribe: storeState.subscribe.bind(storeState),
			getFilterableColumns: vi.fn(() => ['name', 'source', 'score_value', 'stocked']),
			setFilter: vi.fn(),
			setSortField: vi.fn(),
			setSortDirection: vi.fn(),
			setShowWholesale: vi.fn(),
			clearFilters: vi.fn()
		}
	};
});

vi.mock('$app/state', () => ({
	page: pageState
}));

vi.mock('$app/navigation', () => ({
	afterNavigate
}));

vi.mock('$lib/stores/filterStore', () => ({
	filterStore
}));

describe('Settingsbar', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/beans');
		filterStore.getFilterableColumns.mockClear();
		filterStore.setFilter.mockClear();
		filterStore.setSortField.mockClear();
		storeState.set({
			sortField: '',
			sortDirection: '',
			showWholesale: false,
			filters: {},
			uniqueValues: { sources: ['sweet_marias'] }
		});
	});

	it("offers the current list's own columns for sorting and filtering", async () => {
		render(Settingsbar, { onClose: vi.fn() });

		expect(filterStore.getFilterableColumns).toHaveBeenCalledWith('/beans');
		expect(
			within(screen.getByLabelText('Sort by'))
				.getAllByRole('option')
				.map((option) => option.textContent?.trim())
		).toEqual(['None', 'Name', 'Source', 'Score Value', 'Stocked']);
		expect(screen.getByLabelText('Maximum Score Value')).toBeInTheDocument();

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'gesha' } });
		expect(filterStore.setFilter).toHaveBeenCalledWith('name', 'gesha');

		await fireEvent.change(screen.getByLabelText('Stocked'), { target: { value: 'FALSE' } });
		expect(filterStore.setFilter).toHaveBeenCalledWith('stocked', 'FALSE');
	});

	it('carries none of the catalog-only controls, which live in the catalog filter panel', () => {
		render(Settingsbar, { onClose: vi.fn() });

		expect(screen.queryByText('Stocked window')).not.toBeInTheDocument();
		expect(screen.queryByText(/Suppliers Only/i)).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Elevation (MASL)')).not.toBeInTheDocument();
	});
});
