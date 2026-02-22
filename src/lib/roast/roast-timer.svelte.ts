/**
 * Roast Timer — Svelte 5 reactive wrapper
 *
 * Creates a reactive timer for use in Svelte components.
 * Internally uses requestAnimationFrame for smooth, CPU-efficient updates.
 *
 * Phases: idle → recording → paused → recording → completed
 *
 * Usage in a .svelte component:
 *   const timer = createRoastTimer();
 *   timer.start();
 *   // In template: {timer.formattedTime} — automatically reactive
 */

export type RoastPhase = 'idle' | 'recording' | 'paused' | 'completed';

export function createRoastTimer() {
	// Reactive state (Svelte 5 runes)
	let elapsed = $state(0);
	let phase = $state<RoastPhase>('idle');

	// Internal timing state (not exposed)
	let startTime: number | null = null;
	let accumulatedTime = 0;
	let frameId: number | null = null;

	function tick() {
		if (startTime !== null) {
			elapsed = performance.now() - startTime + accumulatedTime;
		}
		frameId = requestAnimationFrame(tick);
	}

	function start() {
		if (phase !== 'idle') return;
		startTime = performance.now();
		accumulatedTime = 0;
		elapsed = 0;
		phase = 'recording';
		frameId = requestAnimationFrame(tick);
	}

	function pause() {
		if (phase !== 'recording') return;
		accumulatedTime += performance.now() - startTime!;
		startTime = null;
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		phase = 'paused';
	}

	function resume() {
		if (phase !== 'paused') return;
		startTime = performance.now();
		phase = 'recording';
		frameId = requestAnimationFrame(tick);
	}

	function stop() {
		if (phase === 'idle') return;
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		if (startTime !== null) {
			accumulatedTime += performance.now() - startTime;
			elapsed = accumulatedTime;
			startTime = null;
		}
		phase = 'completed';
	}

	function reset() {
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		startTime = null;
		accumulatedTime = 0;
		elapsed = 0;
		phase = 'idle';
	}

	function destroy() {
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		startTime = null;
	}

	// Derived reactive values
	const seconds = $derived(Math.floor(elapsed / 1000));
	const milliseconds = $derived(elapsed % 1000);

	const formattedTime = $derived.by(() => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const centis = Math.floor(milliseconds / 10);
		return `${mins}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
	});

	return {
		get elapsed() {
			return elapsed;
		},
		get seconds() {
			return seconds;
		},
		get milliseconds() {
			return milliseconds;
		},
		get phase() {
			return phase;
		},
		get isRunning() {
			return phase === 'recording';
		},
		get isPaused() {
			return phase === 'paused';
		},
		get isIdle() {
			return phase === 'idle';
		},
		get isCompleted() {
			return phase === 'completed';
		},
		get formattedTime() {
			return formattedTime;
		},
		start,
		pause,
		resume,
		stop,
		reset,
		destroy
	};
}

export type RoastTimer = ReturnType<typeof createRoastTimer>;
