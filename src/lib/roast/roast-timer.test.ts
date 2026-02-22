import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoastTimer } from './roast-timer.svelte';

/**
 * Timer tests focus on state machine transitions and timing logic.
 *
 * Note: $state/$derived reactivity requires Svelte's rendering runtime
 * to propagate through getters. In the test environment, we verify:
 * - Phase transitions (idle → recording → paused → completed)
 * - Guard conditions (e.g., can't start when already running)
 * - Reset behavior
 * - Cleanup (destroy cancels animation frames)
 *
 * Elapsed time reactivity is verified indirectly via the Playwright E2E tests
 * which exercise the timer in a real Svelte rendering context.
 */

// Mock browser APIs for Node.js test environment
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

beforeEach(() => {
	rafCallbacks = new Map();
	rafId = 0;

	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		const id = ++rafId;
		rafCallbacks.set(id, cb);
		return id;
	});

	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		rafCallbacks.delete(id);
	});

	vi.stubGlobal('performance', { now: () => 0 });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createRoastTimer', () => {
	describe('initial state', () => {
		it('starts in idle phase', () => {
			const timer = createRoastTimer();
			expect(timer.phase).toBe('idle');
			expect(timer.isIdle).toBe(true);
			expect(timer.isRunning).toBe(false);
			expect(timer.isPaused).toBe(false);
			expect(timer.isCompleted).toBe(false);
		});

		it('starts with zero elapsed time', () => {
			const timer = createRoastTimer();
			expect(timer.elapsed).toBe(0);
			expect(timer.seconds).toBe(0);
		});
	});

	describe('phase transitions', () => {
		it('idle → recording on start()', () => {
			const timer = createRoastTimer();
			timer.start();
			expect(timer.phase).toBe('recording');
			expect(timer.isRunning).toBe(true);
			expect(timer.isIdle).toBe(false);
		});

		it('recording → paused on pause()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			expect(timer.phase).toBe('paused');
			expect(timer.isPaused).toBe(true);
			expect(timer.isRunning).toBe(false);
		});

		it('paused → recording on resume()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			timer.resume();
			expect(timer.phase).toBe('recording');
			expect(timer.isRunning).toBe(true);
			expect(timer.isPaused).toBe(false);
		});

		it('recording → completed on stop()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.stop();
			expect(timer.phase).toBe('completed');
			expect(timer.isCompleted).toBe(true);
			expect(timer.isRunning).toBe(false);
		});

		it('paused → completed on stop()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			timer.stop();
			expect(timer.phase).toBe('completed');
			expect(timer.isCompleted).toBe(true);
		});

		it('any → idle on reset()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			timer.reset();
			expect(timer.phase).toBe('idle');
			expect(timer.isIdle).toBe(true);
			expect(timer.elapsed).toBe(0);
		});

		it('completed → idle on reset()', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.stop();
			timer.reset();
			expect(timer.phase).toBe('idle');
		});
	});

	describe('guard conditions', () => {
		it('ignores start() when not idle', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.start(); // should be ignored
			expect(timer.phase).toBe('recording');
		});

		it('ignores pause() when not recording', () => {
			const timer = createRoastTimer();
			timer.pause(); // idle, should be ignored
			expect(timer.phase).toBe('idle');
		});

		it('ignores resume() when not paused', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.resume(); // recording, should be ignored
			expect(timer.phase).toBe('recording');
		});

		it('ignores stop() when idle', () => {
			const timer = createRoastTimer();
			timer.stop();
			expect(timer.phase).toBe('idle');
		});

		it('can restart after reset from any state', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.stop();
			timer.reset();
			timer.start();
			expect(timer.phase).toBe('recording');
		});
	});

	describe('animation frame management', () => {
		it('registers rAF on start', () => {
			const timer = createRoastTimer();
			timer.start();
			expect(rafCallbacks.size).toBe(1);
		});

		it('cancels rAF on pause', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			expect(rafCallbacks.size).toBe(0);
		});

		it('re-registers rAF on resume', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.pause();
			timer.resume();
			expect(rafCallbacks.size).toBe(1);
		});

		it('cancels rAF on stop', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.stop();
			expect(rafCallbacks.size).toBe(0);
		});

		it('cancels rAF on reset', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.reset();
			expect(rafCallbacks.size).toBe(0);
		});

		it('cancels rAF on destroy', () => {
			const timer = createRoastTimer();
			timer.start();
			timer.destroy();
			expect(rafCallbacks.size).toBe(0);
		});
	});
});
