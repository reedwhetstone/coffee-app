import type { Database } from './database.types';

// Database table types for convenience
export type CoffeeCatalog = Database['public']['Tables']['coffee_catalog']['Row'];
export type GreenCoffeeInv = Database['public']['Tables']['green_coffee_inv']['Row'];
export type RoastProfile = Database['public']['Tables']['roast_profiles']['Row'];
export type SalesRecord = Database['public']['Tables']['sales']['Row'];

// Extended types with joins and computed fields
export interface CoffeeWithInventory extends CoffeeCatalog {
	green_coffee_inv?: GreenCoffeeInv[];
}

export interface InventoryWithCatalog extends GreenCoffeeInv {
	coffee_catalog?: CoffeeCatalog;
	roast_profiles?: RoastProfile[];
}

export interface RoastWithCoffee extends RoastProfile {
	green_coffee_inv?: InventoryWithCatalog;
}

export type RoastTemperature = Database['public']['Tables']['roast_temperatures']['Row'];
export type RoastEvent = Database['public']['Tables']['roast_events']['Row'];

export interface RoastWithLogs extends RoastProfile {
	roast_temperatures?: RoastTemperature[];
	roast_events?: RoastEvent[];
	green_coffee_inv?: InventoryWithCatalog;
}

export type AvailableCoffee = CoffeeCatalog & GreenCoffeeInv & { coffee_catalog?: CoffeeCatalog };

export interface BatchItem {
	batch_name: string;
	coffee_id: number; // references green_coffee_inv_id or coffee_catalog_id? SalesForm implies coffee_id matches coffee.id
}

// Form data interfaces
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
	// Optional catalog fields that can be dynamically added
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

// Component prop interfaces
export interface CoffeeCardProps {
	coffee: CoffeeCatalog;
	showActions?: boolean;
	onSelect?: (coffee: CoffeeCatalog) => void;
	onAddToInventory?: (coffee: CoffeeCatalog) => void;
}

export interface BeanDetailsProps {
	bean: InventoryWithCatalog;
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: CoffeeFormData) => Promise<void>;
	onDelete?: (id: number) => Promise<void>;
}

export interface RoastProfileProps {
	profile: RoastWithLogs;
	onEdit?: (profile: RoastProfile) => void;
	onDelete?: (id: number) => void;
	onViewChart?: (profile: RoastProfile) => void;
}

export interface RoastProfileDisplayProps {
	profile: RoastProfile;
	onUpdate: (profile: RoastProfile) => void;
	onProfileDeleted: () => void;
	onBatchDeleted: () => void;
	profiles?: RoastProfile[];
	currentIndex?: number;
}

export interface VirtualScrollProps<T = unknown> {
	items: T[];
	itemHeight: number;
	containerHeight: number;
	renderItem: (item: T, index: number) => string;
	keyExtractor?: (item: T, index: number) => string | number;
}

// Chart component props
export interface ChartProps<T = unknown> {
	data: T[];
	width?: number;
	height?: number;
	showTooltip?: boolean;
	interactive?: boolean;
	onDataPointClick?: (dataPoint: T) => void;
}

export interface PerformanceChartProps extends ChartProps {
	data: Array<{
		date: string;
		profit: number;
		volume: number;
		avgPrice: number;
	}>;
	timeRange?: 'week' | 'month' | 'year';
}

export interface SalesChartProps extends ChartProps {
	data: Array<{
		date: string;
		revenue: number;
		quantity: number;
		buyer?: string;
	}>;
	groupBy?: 'day' | 'week' | 'month';
}

// Dialog and modal props
export interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	description?: string;
	showCloseButton?: boolean;
}

export interface ConfirmDialogProps extends DialogProps {
	onConfirm: () => void;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'warning' | 'info';
}

// Form component props
export interface FormFieldProps {
	label: string;
	name: string;
	value: string | number;
	onChange: (value: string | number) => void;
	type?: 'text' | 'number' | 'date' | 'email';
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	error?: string;
}

export interface SelectFieldProps extends Omit<FormFieldProps, 'type'> {
	options: Array<{
		value: string | number;
		label: string;
	}>;
	placeholder?: string;
}

export interface TextAreaFieldProps extends Omit<FormFieldProps, 'type'> {
	rows?: number;
	maxLength?: number;
}

// Button component props
export interface ButtonProps {
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	loading?: boolean;
	onClick?: (event: MouseEvent) => void;
	type?: 'button' | 'submit' | 'reset';
}

export interface LoadingButtonProps extends ButtonProps {
	loading: boolean;
	loadingText?: string;
}

// Table component props
export interface TableColumn<T = unknown> {
	key: keyof T | string;
	label: string;
	sortable?: boolean;
	width?: string;
	align?: 'left' | 'center' | 'right';
	render?: (value: unknown, item: T) => string;
}

export interface TableProps<T = unknown> {
	data: T[];
	columns: TableColumn<T>[];
	onRowClick?: (item: T) => void;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
	onSort?: (column: string, direction: 'asc' | 'desc') => void;
	loading?: boolean;
	emptyMessage?: string;
}

// Search and filter props
export interface SearchProps {
	query: string;
	onQueryChange: (query: string) => void;
	placeholder?: string;
	debounceMs?: number;
	showClearButton?: boolean;
}

export interface FilterOption {
	value: string;
	label: string;
	count?: number;
}

export interface FilterProps {
	options: FilterOption[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
	label: string;
	multiSelect?: boolean;
}

// Page layout props
export interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: Array<{
		label: string;
		onClick: () => void;
		variant?: ButtonProps['variant'];
	}>;
}

export interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: unknown;
}

// Event handler types
export type ClickHandler = (event: MouseEvent) => void;
export type SubmitHandler<T = Record<string, unknown>> = (data: T) => void | Promise<void>;
export type ChangeHandler<T = string> = (value: T) => void;

// Loading and error states
export interface LoadingState {
	loading: boolean;
	error?: string;
}

export interface AsyncAction<T = unknown> {
	execute: (data?: T) => Promise<void>;
	loading: boolean;
	error?: string;
	success?: boolean;
}

// Pagination props
export interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	showFirstLast?: boolean;
	showPrevNext?: boolean;
	maxVisiblePages?: number;
}

// Export all types for easy importing
export type ComponentPropsMap = {
	CoffeeCard: CoffeeCardProps;
	BeanDetails: BeanDetailsProps;
	RoastProfile: RoastProfileProps;
	VirtualScroll: VirtualScrollProps;
	Chart: ChartProps;
	Dialog: DialogProps;
	FormField: FormFieldProps;
	Button: ButtonProps;
	Table: TableProps;
	Search: SearchProps;
	Filter: FilterProps;
};
