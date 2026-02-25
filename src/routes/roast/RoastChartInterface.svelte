<script lang="ts">
	import { untrack } from 'svelte';
	import MilestoneBar from '$lib/components/roast/MilestoneBar.svelte';
	import RoastControls from '$lib/components/roast/RoastControls.svelte';
	import EventTimeline from '$lib/components/roast/EventTimeline.svelte';
	import ArtisanImportDialog from '$lib/components/roast/ArtisanImportDialog.svelte';
	import RoastTooltip from '$lib/components/roast/RoastTooltip.svelte';
	import { RoastChart, prepareChartData } from '$lib/components/roast/chart';
	import type { TemperaturePoint } from '$lib/types/d3.types';
	import type { RoastProfile } from '$lib/types/component.types';
	import {
		roastData,
		roastEvents,
		temperatureEntries,
		eventEntries,
		type RoastPoint,
		type TemperatureEntry,
		type RoastEventEntry,
		msToSeconds,
		secondsToMs,
		extractMilestones
	} from './stores';
	import type { RoastTimer } from '$lib/roast';
	// Import the new RawChartData interface for frontend processing
	import type { RawChartData } from '../api/roast-chart-data/+server.js';

	// Normalize event names for database storage - minimal formatting only
	function normalizeEventName(eventName: string): string {
		// Only do basic formatting: lowercase and replace spaces with underscores
		return eventName.toLowerCase().replace(/\s+/g, '_');
	}

	// Frontend formatting utility - visible and maintainable
	function formatDisplayName(eventString: string): string {
		return eventString
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	// Frontend control mapping configuration - visible and adjustable
	const CONTROL_MAPPING = {
		useSimplified: true, // User preference
		mappings: {
			burner: 'heat',
			air: 'fan'
		}
	};

	function getControlMapping(eventString: string): string {
		// TODO: Evaluate if these conversions are actually necessary
		// Current mapping preserves existing chart functionality
		if (CONTROL_MAPPING.useSimplified) {
			return (
				CONTROL_MAPPING.mappings[eventString as keyof typeof CONTROL_MAPPING.mappings] ||
				eventString
			);
		}
		return eventString; // Use raw event_string if no mapping needed
	}

	// Define milestone interfaces locally to avoid import issues
	interface MilestoneData {
		start?: number;
		charge?: number;
		maillard?: number;
		fc_start?: number;
		fc_end?: number;
		sc_start?: number;
		drop?: number;
		end?: number;
	}

	interface MilestoneCalculations {
		totalTime: number;
		dryingPercent: number;
		tpTime: number;
		maillardPercent: number;
		fcTime: number;
		devPercent: number;
	}

	// Define the functions locally to avoid import issues
	// Remove local extractMilestones - now using import from stores

	function calculateMilestones(
		milestones: MilestoneData,
		currentTime?: number
	): MilestoneCalculations {
		// Use charge time if available, otherwise fall back to start time
		const start = milestones.charge || milestones.start || 0;
		const drop = milestones.drop || milestones.end || 0;

		// For live calculations, use current elapsed time if roast is ongoing
		// For completed roasts, use actual drop time
		const effectiveEndTime = currentTime && currentTime > 0 && !drop ? currentTime : drop;
		const totalTime = effectiveEndTime - start;

		const tpTime = milestones.maillard || 0;
		const fcTime = milestones.fc_start || 0;

		let dryingPercent = 0;
		let maillardPercent = 0;
		let devPercent = 0;

		if (totalTime > 0) {
			// DRYING % = time from start/charge to turning point (maillard)
			if (tpTime > start) {
				dryingPercent = ((tpTime - start) / totalTime) * 100;
			}

			// MAILLARD % = time from turning point to first crack
			if (fcTime > tpTime && tpTime > 0) {
				maillardPercent = ((fcTime - tpTime) / totalTime) * 100;
			}

			// DEV % = time from first crack to current time (live) or drop (completed)
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
			tpTime: tpTime - start, // Relative time from start/charge
			maillardPercent,
			fcTime: fcTime - start, // Relative time from start/charge
			devPercent
		};
	}

	let {
		timer,
		fanValue = $bindable(),
		heatValue = $bindable(),
		currentRoastProfile = $bindable(null),
		selectedEvent = $bindable(null),
		updateFan,
		updateHeat,
		saveRoastProfile,
		selectedBean,
		clearRoastData
	}: {
		timer: RoastTimer;
		fanValue: number;
		heatValue: number;
		currentRoastProfile?: RoastProfile | null;
		selectedEvent?: string | null;
		updateFan: (value: number) => void;
		updateHeat: (value: number) => void;
		saveRoastProfile: () => Promise<void>;
		selectedBean: { id?: number; name: string };
		clearRoastData: () => void;
	} = $props();

	// Derive roasting state from timer
	let isRoasting = $derived(!timer.isIdle);
	let isPaused = $derived(timer.isPaused);

	// Artisan import dialog ref
	let artisanImportDialog = $state<ArtisanImportDialog>();

	let dataLoggingInterval: ReturnType<typeof setInterval> | null = null;

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = $state(false);
	const LONG_PRESS_DURATION = 1000;

	// Saved profile data for milestone calculations
	interface EventValuePoint {
		time_seconds: number;
		value: number;
	}

	interface EventValueSeries {
		event_string: string;
		category: string;
		values: EventValuePoint[];
		value_range: {
			min: number;
			max: number;
			detected_scale: string;
		};
	}

	let savedTemperatureEntries = $state<TemperatureEntry[]>([]);
	let savedEventEntries = $state<RoastEventEntry[]>([]);
	let savedEventValueSeries = $state<EventValueSeries[]>([]);

	// Chart boundary settings from roast_profiles table
	let chartSettings = $state<{
		xRange: [number | null, number | null];
		yRange: [number | null, number | null];
		zRange: [number | null, number | null];
	} | null>(null);

	// Tooltip state for mouse interactions (only for saved data viewing)
	let tooltipState = $state({
		visible: false,
		x: 0,
		y: 0,
		data: null as TemperaturePoint | null
	});

	// Event feedback message state
	let eventFeedback = $state<{ message: string; type: 'success' | 'info' } | null>(null);
	let eventFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	function showEventFeedback(message: string, type: 'success' | 'info' = 'success') {
		// Clear any existing timeout
		if (eventFeedbackTimeout) {
			clearTimeout(eventFeedbackTimeout);
		}
		eventFeedback = { message, type };
		eventFeedbackTimeout = setTimeout(() => {
			eventFeedback = null;
		}, 3000);
	}

	// Add these computed values - check for saved data to determine state
	let isBeforeRoasting = $derived(
		!currentRoastProfile?.roast_id || (savedEventEntries.length === 0 && $roastData.length === 0)
	);
	let isDuringRoasting = $derived(isRoasting);

	// Prepared chart data for LayerCake rendering
	let preparedChartData = $derived(
		prepareChartData({
			roastData: $roastData,
			events: isDuringRoasting ? $eventEntries : savedEventEntries,
			roastEvents: $roastEvents,
			savedEventValueSeries: savedEventValueSeries,
			chartSettings: chartSettings,
			isDuringRoasting: isDuringRoasting
		})
	);

	// Compute current time in charge-relative minutes for the time tracker
	let currentTimeMinutes = $derived.by(() => {
		if (!isRoasting || isPaused) return 0;
		const chargeTime = preparedChartData.chargeTime;
		return (timer.elapsed - chargeTime) / (1000 * 60);
	});

	// Handle profile changes
	$effect(() => {
		if (currentRoastProfile && isBeforeRoasting) {
			untrack(() => {
				resetTimer();
				// Load chart settings for the current profile even before roasting starts
				if (currentRoastProfile.roast_id) {
					loadChartSettings(currentRoastProfile.roast_id);
				}
			});
		}
	});

	// Timer function
	function startDataLogging() {
		if (dataLoggingInterval) clearInterval(dataLoggingInterval);
		dataLoggingInterval = setInterval(() => {
			$roastData = [
				...$roastData,
				{
					time: timer.elapsed,
					heat: heatValue,
					fan: fanValue
				}
			];
		}, 2000);
	}

	function stopDataLogging() {
		if (dataLoggingInterval) clearInterval(dataLoggingInterval);
		dataLoggingInterval = null;
	}

	function toggleTimer() {
		if (timer.isIdle) {
			// Initial start — initialize data stores
			$eventEntries = [
				{
					roast_id: currentRoastProfile?.roast_id || 0,
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

			$temperatureEntries = [
				{
					roast_id: currentRoastProfile?.roast_id || 0,
					time_seconds: 0,
					bean_temp: null,
					environmental_temp: null,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'live'
				}
			];

			timer.start();
			startDataLogging();
		} else if (timer.isRunning) {
			// Pausing
			timer.pause();
			stopDataLogging();
		} else if (timer.isPaused) {
			// Resuming
			timer.resume();
			startDataLogging();
		}
	}

	function resetTimer() {
		stopDataLogging();
		timer.reset();
		$roastData = [];
		$roastEvents = [];
		$temperatureEntries = [];
		$eventEntries = [];
	}

	// Timer display from module (rAF-based, CPU-efficient)
	let formattedTime = $derived(timer.formattedTime);

	// Update current values when roastData changes
	$effect(() => {
		if ($roastData.length > 0 && isDuringRoasting) {
			const lastDataPoint = $roastData[$roastData.length - 1];
			fanValue = lastDataPoint.fan;
			heatValue = lastDataPoint.heat;
		}
	});

	function handleEventLog(event: string) {
		if (timer.isIdle || !currentRoastProfile?.roast_id) return;

		selectedEvent = event;
		const currentTime = timer.elapsed;

		// Check if this event already exists at this time
		const existingEvent = $roastEvents.find(
			(e) => e.name === event && Math.abs(e.time - currentTime) < 1000
		);

		if (existingEvent) return; // Event already logged

		// Add to roastEvents for chart display
		$roastEvents = [...$roastEvents, { time: currentTime, name: event }];

		// Create milestone and control events
		const timeSeconds = msToSeconds(currentTime);
		const roastId = currentRoastProfile.roast_id;

		// Handle special event behaviors
		if (event === 'Drop') {
			heatValue = 0; // Set heat to 0 when Drop is logged
		} else if (event === 'Cool End') {
			// Just pause the timer like the stop button - user will save manually
			timer.pause();
			stopDataLogging();
			// Show visual feedback
			showEventFeedback(
				'Cool End logged - Timer paused. Click "Save Roast" to save your data.',
				'success'
			);
		}

		// Create milestone event
		const milestoneEvent: RoastEventEntry = {
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 10,
			event_value: null,
			event_string: normalizeEventName(event),
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
				event_value: event === 'Drop' ? '0' : heatValue.toString(),
				event_string: 'heat_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		// Add all events to store
		$eventEntries = [...$eventEntries, milestoneEvent, ...controlEvents];
	}

	// Add this function to handle settings changes
	function handleSettingsChange() {
		if (timer.isIdle) return;

		const currentTime = timer.elapsed;

		// Create control event entries for settings change
		const timeSeconds = msToSeconds(currentTime);
		const roastId = currentRoastProfile?.roast_id || 0;

		const controlEvents: RoastEventEntry[] = [];

		controlEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: fanValue.toString(),
			event_string: 'fan_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		});

		controlEvents.push({
			roast_id: roastId,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: heatValue.toString(),
			event_string: 'heat_setting',
			category: 'control',
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		});

		$eventEntries = [...$eventEntries, ...controlEvents];
	}

	// Simplify the handlers to use props directly
	function handleFanChange(value: number) {
		updateFan(value);
		handleSettingsChange();
	}

	function handleHeatChange(value: number) {
		updateHeat(value);
		handleSettingsChange();
	}

	// Reactive milestone calculations using SvelteKit 5 syntax
	let milestoneCalculations = $derived(() => {
		// For completed roasts, prefer database values from roast_profiles
		if (!isDuringRoasting && currentRoastProfile) {
			const profile = currentRoastProfile;

			// Check if we have calculated milestone data in the database
			const hasDbData =
				profile.dry_percent !== null ||
				profile.maillard_percent !== null ||
				profile.development_percent !== null;

			if (hasDbData) {
				// Convert database times to milliseconds and calculate relative display times
				const chargeTime = (profile.charge_time || 0) * 1000;
				const dryEndTime = (profile.dry_end_time || 0) * 1000;
				const fcStartTime = (profile.fc_start_time || 0) * 1000;

				return {
					totalTime: (profile.total_roast_time || 0) * 1000,
					dryingPercent: profile.dry_percent || 0,
					tpTime: dryEndTime - chargeTime, // Relative time from charge for display
					maillardPercent: profile.maillard_percent || 0,
					fcTime: fcStartTime - chargeTime, // Relative time from charge for display
					devPercent: profile.development_percent || 0
				};
			}
		}

		// Fallback to live calculations for active roasting or when no DB data available
		const events = isDuringRoasting ? $eventEntries : savedEventEntries;

		// Include timer elapsed in dependency to trigger updates during live roasting
		void timer.elapsed;

		if (events.length === 0) {
			return {
				totalTime: 0,
				dryingPercent: 0,
				tpTime: 0,
				maillardPercent: 0,
				fcTime: 0,
				devPercent: 0
			};
		}

		const milestones = extractMilestones(events);

		// For live calculations, pass current elapsed time
		const currentElapsedTime = isDuringRoasting ? timer.elapsed : 0;

		return calculateMilestones(milestones, isDuringRoasting ? currentElapsedTime : undefined);
	});

	// Convert temperature entries and events to roast data format for chart display
	function convertToRoastData(
		temperatures: TemperatureEntry[],
		events: RoastEventEntry[]
	): RoastPoint[] {
		// Sort control events by time for carry-forward logic - handle string/number conversion
		const fanEvents = events
			.filter((e) => e.event_string === 'fan_setting')
			.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));
		const heatEvents = events
			.filter((e) => e.event_string === 'heat_setting')
			.sort((a, b) => parseFloat(String(a.time_seconds)) - parseFloat(String(b.time_seconds)));

		// If no temperature data, create minimal data points from events for timeline
		if (temperatures.length === 0 && events.length > 0) {
			// Get all unique time points from events
			const allTimes = [...new Set(events.map((e) => parseFloat(String(e.time_seconds))))].sort(
				(a, b) => a - b
			);

			return allTimes.map((timeSeconds) => {
				// Find the most recent control event before or at this time (carry-forward logic)
				const fanEvent = fanEvents
					.filter((e) => parseFloat(String(e.time_seconds)) <= timeSeconds)
					.pop();
				const heatEvent = heatEvents
					.filter((e) => parseFloat(String(e.time_seconds)) <= timeSeconds)
					.pop();

				// Find milestone events at this time
				const milestoneEvents = events.filter(
					(e) =>
						e.category === 'milestone' &&
						Math.abs(parseFloat(String(e.time_seconds)) - timeSeconds) < 1
				);

				return {
					time: secondsToMs(timeSeconds),
					heat: heatEvent ? parseInt(heatEvent.event_value || '0') : 0,
					fan: fanEvent ? parseInt(fanEvent.event_value || '0') : 0,
					bean_temp: null, // No temperature data for legacy app records
					environmental_temp: null,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'live' as const,
					// Include milestone flags for charge detection
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
		}

		// Normal case: process temperature entries with event data
		return temperatures.map((temp) => {
			const tempTimeSeconds = parseFloat(String(temp.time_seconds));

			// Find the most recent control event before or at this time (carry-forward logic)
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
				// Include milestone flags for charge detection
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
	}

	// Load chart settings from roast_profiles table
	async function loadChartSettings(roastId: number) {
		try {
			// Get chart settings directly from the database
			const response = await fetch(`/api/roast-chart-settings?roastId=${roastId}`);
			let settings = null;

			if (response.ok) {
				const result = await response.json();
				settings = result.settings;
			}

			if (settings) {
				// Normalize xRange to minutes if values appear to be in seconds
				let xMin = settings.xRange[0];
				let xMax = settings.xRange[1];
				const looksLikeSeconds =
					xMin !== null &&
					xMax !== null &&
					typeof xMin === 'number' &&
					typeof xMax === 'number' &&
					(xMin > 60 || xMax > 60);

				if (looksLikeSeconds) {
					xMin = xMin !== null ? xMin / 60 : xMin;
					xMax = xMax !== null ? xMax / 60 : xMax;
				}

				chartSettings = {
					xRange: [xMin, xMax],
					yRange: [settings.yRange[0], settings.yRange[1]],
					zRange: [settings.zRange[0], settings.zRange[1]]
				};
				console.log('Loaded chart settings:', chartSettings);
			} else {
				chartSettings = null;
				console.log('No chart settings found, using defaults');
			}
		} catch (error) {
			console.error('Error loading chart settings:', error);
			chartSettings = null;
		}
	}

	// Load saved roast data using the new simplified API endpoint
	// Load saved roast data using the new simplified API endpoint with frontend processing
	async function loadSavedRoastData(roastId: number) {
		try {
			const startTime = performance.now();

			// Use the new raw chart data API endpoint
			const response = await fetch(`/api/roast-chart-data?roastId=${roastId}`);
			if (!response.ok) {
				throw new Error(`Failed to load roast data: ${response.status}`);
			}

			const rawData: RawChartData = await response.json();
			console.log(`=== RAW CHART DATA FRONTEND: Roast ${roastId} ===`);
			console.log('Raw data points:', rawData.rawData?.length || 0);
			console.log('API performance:', rawData.metadata?.performanceMetrics);

			const processingStart = performance.now();

			// Frontend processing - transparent and maintainable
			const temperatureData: TemperatureEntry[] = [];
			const milestoneEvents: RoastEventEntry[] = [];
			const controlSeries = new Map<string, EventValuePoint[]>();

			// Process raw data with frontend logic - times already in milliseconds from DB
			rawData.rawData?.forEach((row) => {
				const timeMs = row.time_milliseconds; // Already in milliseconds from corrected DB function
				const timeSeconds = timeMs / 1000; // Convert to seconds for internal data structures

				if (row.data_type === 'temperature') {
					// Build temperature entries
					let tempEntry = temperatureData.find((t) => t.time_seconds === timeSeconds);
					if (!tempEntry) {
						tempEntry = {
							roast_id: roastId,
							time_seconds: timeSeconds,
							bean_temp: null,
							environmental_temp: null,
							ambient_temp: null,
							ror_bean_temp: null,
							data_source: 'live' as const
						};
						temperatureData.push(tempEntry);
					}
					// Map field names to temperature entry properties
					if (row.field_name === 'bean_temp') tempEntry.bean_temp = row.value_numeric;
					else if (row.field_name === 'environmental_temp')
						tempEntry.environmental_temp = row.value_numeric;
					else if (row.field_name === 'ambient_temp') tempEntry.ambient_temp = row.value_numeric;
					else if (row.field_name === 'ror_bean_temp') tempEntry.ror_bean_temp = row.value_numeric;
				} else if (row.data_type === 'milestone') {
					milestoneEvents.push({
						roast_id: roastId,
						time_seconds: timeSeconds,
						event_type: 10,
						event_value: null,
						event_string: row.event_string || '',
						category: 'milestone' as const,
						subcategory: 'roast_phase',
						user_generated: false,
						automatic: true
					});
				} else if (row.data_type === 'control') {
					// Group control data by event_string for series
					const mappedControl = getControlMapping(row.event_string || '');
					if (!controlSeries.has(mappedControl)) {
						controlSeries.set(mappedControl, []);
					}
					controlSeries.get(mappedControl)?.push({
						time_seconds: timeSeconds,
						value: row.value_numeric || 0
					});
				}
			});

			// Sort temperature data by time
			savedTemperatureEntries = temperatureData.sort((a, b) => a.time_seconds - b.time_seconds);

			// Combine milestone and control events for savedEventEntries
			const controlEvents = Array.from(controlSeries.entries()).flatMap(([eventString, points]) =>
				points.map((point) => ({
					roast_id: roastId,
					time_seconds: point.time_seconds,
					event_type: 1,
					event_value: point.value.toString(),
					event_string: eventString,
					category: 'control' as const,
					subcategory: 'machine_setting',
					user_generated: false,
					automatic: true
				}))
			);
			savedEventEntries = [...milestoneEvents, ...controlEvents];

			// Build savedEventValueSeries for chart rendering
			savedEventValueSeries = Array.from(controlSeries.entries()).map(([eventString, values]) => ({
				event_string: eventString,
				category: 'control',
				values: values.sort((a, b) => a.time_seconds - b.time_seconds),
				value_range: {
					min: Math.min(...values.map((v) => v.value)),
					max: Math.max(...values.map((v) => v.value)),
					detected_scale: 'percentage'
				}
			}));

			// Convert milestone events to chart display format with frontend formatting
			$roastEvents = milestoneEvents.map((milestone) => ({
				time: milestone.time_seconds * 1000, // Convert to milliseconds for chart
				name: formatDisplayName(milestone.event_string || 'Unknown')
			}));

			// Convert temperature data to roast data format
			if (savedTemperatureEntries.length > 0) {
				$roastData = convertToRoastData(savedTemperatureEntries, savedEventEntries);
			} else {
				// Create basic data points from milestones for chart rendering
				$roastData = milestoneEvents.map((event) => ({
					time: event.time_seconds * 1000, // Convert to milliseconds for chart
					heat: 0,
					fan: 0,
					bean_temp: null,
					environmental_temp: null,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'live' as const,
					// Include milestone flags for phase detection
					charge: event.event_string === 'charge',
					start: event.event_string === 'start',
					maillard: event.event_string === 'dry_end' || event.event_string === 'maillard',
					fc_start: event.event_string === 'fc_start',
					drop: event.event_string === 'drop',
					end: event.event_string === 'cool' || event.event_string === 'end'
				}));
			}

			const processingTime = performance.now() - processingStart;
			const totalTime = performance.now() - startTime;

			console.log(`Frontend processing results for ${roastId}:`, {
				tempPoints: savedTemperatureEntries.length,
				controlPoints: savedEventEntries.filter((e) => e.category === 'control').length,
				milestones: milestoneEvents.length,
				controlSeries: controlSeries.size,
				processingTime: `${processingTime.toFixed(2)}ms`,
				totalTime: `${totalTime.toFixed(2)}ms`,
				apiTime: rawData.metadata?.performanceMetrics?.totalApiTime || 0
			});
		} catch (error) {
			console.error('Error loading roast data:', error);
			savedTemperatureEntries = [];
			savedEventEntries = [];
			savedEventValueSeries = [];
			$roastData = [];
			$roastEvents = [];
		}
	}

	// Effect to load saved data and chart settings when currentRoastProfile changes
	$effect(() => {
		if (currentRoastProfile?.roast_id && !isDuringRoasting) {
			untrack(() => {
				loadSavedRoastData(currentRoastProfile.roast_id);
				loadChartSettings(currentRoastProfile.roast_id);
			});
		} else if (!currentRoastProfile?.roast_id) {
			savedTemperatureEntries = [];
			savedEventEntries = [];
			savedEventValueSeries = [];
			chartSettings = null;
			$roastData = [];
			$roastEvents = [];
		}
	});

	// Chart dimensions and event value rendering are now handled reactively
	// by the LayerCake RoastChart component via preparedChartData

	async function handleArtisanImportComplete() {
		if (currentRoastProfile?.roast_id) {
			await loadSavedRoastData(currentRoastProfile.roast_id);
			await loadChartSettings(currentRoastProfile.roast_id);
		}
	}
</script>

<div class="w-full overflow-x-hidden">
	<!-- Roast session header -->
	<div class="mb-3 flex flex-wrap justify-between">
		<h1 class="text-xl font-bold text-text-primary-light sm:text-2xl">
			Roast Session: {selectedBean.name}
		</h1>
	</div>

	<!-- Main roasting controls: fan, chart, and heat -->
	<div class="flex w-full flex-col justify-center gap-4 sm:flex-row">
		<!-- Chart -->
		<div class="w-full min-w-0 overflow-hidden">
			<div class="text-primary-light mx-auto h-[400px] w-full sm:h-[500px]">
				<RoastChart
					chartData={preparedChartData}
					isLive={isDuringRoasting}
					{currentTimeMinutes}
					onTooltipChange={(state) => {
						tooltipState = {
							visible: state.visible,
							x: state.x,
							y: state.y,
							data: state.data
								? ({
										x: 0,
										y: 0,
										bean_temp: state.data.bean_temp ?? 0,
										environmental_temp: state.data.environmental_temp ?? undefined,
										time_seconds: 0,
										time: state.data.time,
										chargeTime: state.data.chargeTime,
										rorValue: state.data.rorValue,
										milestones: state.data.milestones,
										eventData: state.data.eventData
									} satisfies TemperaturePoint)
								: null
						};
					}}
				/>
			</div>
		</div>
	</div>

	<!-- Event feedback notification -->
	{#if eventFeedback}
		<div
			class="mx-auto mt-4 max-w-2xl rounded-lg p-3 text-center text-sm font-medium transition-all duration-300 {eventFeedback.type ===
			'success'
				? 'bg-green-100 text-green-800 ring-1 ring-green-200'
				: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200'}"
		>
			{eventFeedback.message}
		</div>
	{/if}

	<!-- Roast event controls and timer -->
	<div class="mt-6 bg-background-secondary-light p-3 sm:p-4">
		<!-- Timer and Start/Stop button -->
		<div class="mb-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
			{#if isBeforeRoasting || isDuringRoasting}
				<div class="text-3xl font-bold text-text-primary-light sm:text-4xl md:text-5xl">
					{formattedTime}
				</div>
			{/if}
			{#if isBeforeRoasting || isDuringRoasting}
				<button
					id="start-end-roast"
					class="w-full rounded-md border-2 border-green-800 px-3 py-1 text-base font-medium text-text-primary-light transition-colors hover:bg-green-900 sm:w-auto sm:px-4 sm:py-2 sm:text-lg"
					onmousedown={(e) => {
						if (isRoasting) {
							isLongPressing = true;
							pressTimer = setTimeout(() => {
								resetTimer();
								e.preventDefault();
								const clickHandler = (clickEvent: Event) => {
									clickEvent.preventDefault();
									clickEvent.stopPropagation();
									document.removeEventListener('click', clickHandler, true);
								};
								document.addEventListener('click', clickHandler, true);
							}, LONG_PRESS_DURATION);
						}
					}}
					onclick={() => {
						if (!isLongPressing) {
							toggleTimer();
						}
					}}
					onmouseup={() => {
						if (pressTimer) {
							clearTimeout(pressTimer);
							pressTimer = null;
						}
						isLongPressing = false;
					}}
					onmouseleave={() => {
						if (pressTimer) {
							clearTimeout(pressTimer);
							pressTimer = null;
						}
						isLongPressing = false;
					}}
					class:border-red-800={isRoasting && !isPaused}
					class:hover:bg-red-900={isRoasting && !isPaused}
					class:border-orange-800={isRoasting && isPaused}
					class:hover:bg-orange-900={isRoasting && isPaused}
				>
					{isRoasting ? (isPaused ? 'Resume' : 'Stop') : 'Start'}
				</button>
			{/if}
		</div>

		<div class="flex flex-col gap-4 sm:flex-row sm:gap-6">
			<!-- Fan and Heat controls (left side) -->
			{#if isBeforeRoasting || isDuringRoasting}
				<RoastControls
					bind:fanValue
					bind:heatValue
					onFanChange={handleFanChange}
					onHeatChange={handleHeatChange}
				/>
			{/if}

			<!-- Roast events timeline (right side) -->
			<div class="flex-grow">
				{#if isBeforeRoasting || isDuringRoasting}
					<EventTimeline {isRoasting} bind:selectedEvent onEventLog={handleEventLog} />
				{/if}

				<!-- Roast milestone timestamps -->
				<MilestoneBar calculations={milestoneCalculations()} />
			</div>
		</div>
	</div>

	<!-- Save and Clear roast buttons -->
	<div class="mt-4 flex flex-col justify-end gap-2 sm:flex-row sm:gap-4">
		{#if isBeforeRoasting || isDuringRoasting}
			{#await import('$lib/components/LoadingButton.svelte') then { default: LoadingButton }}
				<LoadingButton
					variant="secondary"
					class="w-full sm:w-auto"
					onclick={async () => {
						console.log('Manual save: currentRoastProfile =', currentRoastProfile);
						console.log(
							'Manual save: currentRoastProfile.roast_id =',
							currentRoastProfile?.roast_id
						);
						console.log('Manual save: About to call saveRoastProfile()');
						try {
							await saveRoastProfile();
							console.log('Manual save: saveRoastProfile() completed successfully');
						} catch (error: unknown) {
							console.error('Manual save ERROR:', error);
							console.error('Manual save ERROR details:', {
								message: error instanceof Error ? error.message : error,
								stack: error instanceof Error ? error.stack : undefined
							});
						}
					}}
					disabled={!isRoasting && $eventEntries.length === 0}
					loadingText="Saving Roast..."
				>
					Save Roast
				</LoadingButton>
			{:catch}
				<!-- Fallback button if LoadingButton fails to load -->
				<button
					class="w-full rounded border-2 border-zinc-500 px-3 py-1 text-text-primary-light hover:bg-background-primary-light sm:w-auto"
					onclick={async () => {
						console.log('Manual save (fallback): currentRoastProfile =', currentRoastProfile);
						console.log('Manual save (fallback): About to call saveRoastProfile()');
						await saveRoastProfile();
					}}
					disabled={!isRoasting && $eventEntries.length === 0}
				>
					Save Roast
				</button>
			{/await}
		{/if}

		<!-- Import Artisan File button - only show when profile exists -->
		{#if currentRoastProfile?.roast_id}
			<button
				class="w-full rounded border-2 border-blue-600 px-3 py-1 text-text-primary-light hover:bg-blue-900 sm:w-auto"
				onclick={() => artisanImportDialog?.open()}
			>
				Import Artisan File
			</button>
		{/if}

		{#if !isBeforeRoasting}
			<button
				class="w-full rounded border-2 border-red-800 px-3 py-1 text-text-primary-light hover:bg-red-950 sm:w-auto"
				onclick={() => {
					if (
						confirm('Are you sure you want to clear this roast data? This action cannot be undone.')
					) {
						clearRoastData();
					}
				}}
			>
				Clear Roast
			</button>
		{/if}
	</div>
</div>

<!-- Artisan Import Dialog -->
{#if currentRoastProfile?.roast_id}
	<ArtisanImportDialog
		bind:this={artisanImportDialog}
		roastId={currentRoastProfile.roast_id}
		hasExistingData={$roastData.length > 0}
		onImportComplete={handleArtisanImportComplete}
	/>
{/if}

<!-- Tooltip for roast data (only visible when viewing saved profiles) -->
{#if !isDuringRoasting}
	<RoastTooltip
		visible={tooltipState.visible}
		x={tooltipState.x}
		y={tooltipState.y}
		data={tooltipState.data}
	/>
{/if}
