import { writable } from 'svelte/store';

// Interface definitions (avoiding circular imports)
export interface TemperatureDataPoint {
	time_seconds: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source: 'live' | 'artisan_import';
}

export interface RoastEventData {
	time_seconds: number;
	event_type: number;
	event_value: string | null;
	event_string: string;
	category: 'milestone' | 'control' | 'machine';
	subcategory: string;
	user_generated: boolean;
	automatic: boolean;
}

// Updated interfaces for new normalized structure
export interface RoastPoint {
	time: number; // Time in milliseconds for chart compatibility
	heat: number;
	fan: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source?: 'live' | 'artisan_import';
	// Milestone flags for charge-relative time calculation
	charge?: boolean;
	start?: boolean;
	maillard?: boolean;
	fc_start?: boolean;
	drop?: boolean;
	end?: boolean;
}

export interface RoastEvent {
	time: number; // Time in milliseconds for chart compatibility
	name: string;
}

// New interface for temperature data from roast_temperatures table
export interface TemperatureEntry {
	roast_id: number;
	time_seconds: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	ambient_temp?: number | null;
	ror_bean_temp?: number | null;
	data_source: 'live' | 'artisan_import';
}

// New interface for events from roast_events table
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

// Simplified store structure - single source of truth
export const startTime = writable<number | null>(null);
export const isRoasting = writable(false);
export const accumulatedTime = writable<number>(0);

// Primary data stores for normalized structure
export const temperatureEntries = writable<TemperatureEntry[]>([]);
export const eventEntries = writable<RoastEventEntry[]>([]);

// Derived chart data - computed from temperatureEntries and eventEntries
export const roastData = writable<RoastPoint[]>([]);
export const roastEvents = writable<RoastEvent[]>([]);

// Time conversion utilities for new structure
export function msToSeconds(ms: number): number {
	return ms / 1000;
}

export function secondsToMs(seconds: number): number {
	return seconds * 1000;
}

// Convert normalized data to chart format for D3.js rendering
export function convertToChartData(
	temperatures: TemperatureEntry[],
	events: RoastEventEntry[]
): { roastData: RoastPoint[]; roastEvents: RoastEvent[] } {
	// Sort control events by time for carry-forward logic
	const fanEvents = events
		.filter((e) => e.event_string === 'fan_setting')
		.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));
	const heatEvents = events
		.filter((e) => e.event_string === 'heat_setting')
		.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));

	// Convert temperature entries to chart data with control values carried forward
	const roastData: RoastPoint[] = temperatures.map((temp) => {
		const tempTimeSeconds = parseFloat(String(temp.time_seconds));

		// Find most recent control events before or at this time
		const fanEvent = fanEvents
			.filter((e) => parseFloat(String(e.time_seconds)) <= tempTimeSeconds)
			.pop();
		const heatEvent = heatEvents
			.filter((e) => parseFloat(String(e.time_seconds)) <= tempTimeSeconds)
			.pop();

		// Find milestone events at this time
		const milestoneEvents = events.filter(
			(e) =>
				e.category === 'milestone' &&
				Math.abs(parseFloat(String(e.time_seconds)) - tempTimeSeconds) < 1
		);

		return {
			time: secondsToMs(tempTimeSeconds),
			heat: heatEvent ? parseInt(heatEvent.event_value || '0') : 0,
			fan: fanEvent ? parseInt(fanEvent.event_value || '0') : 0,
			bean_temp: temp.bean_temp,
			environmental_temp: temp.environmental_temp,
			ambient_temp: temp.ambient_temp,
			ror_bean_temp: temp.ror_bean_temp,
			data_source: temp.data_source,
			// Milestone flags for chart rendering
			charge: milestoneEvents.some((e) => e.event_string === 'charge'),
			start: milestoneEvents.some((e) => e.event_string === 'start'),
			maillard: milestoneEvents.some(
				(e) => e.event_string === 'dry_end' || e.event_string === 'maillard'
			),
			fc_start: milestoneEvents.some((e) => e.event_string === 'fc_start'),
			drop: milestoneEvents.some((e) => e.event_string === 'drop'),
			end: milestoneEvents.some((e) => e.event_string === 'cool' || e.event_string === 'end')
		};
	});

	// Convert milestone events to chart display format
	const roastEvents: RoastEvent[] = events
		.filter((e) => e.category === 'milestone')
		.map((event) => ({
			time: secondsToMs(event.time_seconds),
			name:
				event.event_string.charAt(0).toUpperCase() + event.event_string.slice(1).replace(/_/g, ' ')
		}));

	return { roastData, roastEvents };
}

export interface MilestoneData {
	start?: number;
	charge?: number;
	maillard?: number;
	fc_start?: number;
	fc_end?: number;
	sc_start?: number;
	drop?: number;
	end?: number;
}

export interface MilestoneCalculations {
	totalTime: number;
	dryingPercent: number;
	tpTime: number;
	maillardPercent: number;
	fcTime: number;
	devPercent: number;
}

// Format time from milliseconds to MM:SS display format
export function formatTimeDisplay(ms: number): string {
	if (!ms || ms <= 0) return '--:--';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Extract milestone times from event entries (new normalized structure)
export function extractMilestones(eventEntries: RoastEventEntry[]): MilestoneData {
	const milestones: MilestoneData = {};

	for (const event of eventEntries) {
		if (event.category === 'milestone') {
			const timeMs = secondsToMs(event.time_seconds);

			switch (event.event_string) {
				case 'start':
					milestones.start = timeMs;
					break;
				case 'charge':
					milestones.charge = timeMs;
					break;
				case 'dry_end':
				case 'maillard': // Handle both naming conventions
					milestones.maillard = timeMs;
					break;
				case 'fc_start':
					milestones.fc_start = timeMs;
					break;
				case 'fc_end':
					milestones.fc_end = timeMs;
					break;
				case 'sc_start':
					milestones.sc_start = timeMs;
					break;
				case 'drop':
					milestones.drop = timeMs;
					break;
				case 'cool':
				case 'end': // Handle both naming conventions
					milestones.end = timeMs;
					break;
			}
		}
	}

	return milestones;
}

// Calculate milestone percentages and times
export function calculateMilestones(milestones: MilestoneData): MilestoneCalculations {
	const start = milestones.start || 0;
	const drop = milestones.drop || milestones.end || 0;
	const totalTime = drop - start;

	const tpTime = milestones.maillard || 0;
	const fcTime = milestones.fc_start || 0;

	let dryingPercent = 0;
	let maillardPercent = 0;
	let devPercent = 0;

	if (totalTime > 0) {
		// DRYING % = time from start to turning point (maillard)
		if (tpTime > start) {
			dryingPercent = ((tpTime - start) / totalTime) * 100;
		}

		// MAILLARD % = time from turning point to first crack
		if (fcTime > tpTime && tpTime > 0) {
			maillardPercent = ((fcTime - tpTime) / totalTime) * 100;
		}

		// DEV % = time from first crack to drop
		if (drop > fcTime && fcTime > 0) {
			devPercent = ((drop - fcTime) / totalTime) * 100;
		}
	}

	return {
		totalTime,
		dryingPercent,
		tpTime: tpTime - start, // Relative time from start
		maillardPercent,
		fcTime: fcTime - start, // Relative time from start
		devPercent
	};
}

// Add a simple roast event with automatic control settings
export function addRoastEvent(
	eventName: string,
	roastId: number,
	currentTimeMs: number,
	fanValue: number,
	heatValue: number
): { milestoneEvent: RoastEventEntry; controlEvents: RoastEventEntry[] } {
	const timeSeconds = msToSeconds(currentTimeMs);

	// Create milestone event
	const milestoneEvent: RoastEventEntry = {
		roast_id: roastId,
		time_seconds: timeSeconds,
		event_type: 10,
		event_value: null,
		event_string: eventName.toLowerCase().replace(/\s+/g, '_'),
		category: 'milestone',
		subcategory: 'roast_phase',
		user_generated: true,
		automatic: false
	};

	// Create control events for current settings
	const controlEvents: RoastEventEntry[] = [
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: fanValue.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		},
		{
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: eventName === 'Drop' ? '0' : heatValue.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		}
	];

	return { milestoneEvent, controlEvents };
}
