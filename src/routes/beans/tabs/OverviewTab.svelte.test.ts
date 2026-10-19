import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { CoffeeCatalog, InventoryWithCatalog } from '$lib/types/component.types';
import OverviewTab from './OverviewTab.svelte';

function createInventory(): InventoryWithCatalog {
	const coffeeCatalog: CoffeeCatalog = {
		id: 42,
		name: 'Washed Decaf Lot',
		source: 'Example Importer',
		processing: 'Washed',
		decaffeinated: true,
		decafMethod: { code: 'ethyl_acetate', label: 'Ethyl acetate' },
		stocked: true,
		cost_lb: 8.5,
		price_per_lb: 8.5,
		price_tiers: null,
		public_coffee: true,
		wholesale: false,
		process_additives: null
	};

	return {
		id: 1,
		rank: 1,
		notes: null,
		cupping_notes: null,
		purchase_date: null,
		purchased_qty_lbs: null,
		bean_cost: null,
		tax_ship_cost: null,
		last_updated: '2026-10-14T00:00:00Z',
		user: 'member-1',
		catalog_id: 42,
		stocked: true,
		ai_tasting_notes: null,
		coffee_catalog: coffeeCatalog,
		roast_profiles: []
	};
}

describe('OverviewTab decaf display', () => {
	it('shows decaf method alongside the farm process in inventory', () => {
		const inventory = createInventory();
		render(OverviewTab, {
			selectedBean: inventory,
			editedBean: inventory,
			isEditing: false,
			canManagePortfolio: false,
			onToggleEdit: () => undefined,
			onDelete: () => undefined
		});

		expect(screen.getByText('Washed')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Decaffeination' })).toBeInTheDocument();
		expect(screen.getByLabelText('Decaf · Ethyl acetate')).toBeInTheDocument();
	});
});

describe('OverviewTab purchase section', () => {
	function purchasedInventory(): InventoryWithCatalog {
		return {
			...createInventory(),
			notes: null,
			purchase_date: '2026-07-28',
			purchased_qty_lbs: 10,
			bean_cost: 124.9,
			tax_ship_cost: 14.5,
			roast_profiles: [{ oz_in: 16 }, { oz_in: 48 }] as InventoryWithCatalog['roast_profiles']
		};
	}

	it('shows the purchase with plain labels, the delivered cost, and an edit action at the top', async () => {
		const inventory = purchasedInventory();
		const onToggleEdit = vi.fn();
		render(OverviewTab, {
			selectedBean: inventory,
			editedBean: inventory,
			isEditing: false,
			canManagePortfolio: true,
			onToggleEdit,
			onDelete: () => undefined
		});

		const purchase = screen.getByRole('region', { name: 'Your purchase' });
		expect(within(purchase).getByText('Coffee cost').nextElementSibling).toHaveTextContent(
			'$124.90'
		);
		expect(within(purchase).getByText('Tax & shipping').nextElementSibling).toHaveTextContent(
			'$14.50'
		);
		expect(within(purchase).getByText('Total paid').nextElementSibling).toHaveTextContent(
			'$139.40'
		);
		expect(
			within(purchase).getByText('Cost per lb, delivered').nextElementSibling
		).toHaveTextContent('$13.94');
		expect(within(purchase).getByText('6.0 lb left')).toBeInTheDocument();

		await fireEvent.click(within(purchase).getByRole('button', { name: 'Edit purchase' }));
		expect(onToggleEdit).toHaveBeenCalledOnce();
	});

	it('edits every purchase field, including notes that were empty, and can cancel', async () => {
		const inventory = purchasedInventory();
		const onToggleEdit = vi.fn();
		const onCancelEdit = vi.fn();
		render(OverviewTab, {
			selectedBean: inventory,
			editedBean: { ...inventory },
			isEditing: true,
			canManagePortfolio: true,
			onToggleEdit,
			onCancelEdit,
			onDelete: () => undefined
		});

		for (const label of [
			'Purchase date',
			'Quantity purchased (lb)',
			'Coffee cost ($)',
			'Tax & shipping ($)',
			'Notes',
			'In stock'
		]) {
			expect(screen.getByLabelText(label)).toBeInTheDocument();
		}
		expect(screen.queryByRole('button', { name: 'Delete coffee' })).not.toBeInTheDocument();

		const save = screen.getByRole('button', { name: 'Save changes' });
		expect(save).toHaveAttribute('type', 'submit');
		await fireEvent.submit(save.closest('form')!);
		expect(onToggleEdit).toHaveBeenCalledOnce();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onCancelEdit).toHaveBeenCalledOnce();
	});
});
