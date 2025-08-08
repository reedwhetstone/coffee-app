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

export const roastData = writable<RoastPoint[]>([]);
export const roastEvents = writable<RoastEvent[]>([]);
export const startTime = writable<number | null>(null);
export const isRoasting = writable(false);
export const accumulatedTime = writable<number>(0);
// New stores for normalized data
export const temperatureEntries = writable<TemperatureEntry[]>([]);
export const eventEntries = writable<RoastEventEntry[]>([]);
// Store for tracking only meaningful control changes (for backend persistence)
export const controlChanges = writable<RoastPoint[]>([]);

// Time conversion utilities for new structure
export function msToSeconds(ms: number): number {
	return ms / 1000;
}

export function secondsToMs(seconds: number): number {
	return seconds * 1000;
}

// Convert TemperatureDataPoint to RoastPoint for chart compatibility
export function temperatureDataToRoastPoint(tempData: TemperatureDataPoint[]): RoastPoint[] {
	return tempData.map((point) => ({
		time: secondsToMs(point.time_seconds),
		heat: 0, // Will be populated from control events
		fan: 0, // Will be populated from control events
		bean_temp: point.bean_temp,
		environmental_temp: point.environmental_temp,
		ambient_temp: point.ambient_temp,
		ror_bean_temp: point.ror_bean_temp,
		data_source: point.data_source as 'live' | 'artisan_import'
	}));
}

// Convert RoastEventData to RoastEvent for chart compatibility
export function roastEventDataToRoastEvent(eventData: RoastEventData[]): RoastEvent[] {
	return eventData
		.filter((event) => event.category === 'milestone')
		.map((event) => ({
			time: secondsToMs(event.time_seconds),
			name:
				event.event_string.charAt(0).toUpperCase() + event.event_string.slice(1).replace('_', ' ')
		}));
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
