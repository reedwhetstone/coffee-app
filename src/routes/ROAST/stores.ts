import { writable } from 'svelte/store';

export interface RoastPoint {
	time: number;
	heat: number;
	fan: number;
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
	end: boolean;
	time: number;
}

export const roastData = writable<RoastPoint[]>([]);
export const roastEvents = writable<RoastEvent[]>([]);
export const startTime = writable<number | null>(null);
export const isRoasting = writable(false);
export const accumulatedTime = writable<number>(0);
export const profileLogs = writable<ProfileLogEntry[]>([]);
