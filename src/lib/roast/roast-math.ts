/**
 * Pure mathematical functions for roast data processing.
 *
 * No Svelte, no DOM, no side effects. Every function is deterministic
 * given its inputs. This makes them trivially unit-testable and reusable
 * across the /roast page, GenUI blocks, and API routes.
 */

import type {
	RoastPoint,
	RoastEventEntry,
	MilestoneData,
	MilestoneCalculations,
	TimeValuePoint
} from './roast-types';

// ─── Time Utilities ──────────────────────────────────────────────────────────

/** Convert milliseconds to seconds */
export function msToSeconds(ms: number): number {
	return ms / 1000;
}

/** Convert seconds to milliseconds */
export function secondsToMs(seconds: number): number {
	return seconds * 1000;
}

/** Format milliseconds to MM:SS display string */
export function formatTimeDisplay(ms: number): string {
	if (!ms || ms <= 0) return '--:--';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Convert time to charge-relative minutes for chart X axis */
export function chargeRelativeMinutes(timeMs: number, chargeTimeMs: number): number {
	return (timeMs - chargeTimeMs) / (1000 * 60);
}

// ─── Temperature Utilities ───────────────────────────────────────────────────

/** Convert Fahrenheit to Celsius */
export function fahrenheitToCelsius(tempF: number): number {
	return Math.round(((tempF - 32) * 5.0) / 9.0 * 100) / 100;
}

/** Convert Celsius to Fahrenheit */
export function celsiusToFahrenheit(tempC: number): number {
	return Math.round((tempC * 9.0 / 5.0 + 32) * 100) / 100;
}

// ─── Smoothing ───────────────────────────────────────────────────────────────

/**
 * Sliding window average smoother.
 * Works on any { time, value } array. Used for both temperature
 * smoothing and RoR smoothing.
 */
export function smoothData(
	data: TimeValuePoint[],
	windowSize: number
): TimeValuePoint[] {
	if (data.length === 0) return [];

	const result: TimeValuePoint[] = [];

	for (let i = 0; i < data.length; i++) {
		const start = Math.max(0, i - Math.floor(windowSize / 2));
		const end = Math.min(data.length, i + Math.ceil(windowSize / 2));

		let sum = 0;
		let count = 0;

		for (let j = start; j < end; j++) {
			sum += data[j].value;
			count++;
		}

		result.push({
			time: data[i].time,
			value: sum / count
		});
	}

	return result;
}

// ─── Rate of Rise ────────────────────────────────────────────────────────────

/**
 * Calculate Rate of Rise (RoR / delta-BT) from temperature data.
 *
 * Pipeline: filter valid temps → smooth (15pt) → differentiate → filter range → smooth (10pt)
 *
 * @param data - Array of RoastPoint with bean_temp values
 * @param chargeTime - Charge time in ms (RoR starts here)
 * @param dropTime - Drop time in ms (RoR ends here), null if ongoing
 * @param tempWindowSize - Smoothing window for temperature data (default 15)
 * @param rorWindowSize - Smoothing window for RoR values (default 10)
 * @param maxRoR - Maximum reasonable RoR value to include (default 50)
 * @returns Array of { time, value } where value is °F/min (or °C/min)
 */
export function calculateRoR(
	data: RoastPoint[],
	chargeTime: number,
	dropTime: number | null,
	tempWindowSize = 15,
	rorWindowSize = 10,
	maxRoR = 50
): TimeValuePoint[] {
	// Step 1: Extract valid bean temperature data
	const validTempData: TimeValuePoint[] = data
		.filter(
			(point) => point.bean_temp !== null && point.bean_temp !== undefined && point.bean_temp > 0
		)
		.map((point) => ({ time: point.time, value: point.bean_temp! }));

	if (validTempData.length < tempWindowSize) return [];

	// Step 2: Pre-smooth temperature data to reduce noise
	const smoothedTempData = smoothData(validTempData, tempWindowSize);

	// Step 3: Calculate raw RoR from temperature differences
	const rawRorData: TimeValuePoint[] = [];

	for (let i = 1; i < smoothedTempData.length; i++) {
		const current = smoothedTempData[i];
		const previous = smoothedTempData[i - 1];

		const timeDiffMinutes = (current.time - previous.time) / (1000 * 60);
		const tempDiff = current.value - previous.value;

		if (timeDiffMinutes > 0) {
			const ror = tempDiff / timeDiffMinutes;

			// Filter by charge/drop time range
			let includePoint = true;
			if (chargeTime > 0 && dropTime !== null && dropTime > 0) {
				includePoint = current.time >= chargeTime && current.time <= dropTime;
			} else if (chargeTime > 0) {
				includePoint = current.time >= chargeTime;
			}

			// Only include reasonable positive RoR values
			if (includePoint && ror > 0 && Math.abs(ror) <= maxRoR) {
				rawRorData.push({ time: current.time, value: ror });
			}
		}
	}

	if (rawRorData.length === 0) return [];

	// Step 4: Smooth RoR values
	return smoothData(rawRorData, rorWindowSize);
}

// ─── Milestones ──────────────────────────────────────────────────────────────

/**
 * Extract milestone times (in ms) from event entries.
 * Maps event_string names to MilestoneData fields.
 */
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
				case 'maillard':
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
				case 'end':
					milestones.end = timeMs;
					break;
			}
		}
	}

	return milestones;
}

/**
 * Calculate roast phase percentages from milestone data.
 *
 * Phases:
 * - Drying: charge/start → turning point (maillard/dry_end)
 * - Maillard: turning point → first crack start
 * - Development: first crack start → drop/end
 *
 * @param milestones - Extracted milestone times
 * @param currentTime - Current elapsed time (for live roasts), undefined for completed
 */
export function calculatePhasePercentages(
	milestones: MilestoneData,
	currentTime?: number
): MilestoneCalculations {
	const start = milestones.charge || milestones.start || 0;
	const drop = milestones.drop || milestones.end || 0;

	// For live roasts, use current time if drop hasn't happened yet
	const effectiveEndTime = currentTime && currentTime > 0 && !drop ? currentTime : drop;
	const totalTime = effectiveEndTime - start;

	const tpTime = milestones.maillard || 0;
	const fcTime = milestones.fc_start || 0;

	let dryingPercent = 0;
	let maillardPercent = 0;
	let devPercent = 0;

	if (totalTime > 0) {
		if (tpTime > start) {
			dryingPercent = ((tpTime - start) / totalTime) * 100;
		}

		if (fcTime > tpTime && tpTime > 0) {
			maillardPercent = ((fcTime - tpTime) / totalTime) * 100;
		}

		if (fcTime > 0) {
			const devEndTime = effectiveEndTime;
			if (devEndTime > fcTime) {
				devPercent = ((devEndTime - fcTime) / totalTime) * 100;
			}
		}
	}

	return {
		totalTime,
		dryingPercent,
		tpTime: tpTime > 0 ? tpTime - start : 0,
		maillardPercent,
		fcTime: fcTime > 0 ? fcTime - start : 0,
		devPercent
	};
}

// ─── Charge Time Detection ───────────────────────────────────────────────────

/**
 * Find the charge time from events and/or data points.
 * Priority: milestone events → data point flags → first data point → 0
 */
export function findChargeTime(
	events: RoastEventEntry[],
	data: RoastPoint[]
): number {
	// Priority 1: Extract from milestone events
	if (events.length > 0) {
		const milestones = extractMilestones(events);
		if (milestones.charge && !isNaN(milestones.charge) && isFinite(milestones.charge)) {
			return milestones.charge;
		}
		if (milestones.start && !isNaN(milestones.start) && isFinite(milestones.start)) {
			return milestones.start;
		}
	}

	// Priority 2: Look for charge flag in data points (Artisan imports)
	const chargePoint = data.find(
		(point) => point.data_source === 'artisan_import' && point.charge
	);
	if (chargePoint && !isNaN(chargePoint.time) && isFinite(chargePoint.time)) {
		return chargePoint.time;
	}

	// Priority 3: Any charge-flagged data point
	const anyChargePoint = data.find((point) => point.charge);
	if (anyChargePoint && !isNaN(anyChargePoint.time) && isFinite(anyChargePoint.time)) {
		return anyChargePoint.time;
	}

	// Priority 4: First data point
	if (data.length > 0 && !isNaN(data[0].time) && isFinite(data[0].time)) {
		return data[0].time;
	}

	return 0;
}

// ─── Event Name Formatting ───────────────────────────────────────────────────

/** Normalize event names for database storage (lowercase, underscores) */
export function normalizeEventName(eventName: string): string {
	return eventName.toLowerCase().replace(/\s+/g, '_');
}

/** Format event_string for display (Title Case, spaces) */
export function formatDisplayName(eventString: string): string {
	return eventString
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

/** Map external control names (Artisan) to standardized names */
export function mapControlName(eventString: string): string {
	const mappings: Record<string, string> = {
		burner: 'heat',
		air: 'fan'
	};
	return mappings[eventString] || eventString;
}

// ─── RoR at Point ────────────────────────────────────────────────────────────

/**
 * Calculate instantaneous RoR at a specific data point index.
 * Used for tooltip display.
 */
export function calculateRoRAtPoint(
	data: Array<{ time: number; bean_temp: number | null | undefined }>,
	index: number,
	lookback = 5
): number | null {
	if (index < lookback || !data[index]?.bean_temp) return null;

	const current = data[index];
	const previous = data[index - lookback];

	if (!previous?.bean_temp || !current.bean_temp) return null;

	const timeDiffMinutes = (current.time - previous.time) / (1000 * 60);
	if (timeDiffMinutes <= 0) return null;

	const ror = (current.bean_temp - previous.bean_temp) / timeDiffMinutes;
	return ror > 0 && ror <= 50 ? Math.round(ror * 10) / 10 : null;
}
