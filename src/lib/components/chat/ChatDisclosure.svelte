<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let {
		label,
		trigger,
		children,
		align = 'left',
		anchorToTrigger = false,
		upward = true,
		closeOnSelect = false
	} = $props<{
		label: string;
		trigger: Snippet;
		children: Snippet;
		align?: 'left' | 'right';
		anchorToTrigger?: boolean;
		upward?: boolean;
		closeOnSelect?: boolean;
	}>();
	let disclosure: HTMLDetailsElement;

	onMount(() => {
		function close(event: Event) {
			if (!disclosure.open) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (!disclosure.contains(target)) disclosure.open = false;
		}
		function escape(event: KeyboardEvent) {
			if (!disclosure.open || event.key !== 'Escape' || event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
			disclosure.open = false;
			disclosure.querySelector('summary')?.focus();
		}
		document.addEventListener('pointerdown', close);
		document.addEventListener('focusin', close);
		// Own Escape before an enclosing drawer can close.
		document.addEventListener('keydown', escape, true);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('focusin', close);
			document.removeEventListener('keydown', escape, true);
		};
	});
</script>

<details bind:this={disclosure} class="min-w-0 {anchorToTrigger ? 'relative' : ''}">
	<summary
		aria-label={label}
		title={label}
		class="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-panel hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
	>
		{@render trigger()}
	</summary>
	<div
		class="absolute z-20 max-h-[min(24rem,50dvh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line bg-surface-panel p-2 shadow-lg {align ===
		'right'
			? 'right-0'
			: 'left-0'} {upward ? 'bottom-full mb-1' : 'top-full mt-1'}"
		onclickcapture={(event) => {
			if (closeOnSelect && (event.target as HTMLElement).closest('button:not(:disabled), a')) {
				disclosure.open = false;
				// Dialogs opened by a menu action must return to a visible trigger.
				disclosure.querySelector('summary')?.focus();
			}
		}}
	>
		{@render children()}
	</div>
</details>
