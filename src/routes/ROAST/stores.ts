import { writable } from 'svelte/store';

export interface RoastPoint {
	time: number;
	heat?: number;
	fan?: number;
}

export interface RoastEvent {
	time: number;
	name: string;
}

export const roastData = writable<RoastPoint[]>([]);
export const roastEvents = writable<RoastEvent[]>([]);
export const startTime = writable<number | null>(null);
export const isRoasting = writable(false);
export const accumulatedTime = writable<number>(0);
