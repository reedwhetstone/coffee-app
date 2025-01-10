<script lang="ts">
	import RoastChart from './RoastChart.svelte';
	import RoastTimer from './RoastTimer.svelte';
	import { roastData, profileLogs } from './stores';

	export let isPaused: boolean;
	export let currentRoastProfile: any;
	export let fanValue: number;
	export let heatValue: number;
	export let isRoasting: boolean;
	export let selectedEvent: string | null;
	export let updateFan: (value: number) => void;
	export let updateHeat: (value: number) => void;
	export let saveRoastProfile: () => void;
	export let logEvent: (event: string) => void;
	export let selectedBean: { name: string };
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
			<RoastChart {isPaused} {currentRoastProfile} />
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

	<!-- Roast event controls and timer -->
	<div class="z-0 flex flex-wrap items-center justify-center gap-4">
		<RoastTimer bind:isRoasting bind:isPaused {fanValue} {heatValue} {currentRoastProfile} />

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
					on:change={() => logEvent(event)}
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
		<button
			class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600"
			on:click={saveRoastProfile}
			disabled={!isRoasting && $profileLogs.length === 0}
		>
			Save Roast
		</button>
	</div>
</div>
