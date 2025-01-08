<script lang="ts">
	import RoastChart from './RoastChart.svelte';
	let isRoasting = false;
	let fanValue = 10;
	let heatValue = 0;
	let selectedEvent: string | null = null;
</script>

<div class="m-8 rounded-lg bg-zinc-800 p-8">
	<h1 class="text-2xl font-bold text-zinc-500">Coffee Roast Profiler</h1>
	<div class="my-8 flex h-[600px] w-full">
		<!-- Fan buttons -->
		<div class="my-5 flex flex-col justify-between pr-4">
			{#each Array(11).reverse() as _, i}
				<label
					class="rounded border-2 border-indigo-800 px-3 py-1 text-zinc-500 hover:bg-indigo-900"
					class:bg-indigo-900={fanValue === i}
				>
					<input type="radio" name="fanSetting" value={i} bind:group={fanValue} class="hidden" />
					{i}
				</label>
			{/each}
		</div>

		<!-- Chart -->
		<div class="flex-1">
			<RoastChart />
		</div>

		<!-- Heat buttons -->
		<div class="my-5 flex flex-col justify-between pl-4">
			{#each Array.from({ length: 11 }, (_, i) => 10 - i) as value}
				<label
					class="rounded border-2 border-amber-800 px-3 py-1 text-zinc-500 hover:bg-amber-900"
					class:bg-amber-900={heatValue === value}
				>
					<input type="radio" name="heatSetting" {value} bind:group={heatValue} class="hidden" />
					{value}
				</label>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap justify-center gap-4">
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
			on:click={() => (isRoasting = !isRoasting)}
			class:border-red-800={isRoasting}
			class:hover:bg-red-900={isRoasting}
		>
			{isRoasting ? 'End' : 'Start'}
		</button>

		{#each ['Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start'] as event}
			<label
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				class:bg-green-900={selectedEvent === event}
				class:opacity-50={!isRoasting}
				class:cursor-not-allowed={!isRoasting}
				class:hover:bg-transparent={!isRoasting}
			>
				<input
					type="radio"
					name="roastEvent"
					value={event}
					bind:group={selectedEvent}
					class="hidden"
					disabled={!isRoasting}
				/>
				{event}
			</label>
		{/each}
	</div>
</div>
