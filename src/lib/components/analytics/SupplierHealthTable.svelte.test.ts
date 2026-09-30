import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import SupplierHealthTable from './SupplierHealthTable.svelte';

const rows = [
	{
		source: 'royal_coffee',
		stockedCount: 449,
		origins: 19,
		avgCostLb: null,
		minCostLb: null,
		maxCostLb: null,
		retailCount: 47,
		wholesaleCount: 402
	},
	{
		source: 'sweet_marias',
		stockedCount: 54,
		origins: 17,
		avgCostLb: 9.81,
		minCostLb: 5.95,
		maxCostLb: 37.5,
		retailCount: 54,
		wholesaleCount: 0
	}
];

afterEach(() => cleanup());

describe('SupplierHealthTable', () => {
	it('shows missing retail prices as unavailable, never $0.00', () => {
		render(SupplierHealthTable, { rows, market: 'all' });
		expect(screen.queryByText('$0.00')).toBeNull();
		expect(screen.getByText('$9.81 avg')).toBeInTheDocument();
	});

	it('counts only in-scope lots for the retail view', () => {
		render(SupplierHealthTable, { rows, market: 'retail' });
		const table = screen.getByRole('table');
		expect(within(table).getByText('101 total')).toBeInTheDocument();
		expect(within(table).queryByText('449')).toBeNull();
	});
});
