<script lang="ts">
	import { startTime, accumulatedTime, roastData, roastEvents, profileLogs } from './stores';

	export let isRoasting = false;
	export let isPaused = false;
	export let fanValue: number;
	export let heatValue: number;
	export let currentRoastProfile: any | null = null;

	let seconds = 0;
	let milliseconds = 0;
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = false;
	const LONG_PRESS_DURATION = 1000;

	// Add reactive statement to handle profile changes
	$: if (currentRoastProfile) {
		resetTimer();
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
					end: false,
					time: 0
				}
			];
			timerInterval = setInterval(() => {
				const elapsed = performance.now() - $startTime! + $accumulatedTime;
				seconds = Math.floor(elapsed / 1000);
				milliseconds = elapsed % 1000;
			}, 1);
			isRoasting = true;
		} else if (!isPaused) {
			// Pausing
			clearInterval(timerInterval);
			timerInterval = null;
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
			isPaused = false;
		}
	}

	function resetTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
		}
		seconds = 0;
		milliseconds = 0;
		timerInterval = null;
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
</script>

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
		class:border-red-800={isRoasting}
		class:hover:bg-red-900={isRoasting}
	>
		{isRoasting ? (isPaused ? 'Resume' : 'Pause') : 'Start'}
	</button>
</div>
