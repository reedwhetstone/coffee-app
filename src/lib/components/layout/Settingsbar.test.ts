import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settingsbar from './Settingsbar.svelte';

type SettingsbarStoreValue = {
	sortField: string;
	sortDirection: string;
	showWholesale: boolean;
	filters: {
		stocked_date: string;
		stocked_days: string;
	};
	uniqueValues: Record<string, unknown>;
};

const { afterNavigate, pageState, storeState, filterStore } = vi.hoisted(() => {
	const storeState = {
		value: {
			sortField: 'stocked_date',
			sortDirection: 'desc',
			showWholesale: false,
			filters: {
				stocked_date: '',
				stocked_days: ''
			},
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
			url: new URL('http://localhost/catalog')
		},
		storeState,
		filterStore: {
			subscribe: storeState.subscribe.bind(storeState),
			getFilterableColumns: vi.fn(() => ['name', 'stocked_date']),
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

describe('Settingsbar stocked filters', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/catalog');
		filterStore.getFilterableColumns.mockClear();
		filterStore.setFilter.mockClear();
		filterStore.setSortField.mockClear();
		filterStore.setSortDirection.mockClear();
		filterStore.setShowWholesale.mockClear();
		storeState.set({
			sortField: 'stocked_date',
			sortDirection: 'desc',
			showWholesale: false,
			filters: {
				stocked_date: '',
				stocked_days: ''
			},
			uniqueValues: {}
		});
	});

	it('separates absolute stocked_date input from explicit stocked_days window control', async () => {
		render(Settingsbar, {
			data: {},
			onClose: vi.fn()
		});

		const stockedDateInput = screen.getByLabelText('Stocked Date');
		expect(stockedDateInput).toHaveAttribute('type', 'date');
		expect(screen.getByText('Stocked Window')).toBeInTheDocument();
		expect(screen.getByText(/Show coffees stocked on or after this date/i)).toBeInTheDocument();
		expect(
			screen.getByText(/Relative filter for coffees stocked within the last N days/i)
		).toBeInTheDocument();

		await fireEvent.change(stockedDateInput, { target: { value: '2026-03-01' } });
		await fireEvent.change(screen.getByLabelText('Stocked Window'), {
			target: { value: '30' }
		});

		expect(filterStore.setFilter).toHaveBeenNthCalledWith(1, 'stocked_date', '2026-03-01');
		expect(filterStore.setFilter).toHaveBeenNthCalledWith(2, 'stocked_days', '30');
	});
});
