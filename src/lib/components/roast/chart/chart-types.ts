/** Processed data ready for chart rendering */
export interface ProcessedChartData {
	temperaturePoints: ChartPoint[];
	envTempPoints: ChartPoint[];
	rorPoints: ChartPoint[];
	controlSeries: ControlSeries[];
	events: ChartEvent[];
	chargeTime: number;
	xDomain: [number, number];
	yTempDomain: [number, number];
	yRorDomain: [number, number];
}

export interface ChartPoint {
	timeMinutes: number;
	value: number;
}

export interface ControlSeries {
	name: string;
	color: string;
	strokeWidth: number;
	points: ChartPoint[];
}

export interface ChartEvent {
	timeMinutes: number;
	name: string;
}

export interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
	data: TooltipData | null;
}

export interface TooltipData {
	time: number;
	chargeTime: number;
	bean_temp: number | null;
	environmental_temp: number | null;
	rorValue: number | null;
	milestones: Array<{ event: string; time: number }>;
	eventData: Record<string, number>;
}

/** Series descriptor for chart legend */
export interface LegendEntry {
	label: string;
	color: string;
	strokeWidth: number;
	dashed?: boolean;
}
