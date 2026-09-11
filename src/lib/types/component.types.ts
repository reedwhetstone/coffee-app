import type { components } from '@purveyors/sdk';
import type { CatalogItem } from '$lib/data/catalog';

export type CoffeeCatalog = CatalogItem;
export type RoastProfile = components['schemas']['RoastListResource'];

type InventoryResource = components['schemas']['InventoryResource'];
type InventoryRoastSummary = Pick<
	RoastProfile,
	'oz_in' | 'oz_out' | 'weight_loss_percent' | 'roast_id' | 'batch_name' | 'roast_date'
>;

/** Browser-facing projection returned by coffee-app's Parchment inventory BFF. */
export type InventoryWithCatalog = Omit<InventoryResource, 'coffee_catalog'> & {
	ai_tasting_notes: string | null;
	coffee_catalog: CoffeeCatalog | null;
	roast_profiles: InventoryRoastSummary[];
};

export type GreenCoffeeInv = InventoryWithCatalog;
export type AvailableCoffee = InventoryWithCatalog & { name?: string | null };

export interface BatchItem {
	batch_name: string;
	coffee_id: number;
}

export interface CoffeeFormData {
	manual_name?: string;
	catalog_id?: number | null;
	rank?: number;
	notes?: string;
	purchase_date?: string;
	purchased_qty_lbs?: number;
	bean_cost?: number;
	tax_ship_cost?: number;
	cupping_notes?: Record<string, unknown>;
	last_updated?: string;
	[key: string]: string | number | null | Record<string, unknown> | undefined;
}

export interface RoastFormData {
	batch_name: string;
	coffee_id: number;
	coffee_name: string;
	roast_date: string;
	oz_in?: number;
	oz_out?: number;
	roast_notes?: string;
	roast_targets?: string;
	roaster_type?: string;
	roaster_size?: number;
}

export interface SalesFormData {
	green_coffee_inv_id: number;
	oz_sold: number;
	price: number;
	buyer: string;
	batch_name: string;
	sell_date: string;
}

export interface TableColumn<T = unknown> {
	key: keyof T | string;
	label: string;
	sortable?: boolean;
	width?: string;
	align?: 'left' | 'center' | 'right';
	render?: (value: unknown, item: T) => string;
}
