/**
 * Shared type definitions for roast data.
 *
 * Single source of truth for all roast-related types.
 * Import from here instead of from stores.ts or component files.
 */

// ─── Core Data Types ─────────────────────────────────────────────────────────

/** A single temperature data point from roast_temperatures table */
export interface TemperatureEntry {
	roast_id: number;
	time_seconds: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	inlet_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source: 'live' | 'artisan_import' | 'manual';
	data_quality?: 'good' | 'interpolated' | 'estimated' | 'poor';
}

/** A single event from roast_events table */
export interface RoastEventEntry {
	roast_id: number;
	time_seconds: number;
	event_type: number;
	event_value: string | null;
	event_string: string;
	category: 'milestone' | 'control' | 'machine';
	subcategory: string;
	user_generated: boolean;
	automatic: boolean;
	notes?: string;
}

// ─── Chart Data Types ────────────────────────────────────────────────────────

/** Processed data point for D3 chart rendering */
export interface RoastPoint {
	time: number; // milliseconds
	heat: number;
	fan: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source?: 'live' | 'artisan_import' | 'manual';
	// Milestone flags for charge-relative time calculation
	charge?: boolean;
	start?: boolean;
	maillard?: boolean;
	fc_start?: boolean;
	drop?: boolean;
	end?: boolean;
}

/** Milestone event marker for chart display */
export interface RoastEvent {
	time: number; // milliseconds
	name: string;
}

/** Time-value pair used in smoothing, RoR calculation, and event series */
export interface TimeValuePoint {
	time: number;
	value: number;
}

/** A series of event values (fan, heat, etc.) for chart rendering */
export interface EventValueSeries {
	event_string: string;
	display_name: string;
	values: Array<{
		time_seconds: number;
		value: number;
	}>;
	min_value: number;
	max_value: number;
}

// ─── Milestone Types ─────────────────────────────────────────────────────────

/** Extracted milestone times in milliseconds */
export interface MilestoneData {
	start?: number;
	charge?: number;
	maillard?: number; // aka dry_end / turning point
	fc_start?: number;
	fc_end?: number;
	sc_start?: number;
	drop?: number;
	end?: number; // aka cool_end
}

/** Calculated roast phase percentages and relative times */
export interface MilestoneCalculations {
	totalTime: number;
	dryingPercent: number;
	tpTime: number; // turning point time relative to start/charge
	maillardPercent: number;
	fcTime: number; // first crack time relative to start/charge
	devPercent: number;
}

// ─── Chart Configuration ─────────────────────────────────────────────────────

/** Chart axis and display settings */
export interface ChartSettings {
	z_max?: number | null;
	z_min?: number | null;
	y_max?: number | null;
	y_min?: number | null;
	x_max?: number | null;
	x_min?: number | null;
}

/** Chart rendering configuration */
export interface ChartConfig {
	showBeanTemp: boolean;
	showEnvTemp: boolean;
	showRoR: boolean;
	showMilestones: boolean;
	showControlEvents: boolean;
	temperatureUnit: 'F' | 'C';
	settings?: ChartSettings;
}

/** Default chart configuration */
export const DEFAULT_CHART_CONFIG: ChartConfig = {
	showBeanTemp: true,
	showEnvTemp: true,
	showRoR: true,
	showMilestones: true,
	showControlEvents: true,
	temperatureUnit: 'F'
};

// ─── Roast Phase ─────────────────────────────────────────────────────────────

/** Timer/session phase state machine */
export type RoastPhase = 'idle' | 'recording' | 'paused' | 'completed';

// ─── Control Mapping ─────────────────────────────────────────────────────────

/** Maps Artisan/external control names to standardized names */
export const CONTROL_MAPPING: Record<string, string> = {
	burner: 'heat',
	air: 'fan'
};
