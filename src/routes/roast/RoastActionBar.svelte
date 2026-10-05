<script lang="ts">
	import { tick } from 'svelte';
	import { compareHref } from '$lib/roast/compare-sides';

	// The actions for the roast on screen. "Compare with…" is a plain link, so leaving a
	// roast that is still recording goes through the page's live-roast guard like any
	// other navigation.
	let {
		roastId,
		hasRecording,
		busy = false,
		onSaveReference,
		onEditDetails,
		onImportArtisan,
		onClearRecorded,
		onDeleteRoast,
		onDeleteBatch
	}: {
		roastId: number;
		/** Whether anything was recorded for this roast; there is nothing to compare, keep, or clear otherwise. */
		hasRecording: boolean;
		busy?: boolean;
		onSaveReference: () => void;
		onEditDetails: () => void;
		onImportArtisan: () => void;
		onClearRecorded: () => void;
		onDeleteRoast: () => void;
		onDeleteBatch: () => void;
	} = $props();

	const uid = $props.id();
	const menuId = `${uid}-menu`;

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);

	const items = $derived([
		{ label: 'Save as reference', run: onSaveReference, disabled: !hasRecording || busy },
		{ label: 'Edit details', run: onEditDetails, disabled: false },
		{ label: 'Import Artisan file', run: onImportArtisan, disabled: false },
		{ label: 'Clear recorded data', run: onClearRecorded, disabled: !hasRecording || busy },
		{ label: 'Delete roast', run: onDeleteRoast, disabled: busy, destructive: true },
		{ label: 'Delete batch', run: onDeleteBatch, disabled: busy, destructive: true }
	]);

	const enabledItems = () =>
		Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);

	async function show(focus: 'first' | 'last' = 'first') {
		open = true;
		await tick();
		const choices = enabledItems();
		(focus === 'first' ? choices[0] : choices[choices.length - 1])?.focus();
	}

	function hide(returnFocus = false) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function choose(run: () => void) {
		hide(true);
		run();
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			void show(event.key === 'ArrowDown' ? 'first' : 'last');
		}
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			hide(true);
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const choices = enabledItems();
		if (choices.length === 0) return;
		const index = choices.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? choices.length - 1
					: (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
		choices[next].focus();
	}

	function handleFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
		hide();
	}
</script>

<div class="mt-3 flex flex-wrap items-center gap-2">
	{#if hasRecording}
		<a
			href={compareHref({ a: { type: 'roast', id: roastId } })}
			class="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85"
		>
			Compare with…
		</a>
	{:else}
		<button
			type="button"
			disabled
			class="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink opacity-50 shadow-sm"
		>
			Compare with…
		</button>
	{/if}

	<div class="relative" onfocusout={handleFocusOut}>
		<button
			bind:this={trigger}
			type="button"
			aria-haspopup="menu"
			aria-expanded={open}
			aria-controls={menuId}
			class="inline-flex items-center justify-center gap-1 rounded-md border border-line bg-surface-canvas px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
			onclick={() => (open ? hide() : void show())}
			onkeydown={handleTriggerKeydown}
		>
			More
			<svg
				class="h-4 w-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
			</svg>
		</button>
		{#if open}
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				bind:this={menu}
				id={menuId}
				role="menu"
				aria-label="More actions for this roast"
				class="absolute right-0 z-20 mt-1 w-56 rounded-md border border-line bg-surface-panel py-1 shadow-lg sm:left-0 sm:right-auto"
				onkeydown={handleMenuKeydown}
			>
				{#each items as item, index (item.label)}
					{#if item.destructive && !items[index - 1]?.destructive}
						<div class="my-1 border-t border-line" role="separator"></div>
					{/if}
					<button
						type="button"
						role="menuitem"
						disabled={item.disabled}
						class="block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 {item.destructive
							? 'text-danger hover:bg-danger-subtle'
							: 'text-ink hover:bg-accent-subtle'}"
						onclick={() => choose(item.run)}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
