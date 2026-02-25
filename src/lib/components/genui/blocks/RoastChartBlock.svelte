<script lang="ts">
	import { onMount } from 'svelte';
	import type { RoastChartBlock as RoastChartBlockType } from '$lib/types/genui';
	import { RoastChart, prepareChartData } from '$lib/components/roast/chart';
	import type { ProcessedChartData, TooltipData } from '$lib/components/roast/chart';

	let { block } = $props<{ block: RoastChartBlockType }>();

	// ─── State ───────────────────────────────────────────────────────────────
	let loading = $state(true);
	let error = $state<string | null>(null);
	let roastName = $state('');
	let chartData = $state<ProcessedChartData | null>(null);

	// Tooltip state
	let tooltip = $state({ visible: false, x: 0, y: 0, time: '', bt: '', et: '', ror: '' });

	// ─── Raw API → prepareChartData bridge ───────────────────────────────────
	interface RawRow {
		time_milliseconds: number;
		data_type: string;
		field_name: string;
		value_numeric: number;
		event_string: string;
		subcategory: string;
	}

	function processRawToChartInputs(rawData: RawRow[]) {
		// Build RoastPoint[] for prepareChartData
		const timeMap = new Map<
			number,
			{
				time: number;
				bean_temp: number | null;
				environmental_temp: number | null;
				heat: number;
				fan: number;
			}
		>();
		const events: {
			time_seconds: number;
			event_type: number;
			event_value: string | null;
			event_string: string;
			category: string;
		}[] = [];
		const roastEvents: { time: number; name: string }[] = [];

		for (const row of rawData) {
			const timeMs = row.time_milliseconds;
			const dataType = row.data_type;

			if (dataType === 'temperature') {
				if (!timeMap.has(timeMs)) {
					timeMap.set(timeMs, {
						time: timeMs,
						bean_temp: null,
						environmental_temp: null,
						heat: 0,
						fan: 0
					});
				}
				const point = timeMap.get(timeMs)!;
				if (row.field_name === 'bean_temp') point.bean_temp = row.value_numeric;
				else if (row.field_name === 'environmental_temp')
					point.environmental_temp = row.value_numeric;
			} else if (
				dataType === 'milestone' ||
				(dataType === 'event' && row.subcategory === 'milestone')
			) {
				const name = row.event_string || row.field_name;
				events.push({
					time_seconds: timeMs / 1000,
					event_type: 10,
					event_value: null,
					event_string: name,
					category: 'milestone'
				});
				roastEvents.push({ time: timeMs, name });
			} else if (dataType === 'control') {
				events.push({
					time_seconds: timeMs / 1000,
					event_type: 1,
					event_value: String(row.value_numeric ?? 0),
					event_string: row.event_string || row.field_name,
					category: 'control'
				});
			}
		}

		const roastData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);

		return { roastData, events, roastEvents };
	}

	function formatTooltipTime(timeMs: number, chargeTime: number): string {
		const relMin = (timeMs - chargeTime) / (1000 * 60);
		const mins = Math.floor(Math.abs(relMin));
		const secs = Math.floor((Math.abs(relMin) % 1) * 60);
		const sign = relMin < 0 ? '-' : '';
		return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleTooltipChange(state: {
		visible: boolean;
		x: number;
		y: number;
		data: TooltipData | null;
	}) {
		if (!state.visible || !state.data) {
			tooltip = { ...tooltip, visible: false };
			return;
		}
		const d = state.data;
		tooltip = {
			visible: true,
			x: state.x,
			y: state.y,
			time: formatTooltipTime(d.time, d.chargeTime),
			bt: d.bean_temp !== null ? `${d.bean_temp.toFixed(1)}°F` : '--',
			et: d.environmental_temp !== null ? `${d.environmental_temp.toFixed(1)}°F` : '--',
			ror: d.rorValue !== null ? `${d.rorValue.toFixed(1)}°F/min` : '--'
		};
	}

	// ─── Fetch and prepare ───────────────────────────────────────────────────
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

			const { roastData, events, roastEvents } = processRawToChartInputs(data.rawData);
			if (roastData.length === 0) {
				error = 'No temperature data found';
				loading = false;
				return;
			}

			roastName = `Roast #${block.data.roastId}`;

			// Use chart settings from API metadata if available
			const settings = data.metadata?.chartSettings ?? null;

			chartData = prepareChartData({
				roastData,
				events,
				roastEvents,
				savedEventValueSeries: [],
				chartSettings: settings,
				isDuringRoasting: false
			});

			loading = false;
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
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"
				></div>
				<span class="text-xs text-text-secondary-light">Loading roast data...</span>
			</div>
		</div>
	{:else if error}
		<div class="flex h-32 items-center justify-center rounded-lg bg-red-50 text-sm text-red-600">
			{error}
		</div>
	{:else if chartData}
		<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
			<div class="flex items-center justify-between border-b border-border-light px-3 py-2">
				<span class="text-sm font-medium text-text-primary-light">{roastName}</span>
			</div>
			<div class="w-full" style="min-height: 300px; height: 350px;">
				<RoastChart {chartData} onTooltipChange={handleTooltipChange} />
			</div>
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
