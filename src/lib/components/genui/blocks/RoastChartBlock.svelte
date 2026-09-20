<script lang="ts">
	import { onMount } from 'svelte';
	import type { RoastChartBlock as RoastChartBlockType } from '$lib/types/genui';
	import { RoastChart } from '$lib/components/roast/chart';
	import type { ProcessedChartData, TooltipData } from '$lib/components/roast/chart';
	import { fetchRoastChartModel } from '$lib/roast';

	let { block } = $props<{ block: RoastChartBlockType }>();

	// ─── State ───────────────────────────────────────────────────────────────
	let loading = $state(true);
	let error = $state<string | null>(null);
	let roastName = $state('');
	let chartData = $state<ProcessedChartData | null>(null);

	// Tooltip state
	let tooltip = $state({
		visible: false,
		x: 0,
		y: 0,
		time: '',
		seriesValues: [] as TooltipData['seriesValues']
	});

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
			seriesValues: d.seriesValues
		};
	}

	// ─── Fetch and prepare ───────────────────────────────────────────────────
	onMount(async () => {
		try {
			const loaded = await fetchRoastChartModel(block.data.roastId);
			if (!loaded) {
				error = 'No temperature data available for this roast';
				loading = false;
				return;
			}

			roastName = `Roast #${block.data.roastId}`;
			chartData = loaded.chartData;

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
		<div class="flex h-64 items-center justify-center rounded-lg bg-surface-panel">
			<div class="flex flex-col items-center gap-2">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent"
				></div>
				<span class="text-xs text-muted">Loading roast data...</span>
			</div>
		</div>
	{:else if error}
		<div
			class="flex h-32 items-center justify-center rounded-lg bg-danger-subtle text-sm text-danger"
		>
			{error}
		</div>
	{:else if chartData}
		<div class="rounded-lg bg-surface-panel ring-1 ring-line">
			<div class="flex items-center justify-between border-b border-line px-3 py-2">
				<span class="text-sm font-medium text-ink">{roastName}</span>
			</div>
			<div class="w-full" style="min-height: 300px; height: 350px;">
				<RoastChart {chartData} onTooltipChange={handleTooltipChange} />
			</div>
		</div>
	{/if}

	<!-- Tooltip -->
	{#if tooltip.visible}
		<div
			class="pointer-events-none fixed z-50 rounded-md bg-ink px-3 py-2 text-xs text-white shadow-lg"
			style="left: {tooltip.x + 12}px; top: {tooltip.y - 10}px;"
		>
			<div class="font-medium">{tooltip.time}</div>
			<div class="mt-0.5 flex flex-col gap-0.5">
				{#each tooltip.seriesValues as series}
					<span>
						<span class="text-white/70">{series.label}:</span>
						{series.value.toFixed(1)}{series.unit ? ` ${series.unit}` : ''}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
