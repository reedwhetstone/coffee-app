import { describe, it, expect, vi } from 'vitest';
import {
	mountDebouncedPersistAfterTurn,
	mountRapidFollowupPersist
} from './chatPersistEffectHarness.svelte';

/**
 * Guards the auto-persist debounce contract used in ChatWorkspace.svelte.
 *
 * Regression: the effect used to assign `lastPersistedMessageCount` in its own
 * body. Because the effect also reads that value, the write re-invalidated the
 * effect, Svelte ran the cleanup (clearTimeout) before the debounce fired, and
 * `persistCurrentState` never ran during a live session — so no chat messages
 * reached the DB. The counter must only be updated inside the timer callback.
 */
describe('ChatWorkspace auto-persist effect', () => {
	it('runs the debounced persist after a turn completes', async () => {
		const persist = vi.fn();

		const teardown = mountDebouncedPersistAfterTurn(persist);

		await new Promise((r) => setTimeout(r, 40));
		teardown();

		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith(2);
	});

	it('coalesces a rapid follow-up turn into a single later save without losing messages', async () => {
		const persist = vi.fn();

		const teardown = mountRapidFollowupPersist(persist);

		await new Promise((r) => setTimeout(r, 40));
		teardown();

		// Exactly one save, covering all four messages — nothing stranded.
		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith(4);
	});

	it('serializes overlapping persist calls so later saves slice after the first completes', async () => {
		let messageCount = 2;
		let savedCount = 0;
		const saves: number[] = [];
		let releaseFirstSave!: () => void;
		let currentPersist: Promise<void> | null = null;

		const saveMessages = vi.fn(async (count: number) => {
			saves.push(count);
			if (saves.length === 1) {
				await new Promise<void>((resolve) => {
					releaseFirstSave = resolve;
				});
			}
			savedCount += count;
		});

		const persistWorkspaceState = async () => {
			const newMessageCount = messageCount - savedCount;
			if (newMessageCount > 0) await saveMessages(newMessageCount);
		};

		const persistCurrentState = async () => {
			const previousPersist = currentPersist;
			const nextPersist = (async () => {
				if (previousPersist) await previousPersist.catch(() => undefined);
				await persistWorkspaceState();
			})();

			currentPersist = nextPersist;
			nextPersist.then(
				() => {
					if (currentPersist === nextPersist) currentPersist = null;
				},
				() => {
					if (currentPersist === nextPersist) currentPersist = null;
				}
			);

			await nextPersist;
		};

		const firstPersist = persistCurrentState();
		await vi.waitFor(() => expect(saveMessages).toHaveBeenCalledTimes(1));
		expect(saves).toEqual([2]);

		messageCount = 4;
		const secondPersist = persistCurrentState();
		await Promise.resolve();
		expect(saveMessages).toHaveBeenCalledTimes(1);

		releaseFirstSave();
		await Promise.all([firstPersist, secondPersist]);

		expect(saves).toEqual([2, 2]);
		expect(savedCount).toBe(4);
	});

	it('serializes canvas state saves so stale requests cannot overwrite newer state', async () => {
		let canvasState = 'old-layout';
		const savedStates: string[] = [];
		let releaseFirstSave!: () => void;
		let currentCanvasPersist: Promise<void> | null = null;

		const saveCanvasState = vi.fn(async (state: string) => {
			savedStates.push(state);
			if (savedStates.length === 1) {
				await new Promise<void>((resolve) => {
					releaseFirstSave = resolve;
				});
			}
		});

		const buildCanvasStatePayload = () => canvasState;
		const persistCanvasState = async () => {
			const payload = buildCanvasStatePayload();
			const previousPersist = currentCanvasPersist;
			const nextPersist = (async () => {
				if (previousPersist) await previousPersist.catch(() => undefined);
				await saveCanvasState(payload);
			})();

			currentCanvasPersist = nextPersist;
			nextPersist.then(
				() => {
					if (currentCanvasPersist === nextPersist) currentCanvasPersist = null;
				},
				() => {
					if (currentCanvasPersist === nextPersist) currentCanvasPersist = null;
				}
			);

			await nextPersist;
		};

		const firstPersist = persistCanvasState();
		await vi.waitFor(() => expect(saveCanvasState).toHaveBeenCalledTimes(1));
		expect(savedStates).toEqual(['old-layout']);

		canvasState = 'new-layout';
		const secondPersist = persistCanvasState();
		await Promise.resolve();
		expect(saveCanvasState).toHaveBeenCalledTimes(1);

		releaseFirstSave();
		await Promise.all([firstPersist, secondPersist]);

		expect(savedStates).toEqual(['old-layout', 'new-layout']);
	});

	it('snapshots canvas state before queueing so workspace switches cannot leak later canvas state', async () => {
		let canvasState = 'workspace-a-layout';
		const savedStates: Array<{ wsId: string; state: string }> = [];
		let releaseFirstSave!: () => void;
		let currentPersist: Promise<void> | null = null;

		const saveCanvasState = vi.fn(async (wsId: string, state: string) => {
			savedStates.push({ wsId, state });
			if (savedStates.length === 1) {
				await new Promise<void>((resolve) => {
					releaseFirstSave = resolve;
				});
			}
		});

		const buildCanvasStatePayload = () => canvasState;
		const persistCanvasState = async (wsId: string) => {
			const payload = buildCanvasStatePayload();
			const previousPersist = currentPersist;
			const nextPersist = (async () => {
				if (previousPersist) await previousPersist.catch(() => undefined);
				await saveCanvasState(wsId, payload);
			})();

			currentPersist = nextPersist;
			nextPersist.then(
				() => {
					if (currentPersist === nextPersist) currentPersist = null;
				},
				() => {
					if (currentPersist === nextPersist) currentPersist = null;
				}
			);

			await nextPersist;
		};

		const firstPersist = persistCanvasState('workspace-a');
		await vi.waitFor(() => expect(saveCanvasState).toHaveBeenCalledTimes(1));

		const secondPersist = persistCanvasState('workspace-a');
		canvasState = 'workspace-b-layout';
		await Promise.resolve();
		expect(saveCanvasState).toHaveBeenCalledTimes(1);

		releaseFirstSave();
		await Promise.all([firstPersist, secondPersist]);

		expect(savedStates).toEqual([
			{ wsId: 'workspace-a', state: 'workspace-a-layout' },
			{ wsId: 'workspace-a', state: 'workspace-a-layout' }
		]);
	});
});
