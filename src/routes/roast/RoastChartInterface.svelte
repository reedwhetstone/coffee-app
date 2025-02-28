<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as d3 from 'd3';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		profileLogs,
		type RoastPoint,
		type ProfileLogEntry
	} from './stores';
	import { curveStepAfter } from 'd3-shape';

	export let isRoasting = false;
	export let isPaused = false;
	export let fanValue: number;
	export let heatValue: number;
	export let currentRoastProfile: any | null = null;
	export let selectedEvent: string | null;
	export let updateFan: (value: number) => void;
	export let updateHeat: (value: number) => void;
	export let saveRoastProfile: () => void;
	export let selectedBean: { id?: number; name: string };
	export let clearRoastData: () => void;

	let seconds = 0;
	let milliseconds = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let dataLoggingInterval: ReturnType<typeof setInterval> | null = null;

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = false;
	const LONG_PRESS_DURATION = 1000;

	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGGElement, unknown, null, undefined>;
	let xScale: d3.ScaleLinear<number, number>;
	let yScaleFan: d3.ScaleLinear<number, number>;
	let yScaleHeat: d3.ScaleLinear<number, number>;
	let height: number;
	let width: number;
	let margin = { top: 20, right: 60, bottom: 30, left: 60 };

	// Handle profile changes
	$: if (currentRoastProfile) {
		if (isBeforeRoasting) {
			resetTimer();
		}
	}

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

	$: formattedTime = isAfterRoasting
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
				.padStart(2, '0')}`;

	// Update current values when roastData changes
	$: {
		if ($roastData.length > 0 && isDuringRoasting) {
			const lastDataPoint = $roastData[$roastData.length - 1];
			fanValue = lastDataPoint.fan;
			heatValue = lastDataPoint.heat;
		}
	}

	// Create line generators
	const heatLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleHeat(d.heat))
		.curve(curveStepAfter);

	const fanLine = d3
		.line<RoastPoint>()
		.x((d) => xScale(d.time / (1000 * 60)))
		.y((d) => yScaleFan(d.fan))
		.curve(curveStepAfter);

	function updateChart(data: RoastPoint[]) {
		if (!svg || !xScale || !yScaleFan || !yScaleHeat) return;

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
				fan: point.fan ?? lastFan
			};
		});

		// Clear existing elements
		svg.selectAll('.heat-line').remove();
		svg.selectAll('.fan-line').remove();
		svg.selectAll('.heat-label').remove();
		svg.selectAll('.fan-label').remove();
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
		svg.select('.x-axis').call(d3.axisBottom(xScale) as any);

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
	$: if (
		svg !== undefined &&
		xScale !== undefined &&
		yScaleFan !== undefined &&
		yScaleHeat !== undefined
	) {
		updateChart($roastData);
	}

	function updateChartDimensions() {
		if (!chartContainer || !svg) return;

		width = chartContainer.clientWidth - margin.left - margin.right;
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		// Update SVG dimensions
		d3.select(chartContainer)
			.select('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom);

		// Update scales
		xScale.range([0, width]);
		yScaleFan.range([height, 0]);
		yScaleHeat.range([height, 0]);

		// Clear and redraw background grid
		svg.selectAll('.heat-zone').remove();
		svg.selectAll('.fan-zone').remove();
		svg.selectAll('.y-value-indicator').remove();

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

		// Update x-axis only
		svg
			.select('.x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale) as any);

		// Update chart with new dimensions
		updateChart($roastData);
	}

	onMount(() => {
		// Initial setup
		width = chartContainer.clientWidth - margin.left - margin.right;
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		xScale = d3.scaleLinear().domain([0, 12]).range([0, width]);
		yScaleFan = d3.scaleLinear().domain([10, 0]).range([height, 0]);
		yScaleHeat = d3.scaleLinear().domain([0, 10]).range([height, 0]);

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

		// Add time tracker line
		svg
			.append('line')
			.attr('class', 'time-tracker')
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 1)
			.style('display', 'none');

		// Add x-axis only
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale));

		// Initial chart update
		updateChart($roastData);

		// Add resize listener
		const resizeObserver = new ResizeObserver(() => {
			updateChartDimensions();
		});
		resizeObserver.observe(chartContainer);

		// Cleanup observer on component destroy
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

			// Special handling for Drop event
			if (event === 'Drop') {
				heatValue = 0; // Set heat to 0 when Drop is logged
				updateHeat(0);
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
				end: false, // End is handled in prepareProfileLogsForSave
				time: currentTime
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
	}

	function handleHeatChange(value: number) {
		updateHeat(value);
	}

	// Add these computed values at the top of the script
	$: isBeforeRoasting = !currentRoastProfile?.roast_id || $roastData.length === 0;
	$: isDuringRoasting = isRoasting;
	$: isAfterRoasting = $roastData.length > 0 && !isRoasting;
</script>

<div>
	<!-- Roast session header -->
	<div class="mb-3 flex flex-wrap justify-between">
		<h1 class="text-xl font-bold text-zinc-300 sm:text-2xl">Roast Session: {selectedBean.name}</h1>
	</div>

	<!-- Main roasting controls: fan, chart, and heat -->
	<div class="flex h-[500px] w-full flex-col justify-center gap-4 sm:flex-row">
		<!-- Fan buttons -->
		{#if isBeforeRoasting || isDuringRoasting}
			<div class="flex flex-row justify-center gap-2 sm:my-5 sm:flex-col">
				<button
					class="rounded border-2 border-indigo-800 px-3 py-1 text-zinc-300 hover:bg-indigo-900"
					on:click={() => handleFanChange(Math.min(10, fanValue + 1))}
					disabled={fanValue >= 10}
				>
					▲
				</button>
				<div
					class="flex h-10 w-20 items-center justify-center rounded border-2 border-indigo-800 px-3 text-xl text-zinc-300 sm:w-auto"
				>
					{fanValue}
				</div>
				<button
					class="rounded border-2 border-indigo-800 px-3 py-1 text-zinc-300 hover:bg-indigo-900"
					on:click={() => handleFanChange(Math.max(0, fanValue - 1))}
					disabled={fanValue <= 0}
				>
					▼
				</button>
			</div>
		{/if}

		<!-- Chart -->
		<div class="min-w-0 flex-grow">
			<div bind:this={chartContainer} class="h-full w-full text-zinc-400"></div>
		</div>

		<!-- Heat buttons -->
		{#if isBeforeRoasting || isDuringRoasting}
			<div class="flex flex-row justify-center gap-2 sm:my-5 sm:flex-col">
				<button
					class="rounded border-2 border-amber-800 px-3 py-1 text-zinc-300 hover:bg-amber-900"
					on:click={() => handleHeatChange(Math.min(10, heatValue + 1))}
					disabled={heatValue >= 10}
				>
					▲
				</button>
				<div
					class="flex h-10 w-20 items-center justify-center rounded border-2 border-amber-800 px-3 text-xl text-zinc-300 sm:w-auto"
				>
					{heatValue}
				</div>
				<button
					class="rounded border-2 border-amber-800 px-3 py-1 text-zinc-300 hover:bg-amber-900"
					on:click={() => handleHeatChange(Math.max(0, heatValue - 1))}
					disabled={heatValue <= 0}
				>
					▼
				</button>
			</div>
		{/if}
	</div>

	<!-- Roast event controls and timer -->
	<div class="z-0 mt-4 flex flex-col flex-wrap items-center justify-center gap-4 sm:flex-row">
		<div class="flex items-center gap-4">
			<div class="w-36 text-3xl font-bold text-zinc-300 sm:w-48 sm:text-5xl">{formattedTime}</div>
			{#if isBeforeRoasting || isDuringRoasting}
				<button
					id="start-end-roast"
					class="rounded border-2 border-green-800 px-3 py-1 text-zinc-300 hover:bg-green-900"
					on:mousedown={(e) => {
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
					on:click={() => {
						if (!isLongPressing) {
							toggleTimer();
						}
					}}
					on:mouseup={() => {
						if (pressTimer) {
							clearTimeout(pressTimer);
							pressTimer = null;
						}
						isLongPressing = false;
					}}
					on:mouseleave={() => {
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

		{#if isBeforeRoasting || isDuringRoasting}
			<div class="flex flex-wrap justify-center gap-2">
				{#each ['Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start', 'Drop'] as event}
					<label
						class="flex items-center rounded border-2 border-green-800 px-3 py-1 text-sm text-zinc-300 hover:bg-green-900 sm:text-base"
						class:bg-green-900={selectedEvent === event}
						class:opacity-50={!isRoasting}
						class:cursor-not-allowed={!isRoasting}
						class:hover:bg-transparent={!isRoasting}
					>
						<input
							type="radio"
							name="roastEvent"
							value={event}
							on:change={() => handleEventLog(event)}
							checked={selectedEvent === event}
							class="hidden"
							disabled={!isRoasting}
						/>
						{event}
					</label>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Roast milestone timestamps -->
	<div class="mt-4 flex flex-wrap justify-center space-x-2 sm:justify-end sm:space-x-4">
		<div class="text-lg font-bold text-zinc-300 sm:text-2xl">DRYING %: --:--</div>
		<div class="text-lg font-bold text-zinc-300 sm:text-2xl">TP: --:--</div>
		<div class="text-lg font-bold text-zinc-300 sm:text-2xl">MAILLARD %: --:--</div>
		<div class="text-lg font-bold text-zinc-300 sm:text-2xl">FC: --:--</div>
		<div class="text-lg font-bold text-zinc-300 sm:text-2xl">DEV %: --:--</div>
	</div>

	<!-- Save and Clear roast buttons -->
	<div class="mt-4 flex justify-end gap-4">
		{#if isBeforeRoasting || isDuringRoasting}
			<button
				class="hover:bg-light-cream rounded border-2 border-zinc-500 px-3 py-1 text-zinc-300"
				on:click={() => {
					prepareProfileLogsForSave();
					saveRoastProfile();
				}}
				disabled={!isRoasting && $profileLogs.length === 0}
			>
				Save Roast
			</button>
		{/if}
		{#if !isBeforeRoasting}
			<button
				class="rounded border-2 border-red-800 px-3 py-1 text-zinc-300 hover:bg-red-950"
				on:click={() => {
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
