import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CompareTable from './CompareTable.svelte';
import type { CatalogComparison } from '$lib/catalog/compareTypes';

const lot = (id: number, name: string, atQuantityLb: number | null, minOrderLbs = 1) => ({
	id,
	name,
	source: 'burman',
	link: null,
	stocked: true,
	wholesale: false,
	price: {
		quantityLbs: 5,
		atQuantityLb,
		smallestTierLb: atQuantityLb,
		minOrderLbs,
		tiers: [],
		originMedianLb: null,
		vsOriginMedianPct: null
	}
});

const comparison: CatalogComparison = {
	quantityLbs: 5,
	bestPriceLotIds: [2],
	missingIds: [],
	lots: [lot(1, 'Brazil Lot', 9.19), lot(2, 'Guatemala Lot', 6.49), lot(3, 'Bulk Lot', null, 10)],
	rows: [
		{
			key: 'price_at_quantity',
			group: 'Price',
			label: 'Price at 5 lb',
			values: [9.19, 6.49, null],
			relation: 'different',
			bestLotIds: [2]
		},
		{
			key: 'market',
			group: 'Availability',
			label: 'Market',
			values: ['Retail', 'Retail', 'Retail'],
			relation: 'same',
			bestLotIds: []
		},
		{
			key: 'drying',
			group: 'Process',
			label: 'Drying',
			values: [null, 'Raised beds', null],
			relation: 'partial',
			bestLotIds: []
		}
	]
};

afterEach(() => cleanup());

describe('CompareTable', () => {
	it('marks the cheapest lot, collapses matching rows, and labels undisclosed values', () => {
		render(CompareTable, {
			comparison,
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const priceRow = screen.getByRole('rowheader', { name: 'Price at 5 lb' }).closest('tr')!;
		expect(within(priceRow).getByText('$6.49/lb')).toBeInTheDocument();
		expect(within(priceRow).getByText('Lowest')).toBeInTheDocument();
		expect(within(priceRow).getByText('Minimum order 10 lb')).toBeInTheDocument();
		expect(screen.getByText('Lowest at 5 lb')).toBeInTheDocument();

		const marketRow = screen.getByRole('rowheader', { name: 'Market' }).closest('tr')!;
		expect(within(marketRow).getByText('Same for all')).toBeInTheDocument();
		expect(within(marketRow).getAllByRole('cell')).toHaveLength(1);

		const dryingRow = screen.getByRole('rowheader', { name: 'Drying' }).closest('tr')!;
		expect(within(dryingRow).getAllByText('Not disclosed')).toHaveLength(2);
		expect(screen.getByText('2 of 3 facts differ')).toBeInTheDocument();
	});

	it('shows baseline deltas, hides matching rows, and reports quantity and removal', async () => {
		const onQuantityChange = vi.fn();
		const onRemove = vi.fn();
		render(CompareTable, { comparison, quantityOptions: [1, 5, 10], onQuantityChange, onRemove });

		await fireEvent.click(screen.getAllByRole('button', { name: 'Set as baseline' })[0]);
		expect(screen.getByText('−$2.70 (−29.4%) vs baseline')).toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText('Show differences only'));
		expect(screen.queryByRole('rowheader', { name: 'Market' })).toBeNull();

		await fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } });
		expect(onQuantityChange).toHaveBeenCalledWith(10);

		await fireEvent.click(
			screen.getByRole('button', { name: 'Remove Guatemala Lot from comparison' })
		);
		expect(onRemove).toHaveBeenCalledWith(2);
	});

	it('labels a missing origin benchmark as unavailable rather than undisclosed', () => {
		render(CompareTable, {
			comparison: {
				...comparison,
				rows: [
					{
						key: 'vs_origin_median',
						group: 'Price',
						label: 'Versus origin median (%)',
						values: [12.5, null, null],
						relation: 'partial',
						bestLotIds: []
					}
				]
			},
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const row = screen.getByRole('rowheader', { name: 'Versus origin median (%)' }).closest('tr')!;
		expect(within(row).getByText('+12.5%')).toBeInTheDocument();
		expect(within(row).getAllByText('Benchmark unavailable')).toHaveLength(2);
		expect(within(row).queryByText('Not disclosed')).toBeNull();
	});

	it('keeps a shared quantity outside the presets selectable', () => {
		render(CompareTable, {
			comparison: { ...comparison, quantityLbs: 3 },
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const picker = screen.getByRole('combobox') as HTMLSelectElement;
		expect(picker.value).toBe('3');
		expect(
			within(picker)
				.getAllByRole('option')
				.map((option) => option.textContent)
		).toEqual(['1 lb', '3 lb', '5 lb', '10 lb']);
	});
});
