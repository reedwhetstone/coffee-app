/** Processed data ready for chart rendering */
export interface ProcessedChartData {
	temperaturePoints: ChartPoint[];
	envTempPoints: ChartPoint[];
	rorPoints: ChartPoint[];
	controlSeries: ControlSeries[];
	series: ChartSeries[];
	events: ChartEvent[];
	chargeTime: number;
	temperatureUnit: string;
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

export type ChartSeriesAxis = 'temperature' | 'ror' | 'control';

/** One independently toggleable line in the shared roast chart model. */
export interface ChartSeries {
	id: string;
	label: string;
	kind:
		| 'bean_temperature'
		| 'environmental_temperature'
		| 'ambient_temperature'
		| 'rate_of_rise'
		| 'auxiliary'
		| 'control';
	unit: string | null;
	axis: ChartSeriesAxis;
	color: string;
	strokeWidth: number;
	dashed?: boolean;
	curve: 'basis' | 'linear' | 'stepAfter';
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
	seriesValues: Array<{
		id: string;
		label: string;
		unit: string | null;
		value: number;
	}>;
}

/** Series descriptor for chart legend */
export interface LegendEntry {
	label: string;
	color: string;
	strokeWidth: number;
	dashed?: boolean;
}
