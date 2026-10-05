<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	// A question asked over the saved library: the same panel the live-roast question uses.
	// Escape and the backdrop both mean "cancel".
	let {
		title,
		urgent = false,
		onCancel,
		children
	}: {
		title: string;
		/** A confirmation before something is removed. */
		urgent?: boolean;
		onCancel: () => void;
		children: Snippet;
	} = $props();

	const uid = $props.id();
	let dialog = $state<HTMLDivElement>();
	let returnFocusTo: HTMLElement | null = null;

	const focusable = () =>
		Array.from(
			dialog?.querySelectorAll<HTMLElement>(
				'button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href]'
			) ?? []
		);

	onMount(() => {
		returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		focusable()[0]?.focus();
		return () => returnFocusTo?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
			return;
		}
		if (event.key !== 'Tab') return;
		// Keep focus on the question while it is open.
		const controls = focusable();
		if (controls.length === 0) return;
		const first = controls[0];
		const last = controls[controls.length - 1];
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

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-75 p-4"
	onclick={(event) => {
		if (event.target === event.currentTarget) onCancel();
	}}
>
	<div
		bind:this={dialog}
		class="w-full max-w-md rounded-lg bg-surface-panel p-4 shadow-lg md:p-6"
		role={urgent ? 'alertdialog' : 'dialog'}
		aria-modal="true"
		aria-labelledby="{uid}-title"
	>
		<h2 id="{uid}-title" class="break-words text-lg font-semibold text-ink">{title}</h2>
		{@render children()}
	</div>
</div>
