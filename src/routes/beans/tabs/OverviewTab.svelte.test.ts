import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
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
		expect(screen.getByRole('heading', { name: 'DECAFFEINATION' })).toBeInTheDocument();
		expect(screen.getByLabelText('Decaf · Ethyl acetate')).toBeInTheDocument();
	});
});
