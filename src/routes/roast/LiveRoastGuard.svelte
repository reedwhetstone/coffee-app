<script lang="ts">
	import { tick } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';

	// Readings from a roast in progress live only on the roast page until
	// "Save roast" stores them. While `active`, anything that would drop them
	// asks first: the page calls confirmLeave() before it switches roasts, and
	// this component intercepts navigation away from the page.
	let { active }: { active: boolean } = $props();

	let open = $state(false);
	let dialog = $state<HTMLDivElement>();
	let pendingChoice: Promise<boolean> | null = null;
	let resolveChoice: ((leave: boolean) => void) | null = null;
	let returnFocusTo: HTMLElement | null = null;
	// Lets the navigation the member just confirmed through without asking twice.
	let allowNextNavigation = false;

	/** Resolves true when it is safe to drop the live roast: nothing is recording, or the member chose to leave. */
	export function confirmLeave(): Promise<boolean> {
		if (!active) return Promise.resolve(true);
		if (!pendingChoice) {
			returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			pendingChoice = new Promise<boolean>((resolve) => {
				resolveChoice = resolve;
			});
			open = true;
			void tick().then(() => dialog?.querySelector<HTMLButtonElement>('button')?.focus());
		}
		return pendingChoice;
	}

	function choose(leave: boolean) {
		open = false;
		resolveChoice?.(leave);
		resolveChoice = null;
		pendingChoice = null;
		if (!leave) returnFocusTo?.focus();
		returnFocusTo = null;
	}

	beforeNavigate((navigation) => {
		if (allowNextNavigation) {
			allowNextNavigation = false;
			return;
		}
		if (!active) return;
		// A reload, a closed tab, or a link out of the app unloads the document.
		// Only the browser's own prompt can hold that; see handleBeforeUnload.
		if (navigation.willUnload || !navigation.to) return;
		// The page rewrites its own query string (?roast=, ?modal=) without leaving.
		if (navigation.to.url.pathname === navigation.from?.url.pathname) return;

		navigation.cancel();
		// The question is already open; a second attempt waits for that answer.
		if (pendingChoice) return;
		const destination = navigation.to.url;
		const historySteps = navigation.type === 'popstate' ? navigation.delta : undefined;
		void confirmLeave().then((leave) => {
			if (!leave) return;
			allowNextNavigation = true;
			if (historySteps) {
				history.go(historySteps);
			} else {
				void goto(destination);
			}
		});
	});

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		event.preventDefault();
		// Chrome and Safari show their prompt only when returnValue is set.
		event.returnValue = '';
	}

	// Listen only while a roast is recording, so an idle roast page keeps the
	// browser's back/forward cache.
	$effect(() => {
		if (!active) return;
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			choose(false);
			return;
		}
		if (event.key !== 'Tab') return;
		// Keep focus on the two choices while the question is open.
		const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []);
		if (buttons.length === 0) return;
		const first = buttons[0];
		const last = buttons[buttons.length - 1];
		const focused = document.activeElement;
		if (event.shiftKey && (focused === first || !dialog?.contains(focused))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (focused === last || !dialog?.contains(focused))) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-75 p-4">
		<div
			bind:this={dialog}
			class="w-full max-w-md rounded-lg bg-surface-panel p-4 shadow-lg md:p-6"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="live-roast-guard-title"
			aria-describedby="live-roast-guard-detail"
		>
			<h2 id="live-roast-guard-title" class="text-lg font-semibold text-ink">
				A roast is still recording.
			</h2>
			<p id="live-roast-guard-detail" class="mt-2 text-sm text-muted">
				Leaving now loses the readings that are not saved.
			</p>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
					onclick={() => choose(false)}
				>
					Keep roasting
				</button>
				<button
					type="button"
					class="rounded-md border border-danger px-4 py-2 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
					onclick={() => choose(true)}
				>
					Leave
				</button>
			</div>
		</div>
	</div>
{/if}
