<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import {
		select,
		scaleLinear,
		axisBottom,
		axisLeft,
		axisRight,
		line,
		type Selection,
		type ScaleLinear
	} from 'd3';
	import { curveStepAfter, curveBasis } from 'd3-shape';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		temperatureEntries,
		eventEntries,
		type RoastPoint,
		type TemperatureEntry,
		type RoastEventEntry,
		msToSeconds,
		secondsToMs,
		extractMilestones
	} from './stores';
	import { createRoastDataService, type EventValueSeries } from '$lib/services/roastDataService';
	import { createClient } from '$lib/supabase';

	// Normalize event names for database storage - minimal formatting only
	function normalizeEventName(eventName: string): string {
		// Only do basic formatting: lowercase and replace spaces with underscores
		return eventName.toLowerCase().replace(/\s+/g, '_');
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
	function formatTimeDisplay(ms: number): string {
		if (!ms || ms <= 0) return '--:--';
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

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
		isRoasting = $bindable(false),
		isPaused = $bindable(false),
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
		isRoasting?: boolean;
		isPaused?: boolean;
		fanValue: number;
		heatValue: number;
		currentRoastProfile?: any | null;
		selectedEvent?: string | null;
		updateFan: (value: number) => void;
		updateHeat: (value: number) => void;
		saveRoastProfile: () => void;
		selectedBean: { id?: number; name: string };
		clearRoastData: () => void;
	} = $props();

	// Artisan import state
	let artisanImportFile = $state<File | null>(null);
	let showArtisanImport = $state(false);

	let seconds = $state(0);
	let milliseconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let dataLoggingInterval: ReturnType<typeof setInterval> | null = null;

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = $state(false);
	const LONG_PRESS_DURATION = 1000;

	let chartContainer: HTMLDivElement;
	let svg: Selection<SVGGElement, unknown, null, undefined>;
	let xScale: ScaleLinear<number, number>;
	let yScaleTemp: ScaleLinear<number, number>; // Left y-axis: Temperature (F/C)
	let yScaleRoR: ScaleLinear<number, number>; // Right y-axis: Rate of Rise (F/min or C/min)
	let height: number;
	let width: number;
	let margin = { top: 20, right: 80, bottom: 40, left: 80 }; // Increased right margin for RoR axis

	// Saved profile data for milestone calculations
	let savedTemperatureEntries = $state<TemperatureEntry[]>([]);
	let savedEventEntries = $state<RoastEventEntry[]>([]);
	let savedEventValueSeries = $state<EventValueSeries[]>([]);

	// Chart boundary settings from roast_profiles table
	let chartSettings = $state<{
		xRange: [number | null, number | null];
		yRange: [number | null, number | null];
		zRange: [number | null, number | null];
	} | null>(null);

	// Add these computed values - check for saved data to determine state
	let isBeforeRoasting = $derived(
		!currentRoastProfile?.roast_id || (savedEventEntries.length === 0 && $roastData.length === 0)
	);
	let isDuringRoasting = $derived(isRoasting);

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
	function toggleTimer() {
		if (!isRoasting) {
			// Initial start
			$startTime = performance.now();
			$accumulatedTime = 0;

			// Create initial start event in new structure
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

			// Create initial temperature entry
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

			// Start the timer
			timerInterval = setInterval(() => {
				const elapsed = performance.now() - $startTime! + $accumulatedTime;
				seconds = Math.floor(elapsed / 1000);
				milliseconds = elapsed % 1000;
			}, 1);

			// Start continuous data logging
			dataLoggingInterval = setInterval(() => {
				const currentTime = performance.now() - $startTime! + $accumulatedTime;
				$roastData = [
					...$roastData,
					{
						time: currentTime,
						heat: heatValue,
						fan: fanValue
					}
				];
			}, 1000); // Log data every second

			isRoasting = true;
		} else if (!isPaused) {
			// Pausing
			if (timerInterval) clearInterval(timerInterval);
			if (dataLoggingInterval) clearInterval(dataLoggingInterval);
			timerInterval = null;
			dataLoggingInterval = null;
			$accumulatedTime += performance.now() - $startTime!;
			isPaused = true;
		} else {
			// Resuming
			$startTime = performance.now();
			timerInterval = setInterval(() => {
				const elapsed = performance.now() - $startTime! + $accumulatedTime;
				seconds = Math.floor(elapsed / 1000);
				milliseconds = elapsed % 1000;
			}, 1);

			// Resume data logging
			dataLoggingInterval = setInterval(() => {
				const currentTime = performance.now() - $startTime! + $accumulatedTime;
				$roastData = [
					...$roastData,
					{
						time: currentTime,
						heat: heatValue,
						fan: fanValue
					}
				];
			}, 1000);

			isPaused = false;
		}
	}

	function resetTimer() {
		if (timerInterval) clearInterval(timerInterval);
		if (dataLoggingInterval) clearInterval(dataLoggingInterval);
		seconds = 0;
		milliseconds = 0;
		timerInterval = null;
		dataLoggingInterval = null;
		$startTime = null;
		$accumulatedTime = 0;
		$roastData = [];
		$roastEvents = [];
		$temperatureEntries = [];
		$eventEntries = [];
		isRoasting = false;
		isPaused = false;
	}

	// Timer display - only show during active recording
	let formattedTime = $derived(
		`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor(
			milliseconds / 10
		)
			.toString()
			.padStart(2, '0')}`
	);

	// Update current values when roastData changes
	$effect(() => {
		if ($roastData.length > 0 && isDuringRoasting) {
			const lastDataPoint = $roastData[$roastData.length - 1];
			fanValue = lastDataPoint.fan;
			heatValue = lastDataPoint.heat;
		}
	});

	// Function to apply moving average smoothing to temperature data
	function smoothTemperatureData(
		data: { time: number; temp: number }[],
		windowSize: number
	): { time: number; temp: number }[] {
		if (data.length === 0) return [];

		const smoothedData: { time: number; temp: number }[] = [];

		for (let i = 0; i < data.length; i++) {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(data.length, i + Math.ceil(windowSize / 2));

			let sum = 0;
			let count = 0;

			for (let j = start; j < end; j++) {
				sum += data[j].temp;
				count++;
			}

			smoothedData.push({
				time: data[i].time,
				temp: sum / count
			});
		}

		return smoothedData;
	}

	// Function to calculate BT Rate of Rise (RoR/ΔBT) with simplified smoothing
	function calculateBTRoR(data: RoastPoint[]): { time: number; ror: number }[] {
		if (data.length < 2) return [];

		// Step 1: Get charge and drop times to filter RoR display
		let chargeTime: number | null = null;
		let dropTime: number | null = null;

		// Extract milestone events to determine charge and drop times
		const events = isDuringRoasting ? $eventEntries : savedEventEntries;
		if (events.length > 0) {
			const milestones = extractMilestones(events);
			chargeTime = milestones.charge || milestones.start || null;
			dropTime = milestones.drop || milestones.end || null;
		}

		// Step 2: Filter and extract valid bean temperature data
		const validTempData = data
			.filter(
				(point) => point.bean_temp !== null && point.bean_temp !== undefined && point.bean_temp > 0
			)
			.map((point) => ({ time: point.time, temp: point.bean_temp! }));

		if (validTempData.length < 15) return []; // Need sufficient data for calculation

		// Step 3: Pre-smooth the temperature data to reduce noise (15-point window)
		const smoothedTempData = smoothTemperatureData(validTempData, 15);

		// Step 4: Calculate raw RoR from temperature differences
		const rawRorData: { time: number; ror: number }[] = [];

		for (let i = 1; i < smoothedTempData.length; i++) {
			const currentPoint = smoothedTempData[i];
			const previousPoint = smoothedTempData[i - 1];

			const timeDiffMinutes = (currentPoint.time - previousPoint.time) / (1000 * 60);
			const tempDiff = currentPoint.temp - previousPoint.temp;

			if (timeDiffMinutes > 0) {
				const ror = tempDiff / timeDiffMinutes; // °F/min or °C/min

				// Filter RoR data based on charge and drop times if available
				let includePoint = true;
				if (chargeTime !== null && dropTime !== null) {
					// Both charge and drop exist: only show RoR between them
					includePoint = currentPoint.time >= chargeTime && currentPoint.time <= dropTime;
				} else if (chargeTime !== null) {
					// Only charge exists: show RoR from charge onwards
					includePoint = currentPoint.time >= chargeTime;
				}
				// If no charge/drop events exist, show entire RoR curve

				// Only include reasonable RoR values (within scale bounds and positive)
				if (includePoint && Math.abs(ror) <= 50 && ror > 0) {
					rawRorData.push({
						time: currentPoint.time,
						ror: ror
					});
				}
			}
		}

		if (rawRorData.length === 0) return [];

		// Step 5: Apply smoothing to RoR values using same function as temperature (10-point window)
		const finalSmoothedData = smoothTemperatureData(
			rawRorData.map((point) => ({ time: point.time, temp: point.ror })),
			10
		).map((point) => ({ time: point.time, ror: point.temp }));

		return finalSmoothedData;
	}

	// Note: deltaBT and RoR are the same thing, so we only use calculateBTRoR

	// Function to find charge time from milestones for time axis adjustment
	function getChargeTime(data: RoastPoint[]): number {
		// Use appropriate event source based on current state
		const events = isDuringRoasting ? $eventEntries : savedEventEntries;

		// Extract milestones from event entries
		if (events.length > 0) {
			const milestones = extractMilestones(events);
			if (milestones.charge) {
				return milestones.charge;
			}
			if (milestones.start) {
				return milestones.start;
			}
		}

		// For imported Artisan data, look for charge event in the data itself
		const chargePoint = data.find(
			(point) => point.data_source === 'artisan_import' && point.charge
		);
		if (chargePoint) {
			return chargePoint.time;
		}

		// Fallback: look for any charge point in the data
		const anyChargePoint = data.find((point) => point.charge);
		if (anyChargePoint) {
			return anyChargePoint.time;
		}

		// Final fallback: use start of data
		return data.length > 0 ? data[0].time : 0;
	}

	// Create line generators
	const beanTempLine = line<RoastPoint>()
		.x((d) => {
			const chargeTime = getChargeTime($roastData);
			const adjustedTime = (d.time - chargeTime) / (1000 * 60); // Relative to charge in minutes
			return xScale(adjustedTime);
		})
		.y((d) => (d.bean_temp !== null && d.bean_temp !== undefined ? yScaleTemp(d.bean_temp) : 0))
		.defined((d) => d.bean_temp !== null && d.bean_temp !== undefined)
		.curve(curveBasis); // Smooth curve for BT temperature

	const envTempLine = line<RoastPoint>()
		.x((d) => {
			const chargeTime = getChargeTime($roastData);
			const adjustedTime = (d.time - chargeTime) / (1000 * 60); // Relative to charge in minutes
			return xScale(adjustedTime);
		})
		.y((d) =>
			d.environmental_temp !== null && d.environmental_temp !== undefined
				? yScaleTemp(d.environmental_temp)
				: 0
		)
		.defined((d) => d.environmental_temp !== null && d.environmental_temp !== undefined)
		.curve(curveBasis); // Smooth curve for ET temperature

	// RoR line generator - smooth curve for Rate of Rise (positive values only)
	const rorLine = line<{ time: number; ror: number }>()
		.x((d) => {
			const chargeTime = getChargeTime($roastData);
			const adjustedTime = (d.time - chargeTime) / (1000 * 60); // Relative to charge in minutes
			return xScale(adjustedTime);
		})
		.y((d) => yScaleRoR(d.ror))
		.defined((d) => d.ror > 0 && d.ror <= 50) // Only render positive RoR values within scale bounds
		.curve(curveBasis); // Smooth curve for RoR

	// Note: deltaBT removed since it's the same as RoR

	// Function to render dynamic event value lines based on event value series
	function renderEventValueLines(svg: any, processedData: any[], chargeTime: number) {
		if (!svg || !xScale || !yScaleTemp) return;

		console.log('renderEventValueLines:', {
			savedEventValueSeriesCount: savedEventValueSeries.length,
			processedDataCount: processedData.length,
			isDuringRoasting: isDuringRoasting,
			savedEventValueSeries: savedEventValueSeries
		});

		// If savedEventValueSeries exists, use it (for Artisan imports)
		if (savedEventValueSeries.length > 0) {
			console.log('Using renderSavedEventValueSeries');
			renderSavedEventValueSeries(svg, processedData, chargeTime);
		}
		// Otherwise, try to render from processedData (for legacy and live data)
		else if (processedData.length > 0) {
			console.log('Using renderProcessedDataControlEvents');
			renderProcessedDataControlEvents(svg, processedData, chargeTime);
		} else {
			console.log('No control events to render');
		}
	}

	// Function to render savedEventValueSeries (existing logic)
	function renderSavedEventValueSeries(svg: any, processedData: any[], chargeTime: number) {
		// Define colors for different event types
		const eventColors = [
			'#b45309', // Brown for heat-related events
			'#3730a3', // Blue for air/fan-related events
			'#059669', // Green for other control events
			'#7c2d12', // Dark red for burner events
			'#6d28d9', // Purple for additional events
			'#ea580c', // Orange for temperature control
			'#0891b2' // Teal for miscellaneous
		];

		savedEventValueSeries.forEach((eventSeries, index) => {
			if (eventSeries.values.length === 0) return;

			const color = eventColors[index % eventColors.length];

			// Create scale for this event type based on detected range
			const yScale = createEventValueScale(eventSeries);
			if (!yScale) return;

			// Build step-after points directly from event timestamps (seconds -> ms)
			const sortedValues = [...eventSeries.values].sort((a, b) => a.time_seconds - b.time_seconds);

			// Determine chart start from processedData if available; otherwise from events
			const chartStart =
				processedData.length > 0
					? Math.min(...processedData.map((d: any) => d.time))
					: sortedValues[0].time_seconds * 1000;

			// FIXED: Calculate chartEnd using milestone completion and chart settings
			let chartEnd: number;

			// Priority 1: Use chart_x_max setting if available (convert minutes to ms, relative to charge)
			if (chartSettings?.xRange && chartSettings.xRange[1] !== null) {
				const chargeTimeMs = getChargeTime(processedData);
				chartEnd = chargeTimeMs + chartSettings.xRange[1] * 60 * 1000; // Convert minutes to ms
			}
			// Priority 2: Use Cool End milestone time + buffer
			else {
				const events = isDuringRoasting ? $eventEntries : savedEventEntries;
				const milestones = extractMilestones(events);

				if (milestones.end) {
					chartEnd = milestones.end + 60 * 1000; // Cool End + 1 minute buffer
				}
				// Priority 3: Use Drop milestone time + buffer
				else if (milestones.drop) {
					chartEnd = milestones.drop + 2 * 60 * 1000; // Drop + 2 minutes buffer for cooling
				}
				// Priority 4: Use processedData range if available
				else if (processedData.length > 0) {
					chartEnd = Math.max(...processedData.map((d: any) => d.time)) + 60 * 1000; // + 1 minute buffer
				}
				// Fallback: Use event data range
				else {
					chartEnd = sortedValues[sortedValues.length - 1].time_seconds * 1000 + 60 * 1000; // + 1 minute buffer
				}
			}

			const eventDataPoints: Array<{ time: number; value: number }> = [];

			// Anchor at chartStart holding the first value
			eventDataPoints.push({
				time: chartStart,
				value: sortedValues[0].value
			});

			// Add each change at the exact event time
			for (const v of sortedValues) {
				eventDataPoints.push({ time: v.time_seconds * 1000, value: v.value });
			}

			// Extend last value to chartEnd so the line is visible through the end
			eventDataPoints.push({
				time: chartEnd,
				value: sortedValues[sortedValues.length - 1].value
			});

			// Create line generator for this event type
			const eventLine = line<{ time: number; value: number }>()
				.x((d) => {
					const adjustedTime = (d.time - chargeTime) / (1000 * 60);
					return xScale(adjustedTime);
				})
				.y((d) => yScale(d.value))
				.curve(curveStepAfter); // Use step-after for control values

			// Draw the line
			svg
				.append('path')
				.attr('class', 'event-value-line')
				.datum(eventDataPoints)
				.attr('fill', 'none')
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', index % 2 === 0 ? 'none' : '3,3')
				.attr('d', eventLine);
		});
	}

	// Function to render control events from processedData (for legacy and live data)
	function renderProcessedDataControlEvents(svg: any, processedData: any[], chargeTime: number) {
		// Extract fan and heat data series from processed data
		const fanData = processedData
			.filter((d) => d.fan !== null && d.fan !== undefined)
			.map((d) => ({ time: d.time, value: d.fan || 0 }));

		const heatData = processedData
			.filter((d) => d.heat !== null && d.heat !== undefined)
			.map((d) => ({ time: d.time, value: d.heat || 0 }));

		// Create Y scale for control values (0-10 scale for legacy data)
		const controlScale = scaleLinear()
			.domain([0, 10])
			.range([
				yScaleTemp.range()[0],
				yScaleTemp.range()[0] - (yScaleTemp.range()[0] - yScaleTemp.range()[1]) * 0.3
			]);

		// Render fan line (blue, dashed)
		if (fanData.length > 0 && fanData.some((d) => d.value > 0)) {
			const fanLine = line<{ time: number; value: number }>()
				.x((d) => {
					const adjustedTime = (d.time - chargeTime) / (1000 * 60);
					return xScale(adjustedTime);
				})
				.y((d) => controlScale(d.value))
				.curve(curveStepAfter);

			svg
				.append('path')
				.attr('class', 'control-event-line fan-line')
				.datum(fanData)
				.attr('fill', 'none')
				.attr('stroke', '#3730a3') // Blue for fan
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '3,3') // Dashed
				.attr('d', fanLine);
		}

		// Render heat line (brown, solid)
		if (heatData.length > 0 && heatData.some((d) => d.value > 0)) {
			const heatLine = line<{ time: number; value: number }>()
				.x((d) => {
					const adjustedTime = (d.time - chargeTime) / (1000 * 60);
					return xScale(adjustedTime);
				})
				.y((d) => controlScale(d.value))
				.curve(curveStepAfter);

			svg
				.append('path')
				.attr('class', 'control-event-line heat-line')
				.datum(heatData)
				.attr('fill', 'none')
				.attr('stroke', '#b45309') // Brown for heat
				.attr('stroke-width', 2)
				.attr('d', heatLine);
		}
	}

	// Function to create appropriate Y-scale for an event value series
	function createEventValueScale(eventSeries: EventValueSeries) {
		if (!yScaleTemp) return null;

		// Get the temperature scale range to map event values
		const tempRange = yScaleTemp.range();
		const chartHeight = tempRange[0] - tempRange[1]; // Inverted Y axis

		// Create scale based on detected scale type
		let domain: [number, number];

		switch (eventSeries.value_range.detected_scale) {
			case 'decimal': // 0-10 scale
				domain = [0, 10];
				break;
			case 'percentage': // 0-100 scale
				domain = [0, 100];
				break;
			case 'custom':
				domain = [eventSeries.value_range.min, eventSeries.value_range.max];
				break;
			default:
				domain = [0, Math.max(eventSeries.value_range.max, 10)];
		}

		// Map to the right side of the chart (temperature scale area)
		return scaleLinear()
			.domain(domain)
			.range([tempRange[0], tempRange[0] - chartHeight * 0.3]); // Use 30% of chart height
	}

	function updateChart(data: RoastPoint[]) {
		if (!svg || !xScale || !yScaleTemp || !yScaleRoR) return;

		// DEBUG: Log incoming data
		console.log('=== UPDATE CHART DEBUG ===');
		console.log('Raw data length:', data.length);
		if (data.length > 0) {
			console.log('Data time range:', {
				first: data[0]?.time,
				last: data[data.length - 1]?.time,
				firstSeconds: data[0]?.time / 1000,
				lastSeconds: data[data.length - 1]?.time / 1000
			});
		}

		// Sort data by time first
		const sortedData = [...data].sort((a, b) => a.time - b.time);
		console.log('Sorted data length:', sortedData.length);

		// Process sorted data to fill NULL values
		let lastHeat = 0;
		let lastFan = 0;
		const processedData = sortedData.map((point) => {
			// Update last known values within the map function
			if (point.heat !== null) lastHeat = point.heat;
			if (point.fan !== null) lastFan = point.fan;

			return {
				time: point.time,
				heat: point.heat ?? lastHeat,
				fan: point.fan ?? lastFan,
				bean_temp: point.bean_temp,
				environmental_temp: point.environmental_temp,
				data_source: point.data_source
			};
		});

		// Clear existing elements - comprehensive cleanup
		svg.selectAll('.bean-temp-line').remove();
		svg.selectAll('.env-temp-line').remove();
		svg.selectAll('.ror-line').remove();
		svg.selectAll('.temp-legend').remove();
		svg.selectAll('.event-marker').remove();
		svg.selectAll('.event-label').remove();
		svg.selectAll('.event-value-line').remove(); // Clear dynamic event value lines
		svg.selectAll('.event-value-label').remove(); // Clear dynamic event value labels
		svg.selectAll('.control-event-line').remove(); // Clear control event lines from processed data
		svg.selectAll('.fan-line').remove(); // Clear fan lines
		svg.selectAll('.heat-line').remove(); // Clear heat lines

		// Clear any remaining event-related elements that might persist
		svg.selectAll('[class*="event-value-label-"]').remove(); // Clear numbered event labels
		svg.selectAll('path[stroke*="#"]').remove(); // Clear any remaining colored paths
		svg
			.selectAll('text')
			.filter(function () {
				const element = this as any;
				const text = element?.textContent || '';
				return text.includes('_setting') || text.includes('fan') || text.includes('heat');
			})
			.remove(); // Clear any remaining event-related text

		// Get charge time for relative time calculation
		const chargeTime = getChargeTime(data);
		console.log('Charge time:', chargeTime, 'seconds:', chargeTime / 1000);

		// Create combined events array - preserve ALL original event names without modification
		const eventData = $roastEvents.map((event) => ({
			time: event.time,
			name: event.name
		}));

		// Sort events by time to ensure proper ordering
		eventData.sort((a, b) => a.time - b.time);

		// Update x-axis scale only when no saved chart settings are present
		const hasSavedXRange =
			chartSettings?.xRange && chartSettings.xRange[0] !== null && chartSettings.xRange[1] !== null;

		if (!hasSavedXRange) {
			// Auto-scale to data duration relative to charge
			const maxTimeRelative =
				data.length > 0
					? Math.max(...data.map((d) => (d.time - chargeTime) / (1000 * 60))) // minutes
					: 12; // Default max when no data

			const minTimeRelative =
				data.length > 0 ? Math.min(...data.map((d) => (d.time - chargeTime) / (1000 * 60))) : -2; // Default min when no data

			xScale.domain([Math.min(minTimeRelative, -2), Math.max(maxTimeRelative, 12)]);
		}

		// Update time tracker position (charge-relative)
		if (isRoasting && !isPaused) {
			const currentTime =
				(performance.now() - $startTime! + $accumulatedTime - chargeTime) / (1000 * 60);
			svg
				.select('.time-tracker')
				.style('display', 'block')
				.attr('x1', xScale(currentTime))
				.attr('x2', xScale(currentTime));
		} else {
			svg.select('.time-tracker').style('display', 'none');
		}

		// Update x-axis and charge line position
		svg.select('.x-axis').call(axisBottom(xScale) as any);
		svg.select('.charge-line').attr('x1', xScale(0)).attr('x2', xScale(0));

		// Add environmental temperature line (ET) - solid line
		const envTempData = processedData.filter(
			(d) =>
				d.environmental_temp !== null &&
				d.environmental_temp !== undefined &&
				d.environmental_temp > 0
		);
		if (envTempData.length > 0) {
			svg
				.append('path')
				.attr('class', 'env-temp-line')
				.datum(envTempData)
				.attr('fill', 'none')
				.attr('stroke', '#dc2626') // Red solid line for environmental temperature
				.attr('stroke-width', 2)
				.attr('d', envTempLine);
		}

		// Add bean temperature line (BT) - orange dashed line (as requested)
		const beanTempData = processedData.filter(
			(d) => d.bean_temp !== null && d.bean_temp !== undefined && d.bean_temp > 0
		);
		console.log('Bean temp data filtering:', {
			processedDataLength: processedData.length,
			beanTempDataLength: beanTempData.length,
			firstBeanTemp: beanTempData[0],
			lastBeanTemp: beanTempData[beanTempData.length - 1]
		});
		if (beanTempData.length > 0) {
			svg
				.append('path')
				.attr('class', 'bean-temp-line')
				.datum(beanTempData)
				.attr('fill', 'none')
				.attr('stroke', '#f59e0b') // Orange dashed line for bean temperature (as requested)
				.attr('stroke-width', 3)
				.attr('stroke-dasharray', '5,5')
				.attr('d', beanTempLine);
		}

		// Calculate and add RoR line (blue)
		const rorData = calculateBTRoR(processedData);
		if (rorData.length > 0) {
			svg
				.append('path')
				.attr('class', 'ror-line')
				.datum(rorData)
				.attr('fill', 'none')
				.attr('stroke', '#2563eb') // Blue for RoR
				.attr('stroke-width', 2)
				.attr('d', rorLine);
		}

		// deltaBT removed - it's the same as RoR which is already displayed

		// Add dynamic event value lines
		renderEventValueLines(svg, processedData, chargeTime);

		// Add comprehensive legend for all data lines
		if (beanTempData.length > 0 || envTempData.length > 0 || rorData.length > 0) {
			const legendGroup = svg.append('g').attr('class', 'temp-legend');

			let legendY = 20;
			const legendX = width - 160;

			// Bean Temperature legend (orange dashed)
			if (beanTempData.length > 0) {
				legendGroup
					.append('line')
					.attr('x1', legendX)
					.attr('x2', legendX + 20)
					.attr('y1', legendY)
					.attr('y2', legendY)
					.attr('stroke', '#f59e0b')
					.attr('stroke-width', 3)
					.attr('stroke-dasharray', '5,5');

				legendGroup
					.append('text')
					.attr('x', legendX + 25)
					.attr('y', legendY)
					.attr('dy', '0.35em')
					.attr('font-size', '10px')
					.attr('fill', '#374151')
					.text('Bean Temp (BT)');

				legendY += 16;
			}

			// Environmental Temperature legend (red solid)
			if (envTempData.length > 0) {
				legendGroup
					.append('line')
					.attr('x1', legendX)
					.attr('x2', legendX + 20)
					.attr('y1', legendY)
					.attr('y2', legendY)
					.attr('stroke', '#dc2626')
					.attr('stroke-width', 2);

				legendGroup
					.append('text')
					.attr('x', legendX + 25)
					.attr('y', legendY)
					.attr('dy', '0.35em')
					.attr('font-size', '10px')
					.attr('fill', '#374151')
					.text('Env Temp (ET)');

				legendY += 16;
			}

			// RoR legend (blue solid)
			if (rorData.length > 0) {
				legendGroup
					.append('line')
					.attr('x1', legendX)
					.attr('x2', legendX + 20)
					.attr('y1', legendY)
					.attr('y2', legendY)
					.attr('stroke', '#2563eb')
					.attr('stroke-width', 2);

				legendGroup
					.append('text')
					.attr('x', legendX + 25)
					.attr('y', legendY)
					.attr('dy', '0.35em')
					.attr('font-size', '10px')
					.attr('fill', '#374151')
					.text('BT RoR (°F/min)');

				legendY += 16;
			}

			// Delta BT legend removed - same as RoR
		}

		// Update event markers - Create separate groups for each event
		const eventGroups = svg
			.selectAll('.event-group')
			.data(eventData)
			.join('g')
			.attr('class', 'event-group');

		// Add or update event lines (charge-relative positioning)
		eventGroups
			.selectAll('.event-marker')
			.data((d) => [d])
			.join('line')
			.attr('class', 'event-marker')
			.attr('x1', (d) => {
				const timeRelativeToCharge = (d.time - chargeTime) / (1000 * 60);
				return xScale(timeRelativeToCharge);
			})
			.attr('x2', (d) => {
				const timeRelativeToCharge = (d.time - chargeTime) / (1000 * 60);
				return xScale(timeRelativeToCharge);
			})
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#4ade80')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4');

		// Add or update event labels (charge-relative positioning)
		eventGroups
			.selectAll('.event-label')
			.data((d) => [d])
			.join('text')
			.attr('class', 'event-label')
			.attr('x', (d) => {
				const timeRelativeToCharge = (d.time - chargeTime) / (1000 * 60);
				return xScale(timeRelativeToCharge);
			})
			.attr('y', 10)
			.text((d) => d.name)
			.attr('fill', '#4ade80')
			.attr('font-size', '12px')
			.attr('text-anchor', 'end')
			.attr('transform', (d) => {
				const timeRelativeToCharge = (d.time - chargeTime) / (1000 * 60);
				return `rotate(-90, ${xScale(timeRelativeToCharge)}, 10)`;
			});
	}

	// Update chart when roastData changes (live roasting)
	$effect(() => {
		if (isDuringRoasting) {
			const data = $roastData;
			if (
				svg !== undefined &&
				xScale !== undefined &&
				yScaleTemp !== undefined &&
				yScaleRoR !== undefined
			) {
				untrack(() => updateChart(data));
			}
		}
	});

	// Update chart when saved data changes (viewing completed profiles)
	$effect(() => {
		if (!isDuringRoasting) {
			if (savedTemperatureEntries.length > 0 || savedEventEntries.length > 0) {
				// Convert to chart data format
				const chartData = convertToRoastData(savedTemperatureEntries, savedEventEntries);

				if (
					svg !== undefined &&
					xScale !== undefined &&
					yScaleTemp !== undefined &&
					yScaleRoR !== undefined
				) {
					untrack(() => updateChart(chartData));
				}
			} else {
				// Clear the chart when there's no saved data
				if (
					svg !== undefined &&
					xScale !== undefined &&
					yScaleTemp !== undefined &&
					yScaleRoR !== undefined
				) {
					untrack(() => updateChart([])); // Empty data array will clear the chart
				}
			}
		}
	});

	function updateChartDimensions() {
		if (!chartContainer || !svg) return;

		// Get the actual available width and ensure we don't exceed it
		const containerWidth = chartContainer.clientWidth;
		// Ensure width doesn't exceed container and account for margins properly
		width = Math.max(0, containerWidth - margin.left - margin.right);
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		// Update SVG dimensions
		select(chartContainer)
			.select('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.attr('preserveAspectRatio', 'xMidYMid meet');

		// Update scales with chart boundaries if available
		const xDomain =
			chartSettings?.xRange && chartSettings.xRange[0] !== null && chartSettings.xRange[1] !== null
				? [chartSettings.xRange[0], chartSettings.xRange[1]]
				: [-2, 12]; // Default: -2 to 12 minutes relative to charge

		const yTempDomain =
			chartSettings?.yRange && chartSettings.yRange[0] !== null && chartSettings.yRange[1] !== null
				? [chartSettings.yRange[0], chartSettings.yRange[1]]
				: [100, 500]; // Default: 100-500°F

		const yRoRDomain =
			chartSettings?.zRange && chartSettings.zRange[0] !== null && chartSettings.zRange[1] !== null
				? [chartSettings.zRange[0], chartSettings.zRange[1]]
				: [0, 50]; // Default: 0-50°F/min

		console.log('updateChartDimensions scale update:', {
			chartSettings,
			xDomain,
			yTempDomain,
			yRoRDomain
		});

		xScale.domain(xDomain).range([0, width]);
		yScaleTemp.domain(yTempDomain).range([height, 0]);
		yScaleRoR.domain(yRoRDomain).range([height, 0]);

		// Clear old grid elements
		svg.selectAll('.temp-grid').remove();

		// Update y-axis positions and dimensions
		svg.select('.y-axis-left').call(axisLeft(yScaleTemp) as any);
		svg
			.select('.y-axis-right')
			.attr('transform', `translate(${width}, 0)`)
			.call(axisRight(yScaleRoR) as any);

		// Update charge line position
		svg.select('.charge-line').attr('x1', xScale(0)).attr('x2', xScale(0)).attr('y2', height);

		// Redraw light temperature grid lines
		for (let temp = 150; temp <= 450; temp += 50) {
			svg
				.append('line')
				.attr('class', 'temp-grid')
				.attr('x1', 0)
				.attr('x2', width)
				.attr('y1', yScaleTemp(temp))
				.attr('y2', yScaleTemp(temp))
				.attr('stroke', '#dc2626')
				.attr('stroke-width', 0.5)
				.attr('opacity', 0.1);
		}

		// Update x-axis only
		svg
			.select('.x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale) as any);

		// Update chart with new dimensions
		updateChart($roastData);
	}

	onMount(() => {
		// Initial setup
		const containerWidth = chartContainer.clientWidth;
		// Ensure width doesn't exceed container and account for margins properly
		width = Math.max(0, containerWidth - margin.left - margin.right);
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		svg = select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.attr(
				'viewBox',
				`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
			)
			.attr('preserveAspectRatio', 'xMidYMid meet')
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Setup scales with charge-relative time axis and dual y-axes
		// Use chart boundaries if available, otherwise use defaults
		const xDomain =
			chartSettings?.xRange && chartSettings.xRange[0] !== null && chartSettings.xRange[1] !== null
				? [chartSettings.xRange[0], chartSettings.xRange[1]]
				: [-2, 12]; // Default: -2 to 12 minutes relative to charge

		const yTempDomain =
			chartSettings?.yRange && chartSettings.yRange[0] !== null && chartSettings.yRange[1] !== null
				? [chartSettings.yRange[0], chartSettings.yRange[1]]
				: [100, 500]; // Default: 100-500°F

		const yRoRDomain =
			chartSettings?.zRange && chartSettings.zRange[0] !== null && chartSettings.zRange[1] !== null
				? [chartSettings.zRange[0], chartSettings.zRange[1]]
				: [0, 50]; // Default: 0-50°F/min

		console.log('onMount scale setup:', {
			chartSettings,
			xDomain,
			yTempDomain,
			yRoRDomain
		});

		xScale = scaleLinear().domain(xDomain).range([0, width]);
		yScaleTemp = scaleLinear().domain(yTempDomain).range([height, 0]);
		yScaleRoR = scaleLinear().domain(yRoRDomain).range([height, 0]);

		// Add left y-axis (Temperature)
		svg
			.append('g')
			.attr('class', 'y-axis-left')
			.call(axisLeft(yScaleTemp) as any)
			.selectAll('text')
			.style('fill', '#dc2626')
			.style('font-size', '10px');

		// Add left y-axis label
		svg
			.append('text')
			.attr('class', 'y-axis-label-left')
			.attr('transform', 'rotate(-90)')
			.attr('y', -60)
			.attr('x', -height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.style('fill', '#dc2626')
			.style('font-size', '12px')
			.style('font-weight', 'bold')
			.text('Temperature (°F)');

		// Add right y-axis (RoR)
		svg
			.append('g')
			.attr('class', 'y-axis-right')
			.attr('transform', `translate(${width}, 0)`)
			.call(axisRight(yScaleRoR) as any)
			.selectAll('text')
			.style('fill', '#2563eb')
			.style('font-size', '10px');

		// Add right y-axis label
		svg
			.append('text')
			.attr('class', 'y-axis-label-right')
			.attr('transform', 'rotate(90)')
			.attr('y', -width - 60)
			.attr('x', height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.style('fill', '#2563eb')
			.style('font-size', '12px')
			.style('font-weight', 'bold')
			.text('Rate of Rise (°F/min)');

		// Add light temperature grid lines
		for (let temp = 150; temp <= 450; temp += 50) {
			svg
				.append('line')
				.attr('class', 'temp-grid')
				.attr('x1', 0)
				.attr('x2', width)
				.attr('y1', yScaleTemp(temp))
				.attr('y2', yScaleTemp(temp))
				.attr('stroke', '#dc2626')
				.attr('stroke-width', 0.5)
				.attr('opacity', 0.1);
		}

		// Add x-axis with charge-relative time
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale) as any);

		// Add x-axis label
		svg
			.append('text')
			.attr('class', 'x-axis-label')
			.attr('x', width / 2)
			.attr('y', height + 35)
			.style('text-anchor', 'middle')
			.style('fill', '#374151')
			.style('font-size', '12px')
			.style('font-weight', 'bold')
			.text('Time relative to Charge (minutes)');

		// Add charge line (time = 0)
		svg
			.append('line')
			.attr('class', 'charge-line')
			.attr('x1', xScale(0))
			.attr('x2', xScale(0))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#10b981')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '3,3')
			.attr('opacity', 0.7);

		// Add time tracker line
		svg
			.append('line')
			.attr('class', 'time-tracker')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#ef4444')
			.attr('stroke-width', 2)
			.attr('stroke-dasharray', '4,4')
			.style('display', 'none');

		// Initial chart update
		updateChart($roastData);

		// Add window resize listener for responsiveness
		const resizeObserver = new ResizeObserver(() => {
			updateChartDimensions();
		});

		resizeObserver.observe(chartContainer);

		return () => {
			resizeObserver.disconnect();
		};
	});

	function handleEventLog(event: string) {
		if ($startTime === null || !currentRoastProfile?.roast_id) return;

		selectedEvent = event;
		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

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
			if (timerInterval) clearInterval(timerInterval);
			if (dataLoggingInterval) clearInterval(dataLoggingInterval);
			timerInterval = null;
			dataLoggingInterval = null;
			$accumulatedTime += performance.now() - $startTime!;
			isPaused = true;
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
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

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
		// Use live data during roasting, saved data when viewing completed profiles
		const events = isDuringRoasting ? $eventEntries : savedEventEntries;

		// Include seconds and milliseconds in dependency to trigger updates every tick
		seconds; // Dependency for live updates
		milliseconds; // Dependency for live updates

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
		let currentElapsedTime = 0;
		if (isDuringRoasting && $startTime !== null) {
			currentElapsedTime = isPaused
				? $accumulatedTime
				: performance.now() - $startTime + $accumulatedTime;
		}

		return calculateMilestones(milestones, isDuringRoasting ? currentElapsedTime : undefined);
	});

	// Formatted display values
	let dryingDisplay = $derived(
		milestoneCalculations().dryingPercent > 0
			? `${milestoneCalculations().dryingPercent.toFixed(1)}%`
			: '--:--'
	);
	let tpDisplay = $derived(formatTimeDisplay(milestoneCalculations().tpTime));
	let maillardDisplay = $derived(
		milestoneCalculations().maillardPercent > 0
			? `${milestoneCalculations().maillardPercent.toFixed(1)}%`
			: '--:--'
	);
	let fcDisplay = $derived(formatTimeDisplay(milestoneCalculations().fcTime));
	let devDisplay = $derived(
		milestoneCalculations().devPercent > 0
			? `${milestoneCalculations().devPercent.toFixed(1)}%`
			: '--:--'
	);

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
			const supabase = createClient();
			const roastDataService = createRoastDataService(supabase);
			const settings = await roastDataService.getChartSettings(roastId);

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

	// Load saved roast data when a roast profile is selected - use roastDataService exclusively
	async function loadSavedRoastData(roastId: number) {
		try {
			// Use roastDataService to get all data from normalized tables
			const supabase = createClient();
			const roastDataService = createRoastDataService(supabase);
			const chartData = await roastDataService.getChartData(roastId);

			// Convert to internal format - normalize all data sources to 'live'
			savedTemperatureEntries = chartData.temperatures.map((temp) => ({
				roast_id: roastId,
				time_seconds: temp.time_seconds,
				bean_temp: temp.bean_temp,
				environmental_temp: temp.environmental_temp,
				ambient_temp: temp.ambient_temp,
				ror_bean_temp: temp.ror_bean_temp,
				data_source: 'live' as const // Treat all data sources the same
			}));

			console.log('=== LOAD SAVED ROAST DATA DEBUG ===');
			console.log('Loaded temperature entries:', savedTemperatureEntries.length);
			if (savedTemperatureEntries.length > 0) {
				const firstTemp = savedTemperatureEntries[0];
				const lastTemp = savedTemperatureEntries[savedTemperatureEntries.length - 1];
				console.log('Temperature data range:', {
					first: { time: firstTemp.time_seconds, temp: firstTemp.bean_temp },
					last: { time: lastTemp.time_seconds, temp: lastTemp.bean_temp }
				});
			}

			// Get ALL milestone and control events from the roast_events table
			savedEventEntries = [
				...chartData.milestones.map((milestone) => ({
					roast_id: roastId,
					time_seconds: milestone.time_seconds,
					event_type: 10,
					event_value: null,
					event_string: milestone.event_string, // Preserve original event names
					category: 'milestone' as const,
					subcategory: 'roast_phase',
					user_generated: false,
					automatic: true
				})),
				...chartData.controls.map((control) => ({
					roast_id: roastId,
					time_seconds: control.time_seconds,
					event_type: 1,
					event_value: control.event_value,
					event_string: control.event_string,
					category: 'control' as const,
					subcategory: 'machine_setting',
					user_generated: false,
					automatic: true
				}))
			];

			// Store event value series for dynamic chart rendering
			savedEventValueSeries = chartData.eventValueSeries || [];
			console.log('loadSavedRoastData:', {
				roastId,
				temperaturesCount: chartData.temperatures.length,
				milestonesCount: chartData.milestones.length,
				controlsCount: chartData.controls.length,
				eventValueSeriesCount: savedEventValueSeries.length,
				eventValueSeries: savedEventValueSeries
			});

			// Convert ALL milestone events to chart display format (no filtering, no renaming)
			$roastEvents = chartData.milestones.map((milestone) => ({
				time: milestone.time_seconds * 1000, // Convert to milliseconds
				name:
					milestone.event_string.charAt(0).toUpperCase() +
					milestone.event_string.slice(1).replace(/_/g, ' ') // Convert snake_case to Title Case
			}));

			console.log(
				'Milestone events:',
				chartData.milestones.map((m) => ({
					event: m.event_string,
					time_seconds: m.time_seconds,
					time_ms: m.time_seconds * 1000
				}))
			);

			// For legacy data without temperature entries, create minimal roast data for milestones
			// Control events will be rendered via savedEventValueSeries
			if (savedTemperatureEntries.length > 0) {
				$roastData = convertToRoastData(savedTemperatureEntries, savedEventEntries);
				console.log('Converted roast data length:', $roastData.length);
				if ($roastData.length > 0) {
					console.log('Converted data range:', {
						first: { time: $roastData[0].time, seconds: $roastData[0].time / 1000 },
						last: {
							time: $roastData[$roastData.length - 1].time,
							seconds: $roastData[$roastData.length - 1].time / 1000
						}
					});
				}
			} else {
				// Create basic data points from milestones only (for legacy app data)
				const milestoneEvents = savedEventEntries.filter((e) => e.category === 'milestone');
				$roastData = milestoneEvents.map((event) => ({
					time: event.time_seconds * 1000, // Convert to milliseconds
					heat: 0, // Will be handled by savedEventValueSeries
					fan: 0, // Will be handled by savedEventValueSeries
					bean_temp: null,
					environmental_temp: null,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'live' as const,
					// Include milestone flags for charge detection
					charge: event.event_string === 'charge',
					start: event.event_string === 'start',
					maillard: event.event_string === 'dry_end' || event.event_string === 'maillard',
					fc_start: event.event_string === 'fc_start',
					drop: event.event_string === 'drop',
					end: event.event_string === 'cool' || event.event_string === 'end'
				}));
			}
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

	// Effect to update chart dimensions when chart settings change
	$effect(() => {
		console.log('Chart settings effect triggered:', {
			chartSettings,
			hasSvg: !!svg,
			hasXScale: xScale !== undefined,
			hasYScaleTemp: yScaleTemp !== undefined,
			hasYScaleRoR: yScaleRoR !== undefined
		});

		if (
			chartSettings &&
			svg &&
			xScale !== undefined &&
			yScaleTemp !== undefined &&
			yScaleRoR !== undefined
		) {
			console.log('Updating chart dimensions due to chart settings change');
			untrack(() => updateChartDimensions());
		}
	});

	// Additional effect to ensure chart clears when event value series becomes empty
	$effect(() => {
		// When savedEventValueSeries becomes empty but chart exists, force a refresh
		if (
			savedEventValueSeries.length === 0 &&
			svg &&
			xScale !== undefined &&
			yScaleTemp !== undefined &&
			yScaleRoR !== undefined
		) {
			// Clear any lingering event value elements
			svg.selectAll('.event-value-line').remove();
			svg.selectAll('.event-value-label').remove();
			svg.selectAll('[class*="event-value-label-"]').remove();

			// If we're not during roasting and have no current profile, ensure chart is clean
			if (!isDuringRoasting && !currentRoastProfile?.roast_id) {
				untrack(() => updateChart([]));
			}
		}
	});

	// Artisan import functions
	function handleArtisanFileSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
			// Validate file format
			const fileName = file.name.toLowerCase();
			if (
				!fileName.endsWith('.alog') &&
				!fileName.endsWith('.alog.json') &&
				!fileName.endsWith('.json')
			) {
				alert('Please select a valid Artisan .alog file.');
				return;
			}

			// Additional validation: check file size (reasonable limit)
			if (file.size > 50 * 1024 * 1024) {
				// 50MB limit
				alert('File is too large. Please select a file smaller than 50MB.');
				return;
			}

			artisanImportFile = file;
		}
	}

	function showArtisanImportDialog() {
		if (!currentRoastProfile?.roast_id) {
			alert('Please select a roast profile first');
			return;
		}

		// Check if there's existing data
		if ($roastData.length > 0) {
			const confirmed = confirm(
				'Warning: Importing an Artisan file will replace all existing roast data for this profile. This action cannot be undone. Continue?'
			);
			if (!confirmed) {
				return;
			}
		}

		showArtisanImport = true;
	}

	async function importArtisanFile() {
		if (!artisanImportFile || !currentRoastProfile?.roast_id) {
			alert('Please select a file and roast profile');
			return;
		}

		try {
			console.log(
				`Importing Artisan file ${artisanImportFile.name} for roast ID ${currentRoastProfile.roast_id}`
			);

			const formData = new FormData();
			formData.append('file', artisanImportFile);
			formData.append('roastId', currentRoastProfile.roast_id.toString());

			const response = await fetch('/api/artisan-import', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to import Artisan file');
			}

			const result = await response.json();
			console.log('Artisan import successful:', result);

			// Show detailed success message with comprehensive import information
			const totalMinutes = Math.floor((result.total_time || 0) / 60);
			const totalSeconds = Math.floor((result.total_time || 0) % 60);
			const milestoneCount = Object.keys(result.milestones || {}).filter(
				(key) => result.milestones[key] > 0
			).length;

			const message =
				`✅ Successfully imported Artisan roast profile!\n\n` +
				`📁 File: ${artisanImportFile.name}\n` +
				`📊 Temperature points: ${result.message.match(/\d+/)?.[0] || 'Unknown'}\n` +
				`⏱️ Roast duration: ${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}\n` +
				`🌡️ Temperature unit: ${result.temperature_unit}\n` +
				`🎯 Milestones: ${milestoneCount} detected\n` +
				`📈 Roast events: ${result.roast_events || 0}\n` +
				`📋 Roast phases: ${result.roast_phases || 0}\n` +
				`⚙️ Device data points: ${result.extra_device_points || 0}\n\n` +
				`Your coffee name has been preserved. The chart now shows both bean temperature (BT) and environmental temperature (ET) curves.`;

			alert(message);

			// Reload the profile data to show the imported data
			window.location.reload();
		} catch (error) {
			console.error('Artisan import failed:', error);
			alert(
				`Failed to import Artisan file: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			// Reset the import state
			showArtisanImport = false;
			artisanImportFile = null;
		}
	}

	function cancelArtisanImport() {
		showArtisanImport = false;
		artisanImportFile = null;
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
			<div
				bind:this={chartContainer}
				class="text-primary-light mx-auto h-[400px] w-full sm:h-[500px]"
			></div>
		</div>
	</div>

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
				<div
					class="flex w-full flex-row justify-center gap-8 bg-background-primary-light p-3 sm:w-64 sm:p-4 md:mr-4 md:border-r md:border-border-light lg:mr-4 lg:border-r lg:border-border-light"
				>
					<!-- Fan control -->
					<div class="flex flex-col items-center gap-2">
						<span class="text-sm font-medium text-text-secondary-light">FAN</span>
						<div class="flex flex-col items-center rounded-lg border-2 border-indigo-800">
							<button
								class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-indigo-900/80 hover:text-white"
								onclick={() => handleFanChange(Math.min(10, fanValue + 1))}
								disabled={fanValue >= 10}
							>
								+
							</button>
							<div
								class="flex h-10 w-10 items-center justify-center text-lg font-bold text-text-primary-light sm:h-12 sm:w-12 sm:text-xl"
							>
								{fanValue}
							</div>
							<button
								class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-indigo-900/80 hover:text-white"
								onclick={() => handleFanChange(Math.max(0, fanValue - 1))}
								disabled={fanValue <= 0}
							>
								-
							</button>
						</div>
					</div>

					<!-- Heat control -->
					<div class="flex flex-col items-center gap-2">
						<span class="text-sm font-medium text-text-secondary-light">HEAT</span>
						<div class="flex flex-col items-center rounded-lg border-2 border-amber-800">
							<button
								class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-amber-900/80 hover:text-white"
								onclick={() => handleHeatChange(Math.min(10, heatValue + 1))}
								disabled={heatValue >= 10}
							>
								+
							</button>
							<div
								class="flex h-10 w-10 items-center justify-center text-lg font-bold text-text-primary-light sm:h-12 sm:w-12 sm:text-xl"
							>
								{heatValue}
							</div>
							<button
								class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-amber-900/80 hover:text-white"
								onclick={() => handleHeatChange(Math.max(0, heatValue - 1))}
								disabled={heatValue <= 0}
							>
								-
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Roast events timeline (right side) -->
			<div class="flex-grow">
				{#if isBeforeRoasting || isDuringRoasting}
					<div class="mb-4">
						<h3 class="mb-2 text-sm font-medium text-text-secondary-light">ROAST EVENTS</h3>
						<div class="relative overflow-x-auto">
							<div
								class="rounded-lg border border-border-light bg-background-primary-light shadow-sm"
							>
								<!-- Mobile view: Grid layout with 2 buttons per row -->
								<div class="grid grid-cols-2 sm:hidden">
									{#each ['Charge', 'Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start', 'Drop', 'Cool End'] as event, i}
										<button
											type="button"
											class="cursor-pointer whitespace-nowrap p-2 text-center transition-colors hover:bg-background-tertiary-light/10 {selectedEvent ===
											event
												? 'bg-background-tertiary-light text-text-primary-light'
												: 'text-text-primary-light'} {!isRoasting
												? 'cursor-not-allowed opacity-50'
												: ''} {i % 2 !== 0 ? 'border-l border-border-light' : ''} {i > 1
												? 'border-t border-border-light'
												: ''}"
											onclick={() => isRoasting && handleEventLog(event)}
											disabled={!isRoasting}
										>
											<span class="block text-xs font-medium">{event}</span>
										</button>
									{/each}
								</div>

								<!-- Desktop view: Flex layout with all buttons in one row -->
								<div class="hidden w-full sm:flex">
									{#each ['Charge', 'Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start', 'Drop', 'Cool End'] as event, i}
										<button
											type="button"
											class="flex-1 cursor-pointer whitespace-nowrap p-3 text-center transition-colors hover:bg-background-tertiary-light/10 {selectedEvent ===
											event
												? 'bg-background-tertiary-light text-text-primary-light'
												: 'text-text-primary-light'} {!isRoasting
												? 'cursor-not-allowed opacity-50'
												: ''} {i !== 0 ? 'border-l border-border-light' : ''}"
											onclick={() => isRoasting && handleEventLog(event)}
											disabled={!isRoasting}
										>
											<span class="block text-sm font-medium">{event}</span>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Roast milestone timestamps -->
				<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">DRYING %</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">
							{dryingDisplay}
						</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">DRY END</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{tpDisplay}</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">MAILLARD %</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">
							{maillardDisplay}
						</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">FIRST CRACK</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{fcDisplay}</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">DEV %</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{devDisplay}</div>
					</div>
				</div>
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
							saveRoastProfile();
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
					onclick={() => {
						console.log('Manual save (fallback): currentRoastProfile =', currentRoastProfile);
						console.log('Manual save (fallback): About to call saveRoastProfile()');
						saveRoastProfile();
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
				onclick={showArtisanImportDialog}
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

<!-- Artisan Import Modal -->
{#if showArtisanImport}
	<div class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
		<button
			type="button"
			class="fixed inset-0 bg-black/50"
			onclick={cancelArtisanImport}
			aria-label="Close modal"
		></button>
		<div class="flex min-h-screen items-center justify-center p-4">
			<div
				class="relative w-full max-w-md rounded-lg bg-background-secondary-light p-6 shadow-xl"
				role="dialog"
				aria-modal="true"
			>
				<h3 class="mb-4 text-lg font-semibold text-text-primary-light">
					Import Artisan Roast File
				</h3>

				<div class="mb-4">
					<label
						for="artisan-file-input"
						class="mb-2 block text-sm font-medium text-text-primary-light"
					>
						Select Artisan .alog file:
					</label>
					<input
						id="artisan-file-input"
						type="file"
						accept=".alog,.alog.json,.json"
						onchange={handleArtisanFileSelect}
						class="block w-full text-sm text-text-primary-light file:mr-4 file:rounded file:border-0 file:bg-background-tertiary-light file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary-light hover:file:bg-background-primary-light"
					/>
					<p class="mt-2 text-xs text-text-secondary-light">
						Import roast profile data from Artisan roasting software. This will replace all existing
						imported data for this profile.
					</p>
				</div>

				{#if artisanImportFile}
					<p class="mb-4 text-sm text-green-600">
						Selected: {artisanImportFile.name}
					</p>
				{/if}

				<div class="flex justify-end space-x-3">
					<button
						type="button"
						class="rounded bg-background-primary-light px-4 py-2 text-text-primary-light hover:bg-background-tertiary-light"
						onclick={cancelArtisanImport}
					>
						Cancel
					</button>
					<button
						type="button"
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
						onclick={importArtisanFile}
						disabled={!artisanImportFile}
					>
						Import File
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
