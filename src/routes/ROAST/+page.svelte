<script lang="ts">
	import { page } from '$app/stores';
	import RoastChart from './RoastChart.svelte';
	import RoastTimer from './RoastTimer.svelte';
	import { roastData, roastEvents, startTime, accumulatedTime } from './stores';

	let selectedBean = ($page.state as any)?.selectedBean || {};
	let isRoasting = false;
	let isPaused = false;
	let fanValue = 10;
	let heatValue = 0;
	let selectedEvent: string | null = null;

	// Update handlers for heat and fan changes
	function updateHeat(value: number) {
		heatValue = value;
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		$roastData = [
			...$roastData,
			{
				time: currentTime,
				heat: value,
				fan: fanValue
			}
		];
	}

	function updateFan(value: number) {
		fanValue = value;
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		$roastData = [
			...$roastData,
			{
				time: currentTime,
				heat: heatValue,
				fan: value
			}
		];
	}

	function logEvent(event: string) {
		if ($startTime === null) return;
		selectedEvent = event;
		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		$roastEvents = [
			...$roastEvents,
			{
				time: currentTime,
				name: event
			}
		];
	}
</script>

<div class="m-8 rounded-lg bg-zinc-800 p-8">
	<div class="flex justify-between">
		<h1 class="text-2xl font-bold text-zinc-500">Roast Session: {selectedBean.name}</h1>
	</div>
	<!-- turning point and first crack -->
	<div class="flex justify-end space-x-4">
		<div class=" text-2xl font-bold text-zinc-500">TP:00:00</div>
		<div class=" text-2xl font-bold text-zinc-500">FC:00:00</div>
	</div>
	<!-- fanButtons, chart, heatButtons  -->
	<div class=" flex h-[500px] w-full justify-center">
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
						on:change={() => updateFan(i)}
						checked={fanValue === i}
						class="hidden"
					/>
					{i}
				</label>
			{/each}
		</div>

		<!-- Chart -->
		<div class="flex-1">
			<RoastChart {isPaused} {fanValue} {heatValue} />
		</div>

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
						on:change={() => updateHeat(value)}
						checked={heatValue === value}
						class="hidden"
					/>
					{value}
				</label>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-center gap-4">
		<RoastTimer bind:isRoasting bind:isPaused />

		{#each ['Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start'] as event}
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
					on:change={() => logEvent(event)}
					checked={selectedEvent === event}
					class="hidden"
					disabled={!isRoasting}
				/>
				{event}
			</label>
		{/each}
	</div>
	<div class="flex justify-end">
		<button class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600">
			Save Roast
		</button>
	</div>
</div>
