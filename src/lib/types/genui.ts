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
	| RoastProfilesBlock
	| ProfitSummaryBlock
	| TastingRadarBlock
	| DataTableBlock
	| ActionCardBlock
	| BeanFormBlock
	| RoastFormBlock
	| SaleFormBlock
	| ErrorBlock;

export interface CoffeeCardAnnotation {
	id: number;
	annotation?: string;
	highlight?: boolean;
}

export interface CoffeeCardsBlock {
	type: 'coffee-cards';
	version: 1;
	data: CoffeeCatalog[];
	focusId?: number;
	layout?: 'inline' | 'grid' | 'focused';
	annotations?: CoffeeCardAnnotation[];
}

export interface InventoryTableBlock {
	type: 'inventory-table';
	version: 1;
	data: GreenCoffeeInv[];
	summary?: InventorySummary;
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

export interface RoastProfileAnnotation {
	id: number;
	annotation?: string;
	highlight?: boolean;
}

export interface RoastProfilesBlock {
	type: 'roast-profiles';
	version: 1;
	data: RoastProfileRow[];
	summary?: RoastProfilesSummary;
	annotations?: RoastProfileAnnotation[];
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

export type ActionType =
	| 'add_bean_to_inventory'
	| 'update_bean'
	| 'create_roast_session'
	| 'update_roast_notes'
	| 'record_sale';

export interface ActionField {
	key: string;
	label: string;
	value: unknown;
	type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'hidden';
	editable: boolean;
	options?: string[]; // for select type (simple string options)
	selectOptions?: Array<{ label: string; value: string }>; // for select type (label/value pairs)
}

export interface ActionCardPayload {
	actionType: ActionType;
	summary: string;
	reasoning?: string;
	fields: ActionField[];
	status: 'proposed' | 'executing' | 'success' | 'failed';
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

export interface InventorySummary {
	total_beans: number;
	total_weight_lbs: number;
	total_value: number;
	stocked_beans: number;
}

export interface RoastProfileRow {
	roast_id: string;
	batch_name: string;
	coffee_name: string;
	roast_date: string;
	total_roast_time: number | null;
	fc_start_time: number | null;
	fc_start_temp: number | null;
	drop_time: number | null;
	drop_temp: number | null;
	development_percent: number | null;
	weight_loss_percent: number | null;
	total_ror: number | null;
	oz_in: number | null;
	oz_out: number | null;
	roast_notes: string | null;
}

export interface RoastProfilesSummary {
	total_roasts: number;
	avg_total_roast_time: number | null;
	avg_fc_start_temp: number | null;
	avg_drop_temp: number | null;
	avg_development_percent: number | null;
	avg_weight_loss_percent: number | null;
	avg_total_ror: number | null;
	date_range_start?: string;
	date_range_end?: string;
}

// ─── Block Action Types ──────────────────────────────────────────────────────

export type BlockAction =
	| { type: 'navigate'; url: string }
	| { type: 'focus-canvas-block'; blockId: string }
	| { type: 'scroll-to-message'; messageId: string };

// ─── Canvas Types ────────────────────────────────────────────────────────────

export type CanvasLayout = 'focus' | 'comparison' | 'dashboard';

export interface CanvasBlock {
	id: string;
	block: UIBlock;
	messageId: string;
	pinned: boolean;
	minimized: boolean;
	addedAt: number;
}

export type CanvasMutation =
	| { type: 'add'; block: UIBlock; messageId: string }
	| { type: 'remove'; blockId: string }
	| { type: 'focus'; blockId: string }
	| { type: 'clear' }
	| { type: 'layout'; layout: CanvasLayout }
	| { type: 'replace'; blocks: Array<{ block: UIBlock; messageId: string }> }
	| { type: 'pin'; blockId: string }
	| { type: 'unpin'; blockId: string }
	| { type: 'minimize'; blockId: string }
	| { type: 'restore'; blockId: string };

export interface CanvasState {
	blocks: CanvasBlock[];
	layout: CanvasLayout;
	focusBlockId: string | null;
}

// ─── Helper to check block type ────────────────────────────────────────────────

export function isUIBlock(obj: unknown): obj is UIBlock {
	return (
		typeof obj === 'object' && obj !== null && 'type' in obj && 'version' in obj && 'data' in obj
	);
}
