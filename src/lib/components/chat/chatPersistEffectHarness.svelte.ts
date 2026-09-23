import { flushSync } from 'svelte';

export type PersistSpy = (count: number) => void;

export function mountDebouncedPersistAfterTurn(persist: PersistSpy): () => void {
	return $effect.root(() => {
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
}

export function mountRapidFollowupPersist(persist: PersistSpy): () => void {
	return $effect.root(() => {
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
		active = true;
		messageCount = 3;
		flushSync();
		active = false;
		messageCount = 4;
		flushSync();
	});
}

export function mountFailedPersistRetry(persist: (count: number) => Promise<void>): () => void {
	return $effect.root(() => {
		const messageCount = $state(2);
		let lastPersistedMessageCount = $state(0);
		let retryAttempt = $state(0);
		$effect(() => {
			const count = messageCount;
			const attempt = retryAttempt;
			if (count === lastPersistedMessageCount) return;
			let retryTimeout: ReturnType<typeof setTimeout> | undefined;
			const timeout = setTimeout(() => {
				void persist(count).then(
					() => {
						lastPersistedMessageCount = count;
						retryAttempt = 0;
					},
					() => {
						retryTimeout = setTimeout(() => (retryAttempt = attempt + 1), 10);
					}
				);
			}, 10);
			return () => {
				clearTimeout(timeout);
				if (retryTimeout) clearTimeout(retryTimeout);
			};
		});
		flushSync();
	});
}
