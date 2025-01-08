<script lang="ts">
	import { page } from '$app/stores';
	import RoastChart from './RoastChart.svelte';

	let selectedBean = ($page.state as any)?.selectedBean || {};
	let isRoasting = false;
	let fanValue = 10;
	let heatValue = 0;
	let selectedEvent: string | null = null;

	// Add timer variables
	let seconds = 0;
	let milliseconds = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let startTime: number | null = null;
	let accumulatedTime = 0;
	let isPaused = false;

	// Add these variables at the top with the other state variables
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	const LONG_PRESS_DURATION = 1000; // 1 second for long press

	// Add this variable with the other state variables
	let isLongPressing = false;

	// Timer function
	function toggleTimer() {
		if (!isRoasting) {
			// Initial start
			startTime = performance.now();
			timerInterval = setInterval(() => {
				const elapsed = performance.now() - startTime! + accumulatedTime;
				seconds = Math.floor(elapsed / 1000);
				milliseconds = elapsed % 1000;
			}, 1);
			isRoasting = true;
		} else {
			if (timerInterval) {
				// Pausing
				clearInterval(timerInterval);
				timerInterval = null;
				accumulatedTime += performance.now() - startTime!;
				isPaused = true;
			} else {
				// Resuming
				startTime = performance.now();
				timerInterval = setInterval(() => {
					const elapsed = performance.now() - startTime! + accumulatedTime;
					seconds = Math.floor(elapsed / 1000);
					milliseconds = elapsed % 1000;
				}, 1);
				isPaused = false;
			}
		}
	}

	// Simplify time formatting using milliseconds
	$: formattedTime = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}.${Math.floor(
		milliseconds / 10
	)
		.toString()
		.padStart(2, '0')}`;

	// Add this new reset function
	function resetTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
		}
		seconds = 0;
		milliseconds = 0;
		timerInterval = null;
		startTime = null;
		accumulatedTime = 0;
		isRoasting = false;
		isPaused = false;
	}
</script>

<div class="m-8 rounded-lg bg-zinc-800 p-8">
	<div class="flex justify-between">
		<h1 class="text-2xl font-bold text-zinc-500">Roast Session: {selectedBean.name}</h1>
	</div>

	<div class="flex justify-end space-x-4">
		<div class=" text-2xl font-bold text-zinc-500">TP:00:00</div>
		<div class=" text-2xl font-bold text-zinc-500">FC:00:00</div>
	</div>
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
		<div class="w-48 text-5xl font-bold text-zinc-500">{formattedTime}</div>
		<button
			id="start-end-roast"
			class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
			on:mousedown={(e) => {
				if (isRoasting) {
					isLongPressing = true;
					pressTimer = setTimeout(() => {
						resetTimer();
						e.preventDefault(); // Prevent the subsequent click
						// Create a handler to prevent the click
						const clickHandler = (clickEvent: Event) => {
							clickEvent.preventDefault();
							clickEvent.stopPropagation();
							document.removeEventListener('click', clickHandler, true);
						};
						document.addEventListener('click', clickHandler, true);
					}, LONG_PRESS_DURATION);
				}
			}}
			on:click={(e) => {
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
			class:border-red-800={isRoasting}
			class:hover:bg-red-900={isRoasting}
		>
			{isRoasting ? (isPaused ? 'Resume' : 'Pause') : 'Start'}
		</button>

		{#each ['Maillard', 'FC Start', 'FC Rolling', 'FC End', 'SC Start'] as event}
			<label
				class="flex items-center justify-center rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
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
	<div class="flex justify-end">
		<button class="rounded border-2 border-zinc-500 px-3 py-1 text-zinc-500 hover:bg-zinc-600">
			Save Roast
		</button>
	</div>
</div>
