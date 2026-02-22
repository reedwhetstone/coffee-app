/**
 * Roast Session State Manager
 *
 * Manages the data lifecycle of a roast session: temperature entries,
 * event entries, control values, and derived chart data.
 *
 * Coordinates with a RoastTimer for timestamped data logging.
 * Replaces the writable stores in routes/roast/stores.ts with
 * Svelte 5 rune-based state.
 *
 * Usage:
 *   const timer = createRoastTimer();
 *   const session = createRoastSession();
 *   session.start(timer, roastId);
 *   session.logMilestone('charge', timer.elapsed);
 *   session.logControl('fan', 5, timer.elapsed);
 */

import type { TemperatureEntry, RoastEventEntry, RoastPoint, MilestoneData } from './roast-types';
import { extractMilestones, calculatePhasePercentages, msToSeconds } from './roast-math';
import { convertToChartData } from './roast-data';
import type { RoastTimer } from './roast-timer.svelte';

export interface RoastSessionState {
	readonly temperatureEntries: TemperatureEntry[];
	readonly eventEntries: RoastEventEntry[];
	readonly roastData: RoastPoint[];
	readonly roastEvents: { time: number; name: string }[];
	readonly milestones: MilestoneData;
	readonly fanValue: number;
	readonly heatValue: number;
	readonly roastId: number;
}

export function createRoastSession() {
	let temperatureEntries = $state<TemperatureEntry[]>([]);
	let eventEntries = $state<RoastEventEntry[]>([]);
	let liveRoastData = $state<RoastPoint[]>([]);
	let fanValue = $state(0);
	let heatValue = $state(0);
	let roastId = $state(0);

	// Data logging interval for live recording
	let dataLoggingInterval: ReturnType<typeof setInterval> | null = null;
	let activeTimer: RoastTimer | null = null;

	// Derived: chart-ready data from entries
	const chartData = $derived.by(() => {
		if (temperatureEntries.length === 0 && liveRoastData.length === 0) {
			return { roastData: [] as RoastPoint[], roastEvents: [] as { time: number; name: string }[] };
		}
		// If we have temperature entries (loaded/imported data), convert them
		if (temperatureEntries.length > 0) {
			return convertToChartData(temperatureEntries, eventEntries);
		}
		// During live recording, use the raw roastData
		return {
			roastData: liveRoastData,
			roastEvents: eventEntries
				.filter((e) => e.category === 'milestone')
				.map((e) => ({
					time: e.time_seconds * 1000,
					name: e.event_string.charAt(0).toUpperCase() + e.event_string.slice(1).replace(/_/g, ' ')
				}))
		};
	});

	// Derived: milestone data from events
	const milestones = $derived(extractMilestones(eventEntries));

	// Derived: phase percentages
	const phasePercentages = $derived.by(() => {
		const m = milestones;
		if (!m.charge && !m.start) return null;
		return calculatePhasePercentages(m);
	});

	/**
	 * Start a live recording session.
	 * Creates initial start event and temperature entry.
	 */
	function start(timer: RoastTimer, id: number) {
		roastId = id;
		activeTimer = timer;

		// Create initial start event
		eventEntries = [
			{
				roast_id: id,
				time_seconds: 0,
				event_type: 10,
				event_value: null,
				event_string: 'start',
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: true,
				automatic: false
			}
		];

		// Create initial temperature entry
		temperatureEntries = [
			{
				roast_id: id,
				time_seconds: 0,
				bean_temp: null,
				environmental_temp: null,
				ambient_temp: null,
				ror_bean_temp: null,
				data_source: 'live'
			}
		];

		// Start data logging at 2-second intervals
		dataLoggingInterval = setInterval(() => {
			if (activeTimer && activeTimer.isRunning) {
				liveRoastData = [
					...liveRoastData,
					{
						time: activeTimer.elapsed,
						heat: heatValue,
						fan: fanValue
					}
				];
			}
		}, 2000);
	}

	/**
	 * Pause data logging. Call when timer is paused.
	 */
	function pauseLogging() {
		if (dataLoggingInterval) {
			clearInterval(dataLoggingInterval);
			dataLoggingInterval = null;
		}
	}

	/**
	 * Resume data logging. Call when timer resumes.
	 */
	function resumeLogging() {
		if (dataLoggingInterval) clearInterval(dataLoggingInterval);
		dataLoggingInterval = setInterval(() => {
			if (activeTimer && activeTimer.isRunning) {
				liveRoastData = [
					...liveRoastData,
					{
						time: activeTimer.elapsed,
						heat: heatValue,
						fan: fanValue
					}
				];
			}
		}, 2000);
	}

	/**
	 * Log a milestone event (charge, dry_end, fc_start, drop, etc.)
	 */
	function logMilestone(name: string, timeMs: number) {
		const timeSeconds = msToSeconds(timeMs);
		const milestoneEvent: RoastEventEntry = {
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: name.toLowerCase().replace(/\s+/g, '_'),
			category: 'milestone',
			subcategory: 'roast_phase',
			user_generated: true,
			automatic: false
		};

		// Also log current control values at this milestone
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
				event_value: name === 'drop' ? '0' : heatValue.toString(),
				event_string: 'heat_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		eventEntries = [...eventEntries, milestoneEvent, ...controlEvents];
	}

	/**
	 * Log a control change event (fan or heat setting).
	 */
	function logControl(controlType: 'fan' | 'heat', value: number, timeMs: number) {
		const timeSeconds = msToSeconds(timeMs);
		const event: RoastEventEntry = {
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: value.toString(),
			event_string: controlType === 'fan' ? 'fan_setting' : 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		};
		eventEntries = [...eventEntries, event];

		if (controlType === 'fan') fanValue = value;
		else heatValue = value;
	}

	/**
	 * Load saved data (for viewing a completed roast).
	 */
	function loadSavedData(temps: TemperatureEntry[], events: RoastEventEntry[], id: number) {
		roastId = id;
		temperatureEntries = temps;
		eventEntries = events;
		liveRoastData = [];
	}

	/**
	 * Set control values without logging an event.
	 */
	function setFan(value: number) {
		fanValue = value;
	}

	function setHeat(value: number) {
		heatValue = value;
	}

	/**
	 * Reset all session state.
	 */
	function reset() {
		if (dataLoggingInterval) {
			clearInterval(dataLoggingInterval);
			dataLoggingInterval = null;
		}
		activeTimer = null;
		temperatureEntries = [];
		eventEntries = [];
		liveRoastData = [];
		fanValue = 0;
		heatValue = 0;
		roastId = 0;
	}

	/**
	 * Destroy the session (cleanup intervals).
	 */
	function destroy() {
		if (dataLoggingInterval) {
			clearInterval(dataLoggingInterval);
			dataLoggingInterval = null;
		}
		activeTimer = null;
	}

	return {
		// Reactive getters
		get temperatureEntries() {
			return temperatureEntries;
		},
		get eventEntries() {
			return eventEntries;
		},
		get roastData() {
			return chartData.roastData;
		},
		get roastEvents() {
			return chartData.roastEvents;
		},
		get milestones() {
			return milestones;
		},
		get phasePercentages() {
			return phasePercentages;
		},
		get fanValue() {
			return fanValue;
		},
		get heatValue() {
			return heatValue;
		},
		get roastId() {
			return roastId;
		},

		// Methods
		start,
		pauseLogging,
		resumeLogging,
		logMilestone,
		logControl,
		loadSavedData,
		setFan,
		setHeat,
		reset,
		destroy
	};
}

export type RoastSession = ReturnType<typeof createRoastSession>;
