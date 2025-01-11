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
	export let selectedBean: { name: string };
	export let logEvent: (event: string) => void;
	export let hasLogData = false;
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

	let currentFanValue = 10;
	let currentHeatValue = 0;

	// Handle profile changes
	$: if (currentRoastProfile) {
		if (!currentRoastProfile.has_log_data) {
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

	$: formattedTime = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor(
		milliseconds / 10
	)
		.toString()
		.padStart(2, '0')}`;

	// Update current values when roastData changes
	$: if ($roastData.length > 0) {
		const lastDataPoint = $roastData[$roastData.length - 1];
		currentFanValue = lastDataPoint.fan;
		currentHeatValue = lastDataPoint.heat;
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

		// Clear existing elements
		svg.selectAll('.heat-line').remove();
		svg.selectAll('.fan-line').remove();
		svg.selectAll('.heat-label').remove();
		svg.selectAll('.fan-label').remove();
		svg.selectAll('.event-marker').remove();
		svg.selectAll('.event-label').remove();

		// Update x-axis scale based on data duration
		const maxTime = Math.max(...data.map((d) => d.time));
		const timeInMinutes = maxTime / (1000 * 60);
		xScale.domain([0, Math.max(10, Math.ceil(timeInMinutes))]);

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

		// Update axes with type assertion
		svg.select('.x-axis').call(d3.axisBottom(xScale) as any);

		// Add heat line
		svg
			.append('path')
			.attr('class', 'heat-line')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#b45309')
			.attr('stroke-width', 2)
			.attr('d', heatLine);

		// Add fan line
		svg
			.append('path')
			.attr('class', 'fan-line')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#3730a3')
			.attr('stroke-width', 2)
			.attr('d', fanLine);

		// Add heat value labels
		const heatChanges = data.filter((d, i) => i === 0 || d.heat !== data[i - 1].heat);
		svg
			.selectAll('.heat-label')
			.data(heatChanges)
			.enter()
			.append('text')
			.attr('class', 'heat-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleHeat(d.heat))
			.attr('dy', -5)
			.attr('fill', '#b45309')
			.attr('font-size', '12px')
			.text((d) => d.heat);

		// Add fan value labels
		const fanChanges = data.filter((d, i) => i === 0 || d.fan !== data[i - 1].fan);
		svg
			.selectAll('.fan-label')
			.data(fanChanges)
			.enter()
			.append('text')
			.attr('class', 'fan-label')
			.attr('x', (d) => xScale(d.time / (1000 * 60)))
			.attr('y', (d) => yScaleFan(d.fan))
			.attr('dy', -5)
			.attr('fill', '#3730a3')
			.attr('font-size', '12px')
			.text((d) => d.fan);

		// Create combined events array that includes both roastEvents and end events
		const eventData = $roastEvents.map((event) => ({
			time: event.time,
			name: event.name
		}));

		// Sort events by time to ensure proper ordering
		eventData.sort((a, b) => a.time - b.time);

		// Keep all events (no filtering for duplicates)
		const uniqueEventData = eventData;

		// Update event markers - Create separate groups for each event
		const eventGroups = svg
			.selectAll('.event-group')
			.data(uniqueEventData)
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

	onMount(() => {
		const margin = { top: 20, right: 60, bottom: 30, left: 60 };
		width = chartContainer.clientWidth - margin.left - margin.right;
		height = chartContainer.clientHeight - margin.top - margin.bottom;

		svg = d3
			.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		xScale = d3.scaleLinear().domain([0, 10]).range([0, width]);
		yScaleFan = d3.scaleLinear().domain([10, 0]).range([height, 0]);
		yScaleHeat = d3.scaleLinear().domain([0, 10]).range([height, 0]);

		// Add time tracker line
		svg
			.append('line')
			.attr('class', 'time-tracker')
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 1)
			.style('display', 'none');

		// Add axes
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(xScale));

		svg.append('g').call(d3.axisLeft(yScaleFan));

		svg.append('g').attr('transform', `translate(${width},0)`).call(d3.axisRight(yScaleHeat));

		// Initial chart update
		updateChart($roastData);
	});

	function handleEventLog(event: string) {
		if ($startTime === null) return;
		selectedEvent = event;
		logEvent(event);
		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		// Add to roastEvents for chart display
		$roastEvents = [
			...$roastEvents,
			{
				time: currentTime,
				name: event
			}
		];

		// Create profile log entry
		const logEntry: ProfileLogEntry = {
			fan_setting: fanValue,
			heat_setting: heatValue,
			start: false,
			maillard: event === 'Maillard',
			fc_start: event === 'FC Start',
			fc_rolling: event === 'FC Rolling',
			fc_end: event === 'FC End',
			sc_start: event === 'SC Start',
			drop: event === 'Drop',
			end: false,
			time: currentTime
		};

		$profileLogs = [...$profileLogs, logEntry];
	}

	function prepareProfileLogsForSave() {
		if ($profileLogs.length === 0) return $profileLogs;

		const lastTime = $roastData[$roastData.length - 1]?.time || 0;

		// Update the last log entry or create a new one with end=true
		const lastLog = $profileLogs[$profileLogs.length - 1];
		if (lastLog && lastLog.drop) {
			// Create a new final entry instead of modifying the drop entry
			$profileLogs = [
				...$profileLogs,
				{
					fan_setting: fanValue,
					heat_setting: heatValue,
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
		} else {
			$profileLogs = [
				...$profileLogs,
				{
					fan_setting: fanValue,
					heat_setting: heatValue,
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
</script>

<div>
	<!-- Roast session header -->
	<div class="mb-3 flex justify-between">
		<h1 class="text-2xl font-bold text-zinc-500">Roast Session: {selectedBean.name}</h1>
	</div>

	<!-- Roast milestone timestamps -->
	<div class="flex justify-end space-x-4">
		<div class="text-2xl font-bold text-zinc-500">TP: --:--</div>
		<div class="text-2xl font-bold text-zinc-500">FC: --:--</div>
	</div>

	<!-- Main roasting controls: fan, chart, and heat -->
	<div class="flex h-[500px] w-full justify-center">
		<!-- Fan buttons -->
		<div class="my-5 flex flex-col justify-between">
			{#each Array(11) as _, i}
				<label
					class="rounded border-2 border-indigo-800 px-3 py-1 text-zinc-500 hover:bg-indigo-900"
					class:bg-indigo-900={fanValue === i}
				>
					<input
						type="radio"
						name="fanSetting"
						value={i}
						on:change={() => {
							updateFan(i);
							handleSettingsChange();
						}}
						checked={fanValue === i}
						class="hidden"
					/>
					{i}
				</label>
			{/each}
		</div>

		<!-- Chart -->
		<div bind:this={chartContainer} class="h-full w-full text-zinc-400"></div>

		<!-- Heat buttons -->
		<div class="my-5 flex flex-col justify-between">
			{#each Array.from({ length: 11 }, (_, i) => 10 - i) as value}
				<label
					class="rounded border-2 border-amber-800 px-3 py-1 text-zinc-500 hover:bg-amber-900"
					class:bg-amber-900={heatValue === value}
				>
					<input
						type="radio"
						name="heatSetting"
						{value}
						on:change={() => {
							updateHeat(value);
							handleSettingsChange();
						}}
						checked={heatValue === value}
						class="hidden"
					/>
					{value}
				</label>
			{/each}
		</div>
	</div>

	<!-- Roast event controls and timer -->
	<div class="z-0 flex flex-wrap items-center justify-center gap-4">
		<div class="flex items-center gap-4">
			<div class="w-48 text-5xl font-bold text-zinc-500">{formattedTime}</div>
			<button
				id="start-end-roast"
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
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
				disabled={hasLogData}
				class:opacity-50={hasLogData}
				class:cursor-not-allowed={hasLogData}
			>
				{isRoasting ? (isPaused ? 'Resume' : 'Stop') : 'Start'}
			</button>
		</div>

		{#each ['Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start', 'Drop'] as event}
			<label
				class="flex items-center rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
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

	<!-- Save roast button -->
	<div class="flex justify-end">
		{#if hasLogData}
			<button
				class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-950"
				on:click={() => {
					if (
						confirm('Are you sure you want to clear this roast data? This action cannot be undone.')
					) {
						// Add function to handle clearing roast data
						clearRoastData();
					}
				}}
			>
				Clear Roast
			</button>
		{:else}
			<button
				class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600"
				on:click={saveRoastProfile}
				disabled={!isRoasting && $profileLogs.length === 0}
			>
				Save Roast
			</button>
		{/if}
	</div>
</div>
