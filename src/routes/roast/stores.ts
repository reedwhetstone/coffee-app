import { writable } from 'svelte/store';

export interface RoastPoint {
	time: number;
	heat: number;
	fan: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	data_source?: 'live' | 'artisan_import';
}

export interface RoastEvent {
	time: number;
	name: string;
}

export interface ProfileLogEntry {
	roast_id?: number;
	fan_setting: number;
	heat_setting: number;
	start: boolean;
	maillard: boolean;
	fc_start: boolean;
	fc_rolling: boolean;
	fc_end: boolean;
	sc_start: boolean;
	drop: boolean;
	end: boolean;
	time: number;
	bean_temp?: number | null;
	environmental_temp?: number | null;
	time_seconds?: number;
	data_source?: string;
	charge?: boolean;
}

export const roastData = writable<RoastPoint[]>([]);
export const roastEvents = writable<RoastEvent[]>([]);
export const startTime = writable<number | null>(null);
export const isRoasting = writable(false);
export const accumulatedTime = writable<number>(0);
export const profileLogs = writable<ProfileLogEntry[]>([]);

export function msToMySQLTime(ms: number): string {
	// Ensure we're working with a finite number
	ms = Math.round(ms);

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const milliseconds = Math.floor(ms % 1000); // Round milliseconds

	// Format with exactly 3 decimal places for milliseconds
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function mysqlTimeToMs(timeStr: string): number {
	const [time, fraction = '0'] = timeStr.split('.');
	const [hours, minutes, seconds] = time.split(':').map(Number);

	return (
		hours * 3600000 + // Convert hours to milliseconds
		minutes * 60000 + // Convert minutes to milliseconds
		seconds * 1000 + // Convert seconds to milliseconds
		Number(fraction.padEnd(3, '0').slice(0, 3)) // Handle milliseconds properly
	);
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

// Extract milestone times from profile logs (handles both live and saved data)
export function extractMilestones(logs: ProfileLogEntry[], isLiveData = true): MilestoneData {
	const milestones: MilestoneData = {};

	for (const log of logs) {
		const time = isLiveData ? log.time : mysqlTimeToMs(log.time as unknown as string);

		if (log.start) milestones.start = time;
		if (log.charge) milestones.charge = time;
		if (log.maillard) milestones.maillard = time;
		if (log.fc_start) milestones.fc_start = time;
		if (log.fc_end) milestones.fc_end = time;
		if (log.sc_start) milestones.sc_start = time;
		if (log.drop) milestones.drop = time;
		if (log.end) milestones.end = time;
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
