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
			getFilterableColumns: vi.fn(() => [
				'name',
				'type',
				'grade',
				'appearance',
				'score_value',
				'cost_lb',
				'stocked_date'
			]),
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
			data: { role: 'member' },
			onClose: vi.fn()
		});

		const stockedDateInput = screen.getByLabelText('Stocked Date');
		expect(stockedDateInput).toHaveAttribute('type', 'date');
		expect(screen.getByText('Stocked window')).toBeInTheDocument();
		expect(screen.getByText(/Show coffees stocked on or after this date/i)).toBeInTheDocument();
		expect(
			screen.getByText(/Relative filter for coffees stocked within the last N days/i)
		).toBeInTheDocument();

		await fireEvent.change(stockedDateInput, { target: { value: '2026-03-01' } });
		await fireEvent.change(screen.getByLabelText('Stocked window'), {
			target: { value: '30' }
		});

		expect(filterStore.setFilter).toHaveBeenNthCalledWith(1, 'stocked_date', '2026-03-01');
		expect(filterStore.setFilter).toHaveBeenNthCalledWith(2, 'stocked_days', '30');
	});

	it('hides filters that the free catalog API strips while keeping basic filters and sorting', () => {
		render(Settingsbar, { data: { role: 'viewer' }, onClose: vi.fn() });

		expect(screen.getByText('Home Roaster Suppliers Only')).toBeInTheDocument();
		expect(screen.getByText('Filter out wholesale quantities')).toBeInTheDocument();
		expect(screen.queryByLabelText('Score Value')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Cost Lb')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Stocked Date')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Stocked window')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Importer')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Elevation (MASL)')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Appearance')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Score Value' })).toBeInTheDocument();
		expect(screen.queryByRole('option', { name: 'Importer' })).not.toBeInTheDocument();
		expect(screen.queryByRole('option', { name: 'Elevation (MASL)' })).not.toBeInTheDocument();
		expect(screen.queryByRole('option', { name: 'Appearance' })).not.toBeInTheDocument();
	});

	it('applies the same free catalog controls to the root catalog alias', () => {
		pageState.url = new URL('http://localhost/');
		render(Settingsbar, { data: { role: 'viewer' }, onClose: vi.fn() });

		expect(screen.getByText('Home Roaster Suppliers Only')).toBeInTheDocument();
		expect(screen.queryByLabelText('Score Value')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Cost Lb')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Stocked Date')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Stocked window')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Importer')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Elevation (MASL)')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Appearance')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toBeInTheDocument();
	});

	it('shows the home-roaster scope and paid range filters to member sessions', () => {
		render(Settingsbar, { data: { role: 'member' }, onClose: vi.fn() });

		expect(screen.getByText('Home Roaster Suppliers Only')).toBeInTheDocument();
		expect(screen.getByLabelText('Score Value')).toBeInTheDocument();
		expect(screen.getByLabelText('Cost Lb')).toBeInTheDocument();
		expect(screen.getByLabelText('Importer')).toBeInTheDocument();
		expect(screen.getByLabelText('Elevation (MASL)')).toBeInTheDocument();
		expect(screen.getByLabelText('Appearance')).toBeInTheDocument();
	});

	it('turns off wholesale visibility when home-roaster suppliers only is selected', async () => {
		storeState.set({
			...storeState.value,
			showWholesale: true
		});
		render(Settingsbar, { data: { role: 'viewer' }, onClose: vi.fn() });

		const checkbox = screen.getByRole('checkbox', { name: /Home Roaster Suppliers Only/i });
		expect(checkbox).not.toBeChecked();
		await fireEvent.click(checkbox);

		expect(filterStore.setShowWholesale).toHaveBeenCalledWith(false);
	});
});
