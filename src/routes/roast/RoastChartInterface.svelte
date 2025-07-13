<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { select, scaleLinear, axisBottom, line, type Selection, type ScaleLinear } from 'd3';
	import { curveStepAfter } from 'd3-shape';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		profileLogs,
		type RoastPoint,
		type ProfileLogEntry,
		mysqlTimeToMs
	} from './stores';
	
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

	function extractMilestones(logs: ProfileLogEntry[], isLiveData = true): MilestoneData {
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

	function calculateMilestones(milestones: MilestoneData, currentTime?: number): MilestoneCalculations {
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
	let yScaleFan: ScaleLinear<number, number>;
	let yScaleHeat: ScaleLinear<number, number>;
	let yScaleTemp: ScaleLinear<number, number>;
	let height: number;
	let width: number;
	let margin = { top: 20, right: 60, bottom: 30, left: 80 };

	// Add these computed values
	let isBeforeRoasting = $derived(!currentRoastProfile?.roast_id || $roastData.length === 0);
	let isDuringRoasting = $derived(isRoasting);
	let isAfterRoasting = $derived($roastData.length > 0 && !isRoasting);

	// Handle profile changes
	$effect(() => {
		if (currentRoastProfile && isBeforeRoasting) {
			untrack(() => resetTimer());
		}
	});

	// Timer function
	function toggleTimer() {
		if (!isRoasting) {
			// Initial start
			$startTime = performance.now();
			$accumulatedTime = 0;

			// Log initial start event
			$profileLogs = [
				{
					fan_setting: fanValue,
					heat_setting: heatValue,
					start: true,
					maillard: false,
					fc_start: false,
					fc_rolling: false,
					fc_end: false,
					sc_start: false,
					drop: false,
					end: false,
					time: 0
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
		$profileLogs = [];
		isRoasting = false;
		isPaused = false;
	}

	let formattedTime = $derived(
		isAfterRoasting
			? (() => {
					// Create a copy of events and handle Drop/End renaming
					const events = $roastEvents.map((event) => ({
						time: event.time,
						name: event.name
					}));

					// Check for duplicate 'Drop' events and rename second occurrence to 'End'
					let dropCount = 0;
					events.forEach((event) => {
						if (event.name === 'Drop') {
							dropCount++;
							if (dropCount > 1) {
								event.name = 'End';
							}
						}
					});

					// Sort events by time and find the End event
					events.sort((a, b) => a.time - b.time);
					const endEvent = events.find((event) => event.name === 'End');

					if (endEvent) {
						const endSeconds = Math.floor(endEvent.time / 1000);
						const endMilliseconds = endEvent.time % 1000;
						return `${Math.floor(endSeconds / 60)}:${(endSeconds % 60)
							.toString()
							.padStart(2, '0')}.${Math.floor(endMilliseconds / 10)
							.toString()
							.padStart(2, '0')}`;
					}
					return `${Math.floor(seconds / 60)}:${(seconds % 60)
						.toString()
						.padStart(2, '0')}.${Math.floor(milliseconds / 10)
						.toString()
						.padStart(2, '0')}`;
				})()
			: `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor(
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

	// Create line generators
	const heatLine = line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleHeat(d.heat))
		.curve(curveStepAfter);

	const fanLine = line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleFan(d.fan))
		.curve(curveStepAfter);

	const tempLine = line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => (d.bean_temp !== null && d.bean_temp !== undefined ? yScaleTemp(d.bean_temp) : 0))
		.defined((d) => d.bean_temp !== null && d.bean_temp !== undefined)
		.curve(curveStepAfter);

	function updateChart(data: RoastPoint[]) {
		if (!svg || !xScale || !yScaleFan || !yScaleHeat || !yScaleTemp) return;

		// Sort data by time first
		const sortedData = [...data].sort((a, b) => a.time - b.time);

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
				bean_temp: point.bean_temp
			};
		});

		// Clear existing elements
		svg.selectAll('.heat-line').remove();
		svg.selectAll('.fan-line').remove();
		svg.selectAll('.temp-line').remove();
		svg.selectAll('.heat-label').remove();
		svg.selectAll('.fan-label').remove();
		svg.selectAll('.temp-label').remove();
		svg.selectAll('.event-marker').remove();
		svg.selectAll('.event-label').remove();

		// Create combined events array and handle Drop/End renaming
		const eventData = $roastEvents.map((event) => ({
			time: event.time,
			name: event.name
		}));

		// Check for duplicate 'drop' events and rename second occurrence to 'End'
		let dropCount = 0;
		eventData.forEach((event) => {
			if (event.name === 'Drop') {
				dropCount++;
				if (dropCount > 1) {
					event.name = 'End';
				}
			}
		});

		// Sort events by time to ensure proper ordering
		eventData.sort((a, b) => a.time - b.time);

		// Update x-axis scale based on data duration or End event
		const endEvent = eventData.find((event) => event.name === 'End');
		const maxTime =
			data.length > 0
				? endEvent
					? endEvent.time / (1000 * 60) // Convert end event time to minutes
					: Math.max(...data.map((d) => d.time / (1000 * 60))) // Convert data time to minutes
				: 12; // Default to 12 if no data

		xScale.domain([0, maxTime]);

		// Update time tracker position
		if (isRoasting && !isPaused) {
			const currentTime = (performance.now() - $startTime! + $accumulatedTime) / (1000 * 60);
			svg
				.select('.time-tracker')
				.style('display', 'block')
				.attr('x1', xScale(currentTime))
				.attr('x2', xScale(currentTime));
		} else {
			svg.select('.time-tracker').style('display', 'none');
		}

		// Update x-axis with type assertion
		svg.select('.x-axis').call(axisBottom(xScale) as any);

		// Add heat line
		svg
			.append('path')
			.attr('class', 'heat-line')
			.datum(processedData)
			.attr('fill', 'none')
			.attr('stroke', '#b45309')
			.attr('stroke-width', 2)
			.attr('d', heatLine);

		// Add fan line
		svg
			.append('path')
			.attr('class', 'fan-line')
			.datum(processedData)
			.attr('fill', 'none')
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2)
			.attr('d', fanLine);

		// Add temperature line if data exists
		const tempData = processedData.filter((d) => d.bean_temp !== null && d.bean_temp !== undefined);
		if (tempData.length > 0) {
			svg
				.append('path')
				.attr('class', 'temp-line')
				.datum(tempData)
				.attr('fill', 'none')
				.attr('stroke', '#dc2626')
				.attr('stroke-width', 3)
				.attr('d', tempLine);
		}

		// Add heat value labels with improved legibility
		const heatChanges = processedData.filter(
			(d, i) => i === 0 || d.heat !== processedData[i - 1].heat
		);
		svg
			.selectAll('.heat-label')
			.data(heatChanges)
			.enter()
			.append('text')
			.attr('class', 'heat-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleHeat(d.heat))
			.attr('dy', -8)
			.attr('fill', '#b45309')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.attr('text-shadow', '0px 0px 3px rgba(0,0,0,0.7)')
			.text((d) => d.heat);

		// Add fan value labels with improved legibility
		const fanChanges = processedData.filter(
			(d, i) => i === 0 || d.fan !== processedData[i - 1].fan
		);
		svg
			.selectAll('.fan-label')
			.data(fanChanges)
			.enter()
			.append('text')
			.attr('class', 'fan-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleFan(d.fan))
			.attr('dy', -8)
			.attr('fill', '#3730a3')
			.attr('font-size', '14px')
			.attr('font-weight', 'bold')
			.attr('text-shadow', '0px 0px 3px rgba(0,0,0,0.7)')
			.text((d) => d.fan);

		// Update event markers - Create separate groups for each event
		const eventGroups = svg
			.selectAll('.event-group')
			.data(eventData)
			.join('g')
			.attr('class', 'event-group');

		// Add or update event lines
		eventGroups
			.selectAll('.event-marker')
			.data((d) => [d])
			.join('line')
			.attr('class', 'event-marker')
			.attr('x1', (d) => xScale(d.time / (1000 * 60)))
			.attr('x2', (d) => xScale(d.time / (1000 * 60)))
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#4ade80')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,4');

		// Add or update event labels
		eventGroups
			.selectAll('.event-label')
			.data((d) => [d])
			.join('text')
			.attr('class', 'event-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', 10)
			.text((d) => d.name)
			.attr('fill', '#4ade80')
			.attr('font-size', '12px')
			.attr('text-anchor', 'end')
			.attr('transform', (d) => `rotate(-90, ${xScale(d.time / (1000 * 60))}, 10)`);
	}

	// Update chart when roastData changes
	$effect(() => {
		const data = $roastData;
		if (
			svg !== undefined &&
			xScale !== undefined &&
			yScaleFan !== undefined &&
			yScaleHeat !== undefined
		) {
			untrack(() => updateChart(data));
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

		// Update scales
		xScale.range([0, width]);
		yScaleFan.range([height, 0]);
		yScaleHeat.range([height, 0]);
		yScaleTemp.range([height, 0]);

		// Clear and redraw background grid
		svg.selectAll('.heat-zone').remove();
		svg.selectAll('.fan-zone').remove();
		svg.selectAll('.temp-grid').remove();
		svg.selectAll('.y-value-indicator').remove();
		svg.selectAll('.temp-axis-label').remove();

		// Redraw background grid shading for values 1-10
		for (let i = 0; i <= 10; i++) {
			// Skip the first and last to avoid unnecessary borders
			if (i > 0 && i < 10) {
				// Calculate heights ensuring they're positive
				const heatZoneHeight = Math.abs(yScaleHeat(i - 1) - yScaleHeat(i));
				const fanZoneHeight = Math.abs(yScaleFan(i - 1) - yScaleFan(i));

				// Add heat zone shading (amber)
				svg
					.append('rect')
					.attr('class', 'heat-zone')
					.attr('x', 0)
					.attr('y', Math.min(yScaleHeat(i), yScaleHeat(i - 1)))
					.attr('width', width)
					.attr('height', heatZoneHeight)
					.attr('fill', i % 2 === 0 ? 'rgba(180, 83, 9, 0.05)' : 'rgba(180, 83, 9, 0.1)')
					.attr('stroke', 'none');

				// Add fan zone shading (indigo)
				svg
					.append('rect')
					.attr('class', 'fan-zone')
					.attr('x', 0)
					.attr('y', Math.min(yScaleFan(i), yScaleFan(i - 1)))
					.attr('width', width)
					.attr('height', fanZoneHeight)
					.attr('fill', i % 2 === 0 ? 'rgba(55, 48, 163, 0.05)' : 'rgba(55, 48, 163, 0.1)')
					.attr('stroke', 'none');

				// Add value indicators on both sides
				svg
					.append('text')
					.attr('class', 'y-value-indicator')
					.attr('x', -10)
					.attr('y', yScaleFan(i))
					.attr('dy', '0.3em')
					.attr('text-anchor', 'end')
					.attr('fill', '#3730a3')
					.attr('font-size', '10px')
					.text(i);

				svg
					.append('text')
					.attr('class', 'y-value-indicator')
					.attr('x', width + 10)
					.attr('y', yScaleHeat(i))
					.attr('dy', '0.3em')
					.attr('text-anchor', 'start')
					.attr('fill', '#b45309')
					.attr('font-size', '10px')
					.text(i);
			}
		}

		// Add temperature grid lines and labels on the left
		for (let temp = 100; temp <= 500; temp += 50) {
			svg
				.append('line')
				.attr('class', 'temp-grid')
				.attr('x1', 0)
				.attr('x2', width)
				.attr('y1', yScaleTemp(temp))
				.attr('y2', yScaleTemp(temp))
				.attr('stroke', '#dc2626')
				.attr('stroke-width', 0.5)
				.attr('opacity', 0.2);

			svg
				.append('text')
				.attr('class', 'temp-axis-label')
				.attr('x', -50)
				.attr('y', yScaleTemp(temp))
				.attr('dy', '0.3em')
				.attr('text-anchor', 'end')
				.attr('fill', '#dc2626')
				.attr('font-size', '10px')
				.text(`${temp}°F`);
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

		xScale = scaleLinear().domain([0, 12]).range([0, width]);
		yScaleFan = scaleLinear().domain([10, 0]).range([height, 0]);
		yScaleHeat = scaleLinear().domain([0, 10]).range([height, 0]);
		yScaleTemp = scaleLinear().domain([0, 500]).range([height, 0]); // Temperature scale in Fahrenheit

		// Add background grid shading for values 1-10
		for (let i = 0; i <= 10; i++) {
			// Skip the first and last to avoid unnecessary borders
			if (i > 0 && i < 10) {
				// Calculate heights ensuring they're positive
				const heatZoneHeight = Math.abs(yScaleHeat(i - 1) - yScaleHeat(i));
				const fanZoneHeight = Math.abs(yScaleFan(i - 1) - yScaleFan(i));

				// Add heat zone shading (amber)
				svg
					.append('rect')
					.attr('class', 'heat-zone')
					.attr('x', 0)
					.attr('y', Math.min(yScaleHeat(i), yScaleHeat(i - 1)))
					.attr('width', width)
					.attr('height', heatZoneHeight)
					.attr('fill', i % 2 === 0 ? 'rgba(180, 83, 9, 0.05)' : 'rgba(180, 83, 9, 0.1)')
					.attr('stroke', 'none');

				// Add fan zone shading (indigo)
				svg
					.append('rect')
					.attr('class', 'fan-zone')
					.attr('x', 0)
					.attr('y', Math.min(yScaleFan(i), yScaleFan(i - 1)))
					.attr('width', width)
					.attr('height', fanZoneHeight)
					.attr('fill', i % 2 === 0 ? 'rgba(55, 48, 163, 0.05)' : 'rgba(55, 48, 163, 0.1)')
					.attr('stroke', 'none');

				// Add value indicators on both sides
				svg
					.append('text')
					.attr('class', 'y-value-indicator')
					.attr('x', -10)
					.attr('y', yScaleFan(i))
					.attr('dy', '0.3em')
					.attr('text-anchor', 'end')
					.attr('fill', '#3730a3')
					.attr('font-size', '10px')
					.text(i);

				svg
					.append('text')
					.attr('class', 'y-value-indicator')
					.attr('x', width + 10)
					.attr('y', yScaleHeat(i))
					.attr('dy', '0.3em')
					.attr('text-anchor', 'start')
					.attr('fill', '#b45309')
					.attr('font-size', '10px')
					.text(i);
			}
		}

		// Add x-axis
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale) as any);

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

	function prepareProfileLogsForSave() {
		if ($profileLogs.length === 0) return $profileLogs;

		const lastTime = $roastData[$roastData.length - 1]?.time || 0;

		// Check if the last log entry is a 'Drop' event
		const lastLog = $profileLogs[$profileLogs.length - 1];
		if (lastLog && lastLog.drop) {
			// If the last event was 'Drop', add a new 'End' entry
			$profileLogs = [
				...$profileLogs,
				{
					fan_setting: fanValue,
					heat_setting: 0, // Set heat to 0 at end
					start: false,
					maillard: false,
					fc_start: false,
					fc_rolling: false,
					fc_end: false,
					sc_start: false,
					drop: false,
					end: true,
					time: lastTime
				}
			];
		}

		return $profileLogs;
	}

	function handleEventLog(event: string) {
		console.log('handleEventLog called with event:', event);
		if ($startTime === null) return;
		selectedEvent = event;
		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		// Check if this event already exists at this time
		const existingEvent = $roastEvents.find(
			(e) => e.name === event && Math.abs(e.time - currentTime) < 1000
		);
		if (!existingEvent) {
			// Add to roastEvents for chart display
			$roastEvents = [
				...$roastEvents,
				{
					time: currentTime,
					name: event
				}
			];

			// Special handling for Drop and Cool End events
			if (event === 'Drop') {
				heatValue = 0; // Set heat to 0 when Drop is logged
				updateHeat(0);
			} else if (event === 'Cool End') {
				// Stop the roast timer and save the log
				if (timerInterval) clearInterval(timerInterval);
				if (dataLoggingInterval) clearInterval(dataLoggingInterval);
				isRoasting = false;
				isPaused = false;

				// Automatically save the roast profile
				prepareProfileLogsForSave();
				saveRoastProfile();
			}

			// Create profile log entry
			const logEntry: ProfileLogEntry = {
				fan_setting: fanValue,
				heat_setting: event === 'Drop' ? 0 : heatValue, // Set heat to 0 if Drop event
				start: false,
				maillard: event === 'Maillard',
				fc_start: event === 'FC Start',
				fc_rolling: event === 'FC Rolling',
				fc_end: event === 'FC End',
				sc_start: event === 'SC Start',
				drop: event === 'Drop',
				end: event === 'Cool End', // End is set for Cool End event
				time: currentTime,
				charge: event === 'Charge'
			};

			$profileLogs = [...$profileLogs, logEntry];
			console.log('NEW EVENT');
		}
	}

	// Add this function to handle settings changes
	function handleSettingsChange() {
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		// Create profile log entry for settings change
		const logEntry: ProfileLogEntry = {
			fan_setting: fanValue,
			heat_setting: heatValue,
			start: false,
			maillard: false,
			fc_start: false,
			fc_rolling: false,
			fc_end: false,
			sc_start: false,
			drop: false,
			end: false,
			time: currentTime
		};

		$profileLogs = [...$profileLogs, logEntry];
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


	// Saved profile data for milestone calculations
	let savedProfileLogs = $state<ProfileLogEntry[]>([]);

	// Reactive milestone calculations using SvelteKit 5 syntax
	let milestoneCalculations = $derived(() => {
		// Use live data during roasting, saved data when viewing completed profiles
		const logs = isDuringRoasting ? $profileLogs : savedProfileLogs;
		const isLiveData = isDuringRoasting;
		
		// Include seconds and milliseconds in dependency to trigger updates every tick
		const currentSeconds = seconds;
		const currentMilliseconds = milliseconds;
		
		if (logs.length === 0) {
			return {
				totalTime: 0,
				dryingPercent: 0,
				tpTime: 0,
				maillardPercent: 0,
				fcTime: 0,
				devPercent: 0
			};
		}
		
		const milestones = extractMilestones(logs, isLiveData);
		
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
	let dryingDisplay = $derived(milestoneCalculations().dryingPercent > 0 ? `${milestoneCalculations().dryingPercent.toFixed(1)}%` : '--:--');
	let tpDisplay = $derived(formatTimeDisplay(milestoneCalculations().tpTime));
	let maillardDisplay = $derived(milestoneCalculations().maillardPercent > 0 ? `${milestoneCalculations().maillardPercent.toFixed(1)}%` : '--:--');
	let fcDisplay = $derived(formatTimeDisplay(milestoneCalculations().fcTime));
	let devDisplay = $derived(milestoneCalculations().devPercent > 0 ? `${milestoneCalculations().devPercent.toFixed(1)}%` : '--:--');

	// Load saved profile logs when a roast profile is selected
	async function loadSavedProfileLogs(roastId: number) {
		try {
			const response = await fetch(`/api/profile-log?roast_id=${roastId}`);
			if (response.ok) {
				const result = await response.json();
				savedProfileLogs = result.data || [];
			} else {
				console.warn('Failed to load profile logs:', response.statusText);
				savedProfileLogs = [];
			}
		} catch (error) {
			console.error('Error loading profile logs:', error);
			savedProfileLogs = [];
		}
	}

	// Effect to load saved data when currentRoastProfile changes
	$effect(() => {
		if (currentRoastProfile?.roast_id && !isDuringRoasting) {
			untrack(() => loadSavedProfileLogs(currentRoastProfile.roast_id));
		} else if (!currentRoastProfile?.roast_id) {
			savedProfileLogs = [];
		}
	});

	// Artisan import functions
	function handleArtisanFileSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) {
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

			// Reload the profile data to show the imported data
			window.location.reload();

			alert(
				`Successfully imported ${result.dataPointsCount} data points from ${artisanImportFile.name}`
			);
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
			<div class="text-3xl font-bold text-text-primary-light sm:text-4xl md:text-5xl">
				{formattedTime}
			</div>
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
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{dryingDisplay}</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">TP</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{tpDisplay}</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">MAILLARD %</span>
						<div class="text-base font-bold text-text-primary-light sm:text-lg">{maillardDisplay}</div>
					</div>
					<div
						class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
					>
						<span class="text-xs text-text-secondary-light">FC</span>
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
			<button
				class="w-full rounded border-2 border-zinc-500 px-3 py-1 text-text-primary-light hover:bg-background-primary-light sm:w-auto"
				onclick={() => {
					prepareProfileLogsForSave();
					saveRoastProfile();
				}}
				disabled={!isRoasting && $profileLogs.length === 0}
			>
				Save Roast
			</button>
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
						Select Artisan CSV or XLSX file:
					</label>
					<input
						id="artisan-file-input"
						type="file"
						accept=".csv,.xlsx"
						onchange={handleArtisanFileSelect}
						class="block w-full text-sm text-text-primary-light file:mr-4 file:rounded file:border-0 file:bg-background-tertiary-light file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-primary-light hover:file:bg-background-primary-light"
					/>
					<p class="mt-2 text-xs text-text-secondary-light">
						This will replace all existing roast data for this profile.
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
