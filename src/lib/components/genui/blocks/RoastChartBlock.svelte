<script lang="ts">
	import { onMount } from 'svelte';
	import type { RoastChartBlock as RoastChartBlockType } from '$lib/types/genui';
	import {
		select,
		scaleLinear,
		line,
		curveBasis,
		axisBottom,
		axisLeft,
		axisRight,
		pointer
	} from 'd3';

	let { block } = $props<{ block: RoastChartBlockType }>();

	// ─── State ───────────────────────────────────────────────────────────────
	let chartContainer = $state<HTMLDivElement>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	let roastName = $state('');

	// Tooltip state
	let tooltip = $state({ visible: false, x: 0, y: 0, time: '', bt: '', et: '', ror: '' });

	// ─── Types ───────────────────────────────────────────────────────────────
	interface ChartPoint {
		time: number; // milliseconds
		bean_temp: number | null;
		environmental_temp: number | null;
	}

	interface EventMarker {
		time: number; // milliseconds
		name: string;
	}

	// ─── Data processing ─────────────────────────────────────────────────────
	function processRawData(rawData: Array<Record<string, unknown>>): {
		points: ChartPoint[];
		events: EventMarker[];
	} {
		const timeMap = new Map<number, ChartPoint>();
		const events: EventMarker[] = [];

		for (const row of rawData) {
			const timeMs = row.time_milliseconds as number;
			const dataType = row.data_type as string;
			const fieldName = row.field_name as string;
			const value = row.value_numeric as number;
			const eventString = row.event_string as string;
			const subcategory = row.subcategory as string;

			if (dataType === 'temperature') {
				if (!timeMap.has(timeMs)) {
					timeMap.set(timeMs, { time: timeMs, bean_temp: null, environmental_temp: null });
				}
				const point = timeMap.get(timeMs)!;
				if (fieldName === 'bean_temp') point.bean_temp = value;
				else if (fieldName === 'environmental_temp') point.environmental_temp = value;
			} else if (dataType === 'event' && subcategory === 'milestone') {
				events.push({ time: timeMs, name: eventString || fieldName });
			}
		}

		const points = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
		events.sort((a, b) => a.time - b.time);
		return { points, events };
	}

	function smoothData(data: { time: number; temp: number }[], windowSize: number) {
		if (data.length === 0) return [];
		const result: { time: number; temp: number }[] = [];
		for (let i = 0; i < data.length; i++) {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
			let sum = 0;
			let count = 0;
			for (let j = start; j < end; j++) { sum += data[j].temp; count++; }
			result.push({ time: data[i].time, temp: sum / count });
		}
		return result;
	}

	function calculateRoR(
		points: ChartPoint[],
		chargeTime: number,
		dropTime: number | null
	): { time: number; ror: number }[] {
		const validTemps = points
			.filter((p) => p.bean_temp !== null && p.bean_temp! > 0)
			.map((p) => ({ time: p.time, temp: p.bean_temp! }));

		if (validTemps.length < 15) return [];

		const smoothed = smoothData(validTemps, 15);
		const rawRor: { time: number; ror: number }[] = [];

		for (let i = 1; i < smoothed.length; i++) {
			const dt = (smoothed[i].time - smoothed[i - 1].time) / (1000 * 60);
			const dTemp = smoothed[i].temp - smoothed[i - 1].temp;
			if (dt > 0) {
				const ror = dTemp / dt;
				let include = smoothed[i].time >= chargeTime;
				if (dropTime) include = include && smoothed[i].time <= dropTime;
				if (include && ror > 0 && ror <= 50) {
					rawRor.push({ time: smoothed[i].time, ror });
				}
			}
		}

		return smoothData(
			rawRor.map((p) => ({ time: p.time, temp: p.ror })),
			10
		).map((p) => ({ time: p.time, ror: p.temp }));
	}

	// ─── D3 Chart Rendering ──────────────────────────────────────────────────
	function renderChart(
		container: HTMLDivElement,
		points: ChartPoint[],
		events: EventMarker[],
		chargeTime: number,
		meta: { tempRange: [number, number]; rorRange: [number, number] }
	) {
		const rect = container.getBoundingClientRect();
		const margin = { top: 20, right: 70, bottom: 40, left: 60 };
		const width = rect.width - margin.left - margin.right;
		const height = Math.max(250, rect.height - margin.top - margin.bottom);

		// Find drop time from events
		const dropEvent = events.find(
			(e) => e.name.toLowerCase().includes('drop') || e.name.toLowerCase().includes('end')
		);
		const dropTime = dropEvent?.time ?? null;

		// Calculate time domain in minutes relative to charge
		const minTime = points.length > 0 ? (points[0].time - chargeTime) / (1000 * 60) : -2;
		const maxTime = points.length > 0 ? (points[points.length - 1].time - chargeTime) / (1000 * 60) : 12;

		// Scales
		const xScale = scaleLinear().domain([minTime - 0.5, maxTime + 0.5]).range([0, width]);
		const yTemp = scaleLinear().domain([meta.tempRange[0] - 20, meta.tempRange[1] + 20]).range([height, 0]);
		const yRoR = scaleLinear().domain([0, Math.min(meta.rorRange[1] + 5, 50)]).range([height, 0]);

		// Clear previous
		select(container).selectAll('svg').remove();

		const svg = select(container)
			.append('svg')
			.attr('width', rect.width)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Axes
		svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(xScale).ticks(8))
			.selectAll('text').style('fill', '#6b7280').style('font-size', '10px');
		svg.append('g').call(axisLeft(yTemp).ticks(6))
			.selectAll('text').style('fill', '#dc2626').style('font-size', '10px');
		svg.append('g').attr('transform', `translate(${width},0)`).call(axisRight(yRoR).ticks(5))
			.selectAll('text').style('fill', '#2563eb').style('font-size', '10px');

		// Axis labels
		svg.append('text')
			.attr('transform', 'rotate(-90)').attr('y', -45).attr('x', -height / 2)
			.style('text-anchor', 'middle').style('fill', '#dc2626').style('font-size', '11px')
			.text('Temperature (°F)');
		svg.append('text')
			.attr('transform', 'rotate(90)').attr('y', -width - 55).attr('x', height / 2)
			.style('text-anchor', 'middle').style('fill', '#2563eb').style('font-size', '11px')
			.text('RoR (°F/min)');
		svg.append('text')
			.attr('x', width / 2).attr('y', height + 35)
			.style('text-anchor', 'middle').style('fill', '#6b7280').style('font-size', '11px')
			.text('Time (min from charge)');

		// Charge line (t=0)
		svg.append('line')
			.attr('x1', xScale(0)).attr('x2', xScale(0))
			.attr('y1', 0).attr('y2', height)
			.attr('stroke', '#10b981').attr('stroke-width', 2).attr('stroke-dasharray', '3,3').attr('opacity', 0.7);

		// Helper: time relative to charge in minutes
		const relMin = (t: number) => (t - chargeTime) / (1000 * 60);

		// Bean temp line (BT)
		const btData = points.filter((p) => p.bean_temp !== null);
		if (btData.length > 0) {
			const btLine = line<ChartPoint>()
				.x((d) => xScale(relMin(d.time)))
				.y((d) => yTemp(d.bean_temp!))
				.defined((d) => d.bean_temp !== null && !isNaN(xScale(relMin(d.time))) && !isNaN(yTemp(d.bean_temp!)))
				.curve(curveBasis);
			svg.append('path').datum(btData)
				.attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 2.5)
				.attr('stroke-dasharray', '5,5').attr('d', btLine);
		}

		// Env temp line (ET)
		const etData = points.filter((p) => p.environmental_temp !== null);
		if (etData.length > 0) {
			const etLine = line<ChartPoint>()
				.x((d) => xScale(relMin(d.time)))
				.y((d) => yTemp(d.environmental_temp!))
				.defined((d) => d.environmental_temp !== null && !isNaN(xScale(relMin(d.time))) && !isNaN(yTemp(d.environmental_temp!)))
				.curve(curveBasis);
			svg.append('path').datum(etData)
				.attr('fill', 'none').attr('stroke', '#dc2626').attr('stroke-width', 2).attr('d', etLine);
		}

		// RoR line
		const rorData = calculateRoR(points, chargeTime, dropTime);
		if (rorData.length > 0) {
			const rorLine = line<{ time: number; ror: number }>()
				.x((d) => xScale(relMin(d.time)))
				.y((d) => yRoR(d.ror))
				.defined((d) => d.ror > 0 && d.ror <= 50 && !isNaN(xScale(relMin(d.time))) && !isNaN(yRoR(d.ror)))
				.curve(curveBasis);
			svg.append('path').datum(rorData)
				.attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2).attr('d', rorLine);
		}

		// Milestone markers
		for (const evt of events) {
			const x = xScale(relMin(evt.time));
			if (x < 0 || x > width) continue;
			svg.append('line')
				.attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', height)
				.attr('stroke', '#4ade80').attr('stroke-width', 1).attr('stroke-dasharray', '4,4');
			svg.append('text')
				.attr('x', x).attr('y', 10)
				.attr('fill', '#4ade80').attr('font-size', '10px').attr('text-anchor', 'end')
				.attr('transform', `rotate(-90,${x},10)`)
				.text(evt.name);
		}

		// Legend
		const legendG = svg.append('g');
		let ly = 8;
		const lx = width - 130;
		if (btData.length > 0) {
			legendG.append('line').attr('x1', lx).attr('x2', lx + 18).attr('y1', ly).attr('y2', ly)
				.attr('stroke', '#f59e0b').attr('stroke-width', 2.5).attr('stroke-dasharray', '5,5');
			legendG.append('text').attr('x', lx + 22).attr('y', ly).attr('dy', '0.35em')
				.attr('font-size', '10px').attr('fill', '#6b7280').text('Bean Temp');
			ly += 14;
		}
		if (etData.length > 0) {
			legendG.append('line').attr('x1', lx).attr('x2', lx + 18).attr('y1', ly).attr('y2', ly)
				.attr('stroke', '#dc2626').attr('stroke-width', 2);
			legendG.append('text').attr('x', lx + 22).attr('y', ly).attr('dy', '0.35em')
				.attr('font-size', '10px').attr('fill', '#6b7280').text('Env Temp');
			ly += 14;
		}
		if (rorData.length > 0) {
			legendG.append('line').attr('x1', lx).attr('x2', lx + 18).attr('y1', ly).attr('y2', ly)
				.attr('stroke', '#2563eb').attr('stroke-width', 2);
			legendG.append('text').attr('x', lx + 22).attr('y', ly).attr('dy', '0.35em')
				.attr('font-size', '10px').attr('fill', '#6b7280').text('RoR');
		}

		// Tooltip overlay
		if (points.length > 0) {
			svg.append('rect')
				.attr('width', width).attr('height', height).attr('fill', 'transparent').style('cursor', 'crosshair')
				.on('mousemove', function (this: SVGRectElement, event: MouseEvent) {
					const [mx] = pointer(event, this);
					const x0 = xScale.invert(mx);
					let closest = 0;
					let minDist = Math.abs(relMin(points[0].time) - x0);
					for (let i = 1; i < points.length; i++) {
						const dist = Math.abs(relMin(points[i].time) - x0);
						if (dist < minDist) { minDist = dist; closest = i; }
					}
					const d = points[closest];
					const xPos = xScale(relMin(d.time));

					// Find RoR at this time
					let rorVal = '';
					if (rorData.length > 0) {
						let ci = 0;
						let md2 = Math.abs(rorData[0].time - d.time);
						for (let i = 1; i < rorData.length; i++) {
							const dd = Math.abs(rorData[i].time - d.time);
							if (dd < md2) { md2 = dd; ci = i; }
						}
						if (md2 < 5000) rorVal = rorData[ci].ror.toFixed(1);
					}

					const relT = relMin(d.time);
					const mins = Math.floor(Math.abs(relT));
					const secs = Math.floor((Math.abs(relT) % 1) * 60);
					const sign = relT < 0 ? '-' : '';

					tooltip = {
						visible: true,
						x: event.clientX,
						y: event.clientY,
						time: `${sign}${mins}:${secs.toString().padStart(2, '0')}`,
						bt: d.bean_temp !== null ? `${d.bean_temp.toFixed(1)}°F` : '--',
						et: d.environmental_temp !== null ? `${d.environmental_temp.toFixed(1)}°F` : '--',
						ror: rorVal ? `${rorVal}°F/min` : '--'
					};

					// Vertical indicator
					svg.selectAll('.hover-line').remove();
					svg.append('line').attr('class', 'hover-line')
						.attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', height)
						.attr('stroke', '#6b7280').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('opacity', 0.7);
				})
				.on('mouseout', () => {
					tooltip = { ...tooltip, visible: false };
					svg.selectAll('.hover-line').remove();
				});
		}
	}

	// ─── Fetch and render ────────────────────────────────────────────────────
	onMount(async () => {
		try {
			const res = await fetch(`/api/roast-chart-data?roastId=${block.data.roastId}`);
			if (!res.ok) throw new Error(`Failed to load chart data: ${res.status}`);

			const data = await res.json();
			if (!data.rawData || data.rawData.length === 0) {
				error = 'No temperature data available for this roast';
				loading = false;
				return;
			}

			const { points, events } = processRawData(data.rawData);
			if (points.length === 0) {
				error = 'No temperature data found';
				loading = false;
				return;
			}

			roastName = `Roast #${block.data.roastId}`;
			loading = false;

			// Wait for DOM update then render chart
			requestAnimationFrame(() => {
				if (chartContainer) {
					renderChart(chartContainer, points, events, data.metadata.chargeTime, {
						tempRange: data.metadata.tempRange,
						rorRange: data.metadata.rorRange
					});
				}
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load chart';
			loading = false;
		}
	});
</script>

<div class="roast-chart-block">
	{#if loading}
		<!-- Skeleton loader -->
		<div class="flex h-64 items-center justify-center rounded-lg bg-background-secondary-light">
			<div class="flex flex-col items-center gap-2">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"></div>
				<span class="text-xs text-text-secondary-light">Loading roast data...</span>
			</div>
		</div>
	{:else if error}
		<div class="flex h-32 items-center justify-center rounded-lg bg-red-50 text-sm text-red-600">
			{error}
		</div>
	{:else}
		<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
			<div class="flex items-center justify-between border-b border-border-light px-3 py-2">
				<span class="text-sm font-medium text-text-primary-light">{roastName}</span>
			</div>
			<div bind:this={chartContainer} class="chart-container w-full" style="min-height: 300px;"></div>
		</div>
	{/if}

	<!-- Tooltip -->
	{#if tooltip.visible}
		<div
			class="pointer-events-none fixed z-50 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
			style="left: {tooltip.x + 12}px; top: {tooltip.y - 10}px;"
		>
			<div class="font-medium">{tooltip.time}</div>
			<div class="mt-0.5 flex flex-col gap-0.5">
				<span><span class="text-amber-400">BT:</span> {tooltip.bt}</span>
				<span><span class="text-red-400">ET:</span> {tooltip.et}</span>
				<span><span class="text-blue-400">RoR:</span> {tooltip.ror}</span>
			</div>
		</div>
	{/if}
</div>
