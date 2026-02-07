import type {
	CoffeeCatalog,
	GreenCoffeeInv,
	CoffeeFormData,
	RoastFormData,
	SalesFormData,
	TableColumn
} from './component.types';
import type { TastingNotes } from './coffee.types';

// ─── UIBlock Discriminated Union ───────────────────────────────────────────────
// All blocks include a `version` field for schema evolution on persisted data.

export type UIBlock =
	| CoffeeCardsBlock
	| InventoryTableBlock
	| RoastChartBlock
	| RoastComparisonBlock
	| ProfitSummaryBlock
	| TastingRadarBlock
	| DataTableBlock
	| ActionCardBlock
	| BeanFormBlock
	| RoastFormBlock
	| SaleFormBlock
	| ErrorBlock;

export interface CoffeeCardsBlock {
	type: 'coffee-cards';
	version: 1;
	data: CoffeeCatalog[];
	focusId?: number;
}

export interface InventoryTableBlock {
	type: 'inventory-table';
	version: 1;
	data: GreenCoffeeInv[];
}

export interface RoastChartBlock {
	type: 'roast-chart';
	version: 1;
	data: { roastId: number };
}

export interface RoastComparisonBlock {
	type: 'roast-comparison';
	version: 1;
	data: { roastIds: number[] };
}

export interface ProfitSummaryBlock {
	type: 'profit-summary';
	version: 1;
	data: ProfitMetrics;
}

export interface TastingRadarBlock {
	type: 'tasting-radar';
	version: 1;
	data: TastingRadarData;
}

export interface DataTableBlock {
	type: 'data-table';
	version: 1;
	data: { columns: TableColumn[]; rows: unknown[] };
}

export interface ActionCardBlock {
	type: 'action-card';
	version: 1;
	data: ActionCardPayload;
}

export interface BeanFormBlock {
	type: 'bean-form';
	version: 1;
	data: Partial<CoffeeFormData>;
}

export interface RoastFormBlock {
	type: 'roast-form';
	version: 1;
	data: Partial<RoastFormData>;
}

export interface SaleFormBlock {
	type: 'sale-form';
	version: 1;
	data: Partial<SalesFormData>;
}

export interface ErrorBlock {
	type: 'error';
	version: 1;
	data: { message: string; retryable: boolean };
}

// ─── Supporting Types ──────────────────────────────────────────────────────────

export interface ActionCardPayload {
	functionName: string;
	summary: string;
	parameters: Record<string, unknown>;
	status: 'proposed' | 'confirmed' | 'executing' | 'success' | 'failed';
	result?: unknown;
	error?: string;
}

export interface ProfitMetrics {
	totalRevenue: number;
	totalCosts: number;
	netProfit: number;
	margin: number;
	salesCount: number;
	period?: string;
}

export interface TastingRadarData {
	beanName: string;
	beanId: number;
	notes: TastingNotes;
	source: 'user' | 'supplier' | 'both';
}

// ─── Helper to check block type ────────────────────────────────────────────────

export function isUIBlock(obj: unknown): obj is UIBlock {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'type' in obj &&
		'version' in obj &&
		'data' in obj
	);
}
