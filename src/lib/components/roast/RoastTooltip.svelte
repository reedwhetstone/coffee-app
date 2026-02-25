<script lang="ts">
	import type { TemperaturePoint } from '$lib/types/d3.types';

	let {
		visible,
		x,
		y,
		data
	}: {
		visible: boolean;
		x: number;
		y: number;
		data: TemperaturePoint | null;
	} = $props();

	function formatTemperature(value: number | null | undefined): string {
		if (value === null || value === undefined) return '--';
		return `${value.toFixed(1)}°F`;
	}

	function formatTime(timeMs: number, chargeTime: number): string {
		const relativeTime = (timeMs - chargeTime) / (1000 * 60);
		const totalMinutes = Math.floor(Math.abs(relativeTime));
		const seconds = Math.floor((Math.abs(relativeTime) % 1) * 60);
		const sign = relativeTime < 0 ? '-' : '';
		return `${sign}${totalMinutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatControlValue(value: number | null | undefined): string {
		if (value === null || value === undefined) return '--';
		return value.toString();
	}

	const tooltipWidth = 320;
	const tooltipHeight = 280;
</script>

{#if visible && data}
	{@const d = data}
	{@const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200}
	{@const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800}
	{@const leftPos = x + tooltipWidth + 25 > viewportWidth ? x - tooltipWidth - 25 : x + 25}
	{@const topPos = y + tooltipHeight + 25 > viewportHeight ? y - tooltipHeight - 25 : y + 25}

	<div
		class="pointer-events-none fixed z-[1000] transition-all duration-200 ease-out"
		style="left: {leftPos}px; top: {topPos}px;"
	>
		<div
			class="max-w-sm rounded-lg bg-background-secondary-light bg-opacity-95 p-4 shadow-lg ring-1 ring-border-light backdrop-blur-sm"
		>
			<div class="mb-3 text-sm font-semibold text-text-primary-light">
				🕐 {formatTime(d.time || 0, d.chargeTime || 0)}
			</div>

			<div class="space-y-2 text-xs">
				<!-- Milestone Events -->
				{#if d.milestones && d.milestones.length > 0}
					<div class="mb-2 rounded border border-green-200 bg-green-50 p-2">
						<div class="mb-1 text-xs font-medium text-green-800">🎯 Milestone Events</div>
						{#each d.milestones as milestone}
							<div class="text-xs capitalize text-green-700">
								{milestone.event.replace(/_/g, ' ')}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Temperature Data -->
				{#if d.bean_temp !== null && d.bean_temp !== undefined}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Bean Temp (BT):</span>
						<span class="font-semibold text-orange-500">{formatTemperature(d.bean_temp)}</span>
					</div>
				{/if}

				{#if d.environmental_temp !== null && d.environmental_temp !== undefined}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Env Temp (ET):</span>
						<span class="font-semibold text-red-500">{formatTemperature(d.environmental_temp)}</span
						>
					</div>
				{/if}

				{#if d.rorValue !== null && d.rorValue !== undefined}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Rate of Rise:</span>
						<span class="font-semibold text-blue-500">{formatTemperature(d.rorValue)}/min</span>
					</div>
				{/if}

				<!-- Control Settings from Event Data -->
				{#if d.eventData && Object.keys(d.eventData).length > 0}
					<div class="mt-2 border-t border-border-light pt-2">
						<div class="mb-1 text-xs font-medium text-text-primary-light">⚙️ Control Settings</div>

						{#each Object.entries(d.eventData) as [eventName, value]}
							<div class="flex justify-between">
								<span class="capitalize text-text-secondary-light">
									{eventName.replace(/_setting/g, '').replace(/_/g, ' ')}:
								</span>
								<span
									class="font-medium"
									class:text-blue-600={eventName.includes('fan') || eventName.includes('air')}
									class:text-orange-600={eventName.includes('heat') || eventName.includes('burner')}
									class:text-purple-600={!eventName.includes('fan') &&
										!eventName.includes('air') &&
										!eventName.includes('heat') &&
										!eventName.includes('burner')}
								>
									{formatControlValue(typeof value === 'number' ? value : null)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
