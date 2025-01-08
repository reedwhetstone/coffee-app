<script lang="ts">
	import RoastChart from './RoastChart.svelte';
	let isRoasting = false;
</script>

<div class="m-8 rounded-lg bg-zinc-800 p-8">
	<h1 class="text-2xl font-bold text-zinc-500">Coffee Roast Profiler</h1>
	<div class="my-8 h-[600px] w-full">
		<RoastChart />
	</div>

	<div class="flex flex-wrap justify-center gap-4">
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			on:click={() => (isRoasting = !isRoasting)}
		>
			{isRoasting ? 'End' : 'Start'}
		</button>

		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			>Maillard</button
		>
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			>FC Start</button
		>
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			>FC Rolling</button
		>
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			>FC End</button
		>
		<button
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900 hover:text-white"
			>SC Start</button
		>
	</div>
</div>
