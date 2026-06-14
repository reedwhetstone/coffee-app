import { describe, it, expect, vi } from 'vitest';
import { flushSync } from 'svelte';

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

		const teardown = $effect.root(() => {
			let messageCount = $state(0);
			let active = $state(false);
			let lastPersistedMessageCount = $state(0);

			$effect(() => {
				const count = messageCount;
				if (active || count === 0 || count === lastPersistedMessageCount) return;
				const timeout = setTimeout(() => {
					lastPersistedMessageCount = count;
					persist(count);
				}, 10);
				return () => clearTimeout(timeout);
			});

			// Simulate a streaming turn: submit (active), then completion.
			active = true;
			messageCount = 2;
			flushSync();
			active = false;
			flushSync();
		});

		await new Promise((r) => setTimeout(r, 40));
		teardown();

		expect(persist).toHaveBeenCalledTimes(1);
		expect(persist).toHaveBeenCalledWith(2);
	});

	it('coalesces a rapid follow-up turn into a single later save without losing messages', async () => {
		const persist = vi.fn();

		const teardown = $effect.root(() => {
			let messageCount = $state(0);
			let active = $state(false);
			let lastPersistedMessageCount = $state(0);

			$effect(() => {
				const count = messageCount;
				if (active || count === 0 || count === lastPersistedMessageCount) return;
				const timeout = setTimeout(() => {
					lastPersistedMessageCount = count;
					persist(count);
				}, 10);
				return () => clearTimeout(timeout);
			});

			// First turn completes, then a second turn starts before the debounce
			// fires (cancelling the pending save), then the second turn completes.
			active = false;
			messageCount = 2;
			flushSync();
			active = true; // new turn cancels the pending save
			messageCount = 3;
			flushSync();
			active = false;
			messageCount = 4;
			flushSync();
		});

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
});
