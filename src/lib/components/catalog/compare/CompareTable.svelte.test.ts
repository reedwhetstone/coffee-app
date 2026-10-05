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

	it('labels other derived rows by why the value is missing', () => {
		render(CompareTable, {
			comparison: {
				...comparison,
				rows: [
					{
						key: 'disclosure',
						group: 'Process',
						label: 'Process disclosure',
						values: ['high_detail', null, null],
						relation: 'partial',
						bestLotIds: []
					},
					{
						key: 'taste_body',
						group: 'Taste',
						label: 'Body',
						values: [null, 'Syrupy (4/5)', null],
						relation: 'partial',
						bestLotIds: []
					},
					{
						key: 'purveyor_score',
						group: 'Listing',
						label: 'Purveyor Score (listing completeness)',
						values: [82, null, 74],
						relation: 'different',
						bestLotIds: []
					}
				]
			},
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const cells = (name: string) => within(screen.getByRole('rowheader', { name }).closest('tr')!);
		expect(cells('Process disclosure').getAllByText('Not assessed')).toHaveLength(2);
		expect(cells('Body').getAllByText('Not rated')).toHaveLength(2);
		expect(
			cells('Purveyor Score (listing completeness)').getByText('Not scored')
		).toBeInTheDocument();
		expect(screen.getByRole('table').textContent).not.toContain('Not disclosed');
	});

	it('shows grading rows in their own group between Coffee and Taste', () => {
		render(CompareTable, {
			comparison: {
				...comparison,
				rows: [
					{
						key: 'taste_body',
						group: 'Taste',
						label: 'Body',
						values: ['Syrupy (4/5)', null, null],
						relation: 'partial',
						bestLotIds: []
					},
					{
						key: 'moisture',
						group: 'Grading',
						label: 'Moisture',
						values: ['10.8%', '11.2%', null],
						relation: 'different',
						bestLotIds: []
					},
					{
						key: 'variety',
						group: 'Coffee',
						label: 'Variety',
						values: ['Bourbon', 'Bourbon', 'Bourbon'],
						relation: 'same',
						bestLotIds: []
					}
				]
			},
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
		expect(headings.filter((text) => ['Coffee', 'Grading', 'Taste'].includes(text ?? ''))).toEqual([
			'Coffee',
			'Grading',
			'Taste'
		]);
		const row = screen.getByRole('rowheader', { name: 'Moisture' }).closest('tr')!;
		expect(within(row).getByText('10.8%')).toBeInTheDocument();
		expect(within(row).getByText('11.2%')).toBeInTheDocument();
		expect(within(row).getByText('Not disclosed')).toBeInTheDocument();
	});

	it('draws a group it does not know about after the known ones', () => {
		render(CompareTable, {
			comparison: {
				...comparison,
				rows: [
					{
						key: 'future_row',
						group: 'Certifications' as never,
						label: 'Organic',
						values: ['Yes', 'No', null],
						relation: 'different',
						bestLotIds: []
					},
					{
						key: 'variety',
						group: 'Coffee',
						label: 'Variety',
						values: ['Bourbon', 'Bourbon', 'Bourbon'],
						relation: 'same',
						bestLotIds: []
					}
				]
			},
			quantityOptions: [1, 5, 10],
			onQuantityChange: vi.fn(),
			onRemove: vi.fn()
		});
		const headings = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
		expect(headings.indexOf('Certifications')).toBeGreaterThan(headings.indexOf('Coffee'));
		expect(screen.getByRole('rowheader', { name: 'Organic' })).toBeInTheDocument();
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
