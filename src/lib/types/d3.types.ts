import type { Selection, ScaleLinear, ScaleTime, Line } from 'd3';

// Core D3 selection types for DOM manipulation
export type D3Selection<T extends Element = Element> = Selection<T, unknown, null, undefined>;
export type D3GSelection = Selection<SVGGElement, unknown, null, undefined>;
export type D3SVGSelection = Selection<SVGSVGElement, unknown, null, undefined>;

// Chart data point interfaces
export interface ChartPoint {
	x: number;
	y: number;
	timestamp?: number;
}

export interface TemperaturePoint extends ChartPoint {
	bean_temp: number;
	environmental_temp?: number;
	time_seconds: number;
	time?: number;
	chargeTime?: number;
	milestones?: Array<{ event: string; time: number }>;
	rorValue?: number | null;
	eventData?: Record<string, unknown>;
	heat?: number | null;
	fan?: number | null;
}

export interface RoastEventPoint {
	time_seconds: number;
	event_type: string;
	event_value?: string;
	temperature?: number;
}

// Chart configuration and dimensions
export interface ChartDimensions {
	width: number;
	height: number;
	margin: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
}

export interface ChartBounds {
	innerWidth: number;
	innerHeight: number;
}

// Scale types for chart axes
export type TemperatureScale = ScaleLinear<number, number>;
export type TimeScale = ScaleLinear<number, number> | ScaleTime<number, number>;

// Line generator types
export type TemperatureLine = Line<TemperaturePoint>;
export type ChartLine<T = ChartPoint> = Line<T>;

// Chart interaction types
export interface ChartInteraction {
	x: number;
	y: number;
	data?: ChartPoint;
}

// Event handler types for charts
export type ChartMouseHandler = (event: MouseEvent, interaction: ChartInteraction) => void;
export type ChartClickHandler = (event: MouseEvent, data: ChartPoint) => void;

// Chart configuration interfaces
export interface ChartConfig {
	dimensions: ChartDimensions;
	scales: {
		x: TimeScale;
		y: TemperatureScale;
	};
	showGrid?: boolean;
	showTooltip?: boolean;
	interactive?: boolean;
}

// Roast-specific chart types
export interface RoastChartData {
	temperatures: TemperaturePoint[];
	events: RoastEventPoint[];
	milestones?: Record<string, number>;
}

export interface MilestoneEvent {
	name: string;
	time: number;
	temperature?: number;
	color?: string;
}

// Chart update data types
export interface ChartUpdateData<T = ChartPoint> {
	data: T[];
	duration?: number;
	ease?: (t: number) => number;
}

// Axis configuration
export interface AxisConfig {
	scale: ScaleLinear<number, number> | ScaleTime<number, number>;
	orientation: 'top' | 'bottom' | 'left' | 'right';
	tickCount?: number;
	tickFormat?: (value: number | Date) => string;
	label?: string;
}

// Tooltip data structure
export interface TooltipData {
	x: number;
	y: number;
	content: string | HTMLElement;
	visible: boolean;
}

// Chart animation types
export interface ChartAnimation {
	duration: number;
	delay?: number;
	ease?: string;
}

// Performance chart specific types
export interface PerformanceDataPoint {
	date: string;
	revenue: number;
	cost: number;
	profit: number;
	target: number;
	margin: number;
	saleData?: {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string;
		totalCost?: number;
	};
	salesCount?: number;
}

export interface SalesDataPoint {
	date: string;
	revenue: number;
	quantity: number;
	buyer?: string;
}

// Generic chart data container
export interface ChartDataset<T = ChartPoint> {
	id: string;
	label: string;
	data: T[];
	color?: string;
	strokeWidth?: number;
	showPoints?: boolean;
}
