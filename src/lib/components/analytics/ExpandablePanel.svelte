<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';

	let {
		title,
		subtitle,
		badge,
		badgeColor = 'amber',
		totalItems,
		expandLabel,
		collapsedMaxHeight = '280px',
		showGradient = true,
		onExpandChange,
		children
	}: {
		title: string;
		subtitle?: string;
		badge?: string;
		badgeColor?: string;
		totalItems?: number;
		expandLabel?: string;
		collapsedMaxHeight?: string;
		showGradient?: boolean;
		onExpandChange?: (expanded: boolean) => void;
		children: Snippet;
	} = $props();

	let expanded = $state(false);
	let expandTrigger: HTMLButtonElement | undefined = $state();
	let dialogEl: HTMLDivElement | undefined = $state();

	async function open() {
		expanded = true;
		onExpandChange?.(true);
		await tick();
		if (dialogEl) {
			dialogEl.tabIndex = -1;
			dialogEl.focus();
		}
	}

	async function close() {
		expanded = false;
		onExpandChange?.(false);
		await tick();
		expandTrigger?.focus();
	}

	// Lock body scroll while modal is open
	$effect(() => {
		if (expanded) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});

	const BADGE_STYLES: Record<string, string> = {
		amber: 'bg-warning-subtle text-warning-strong',
		red: 'bg-danger-subtle text-danger-strong',
		green: 'bg-success-subtle text-success-strong',
		blue: 'bg-info-subtle text-info-strong'
	};

	let badgeClass = $derived(BADGE_STYLES[badgeColor] ?? BADGE_STYLES.amber);
	let canExpand = $derived(totalItems == null || totalItems > 0);
	let computedExpandLabel = $derived(
		expandLabel ?? (totalItems != null ? `View all ${totalItems} →` : 'Expand')
	);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && expanded) close();
	}}
/>

<!-- Keep one child instance alive while switching between the clipped and modal layouts. -->
<div
	class={expanded
		? 'fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/40 p-1 backdrop-blur-sm sm:items-center sm:p-8'
		: 'relative'}
>
	{#if expanded}
		<!-- Click-outside-to-close backdrop (aria-hidden so screen readers skip it) -->
		<div
			transition:fade={{ duration: 150 }}
			class="absolute inset-0"
			aria-hidden="true"
			onclick={close}
		></div>
	{/if}

	<div
		role={expanded ? 'dialog' : undefined}
		aria-modal={expanded ? 'true' : undefined}
		aria-label={expanded ? title : undefined}
		bind:this={dialogEl}
		class={expanded
			? 'relative z-10 my-4 w-full max-w-5xl rounded-xl bg-surface-canvas shadow-2xl sm:my-0'
			: 'relative overflow-hidden'}
	>
		{#if expanded}
			<div
				class="flex items-start gap-3 rounded-t-xl border-b border-line bg-surface-canvas px-3 py-4 sm:px-6"
			>
				<div class="flex-1">
					<h2 class="text-lg font-semibold text-ink">{title}</h2>
					{#if subtitle}
						<p class="mt-0.5 text-sm text-muted">{subtitle}</p>
					{/if}
				</div>
				{#if badge}
					<span class="mt-0.5 rounded-full px-2.5 py-0.5 text-sm font-semibold {badgeClass}"
						>{badge}</span
					>
				{/if}
				<button
					onclick={close}
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-panel hover:text-ink"
					aria-label="Close panel"
				>
					✕
				</button>
			</div>
		{/if}

		<div
			class={expanded ? 'overflow-y-auto p-1 sm:p-6' : ''}
			style={expanded ? 'max-height: calc(90vh - 68px)' : `max-height: ${collapsedMaxHeight}`}
		>
			{@render children()}
		</div>

		{#if !expanded && showGradient}
			<div
				class="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FCFAF8] to-transparent"
			></div>
		{/if}
	</div>

	{#if !expanded && canExpand}
		<div class="mt-2.5 flex justify-center">
			<button
				bind:this={expandTrigger}
				onclick={open}
				class="rounded-full border border-line bg-surface-panel px-4 py-1.5 text-sm font-medium text-muted shadow-sm transition-colors duration-150 hover:border-accent hover:text-accent"
			>
				{computedExpandLabel}
			</button>
		</div>
	{/if}
</div>
