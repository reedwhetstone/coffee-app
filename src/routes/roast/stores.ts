import { writable } from 'svelte/store';

export interface RoastPoint {
	time: number;
	heat: number;
	fan: number;
	bean_temp?: number | null;
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
