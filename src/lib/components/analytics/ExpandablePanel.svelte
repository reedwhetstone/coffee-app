<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	let {
		title,
		subtitle,
		badge,
		badgeColor = 'amber',
		totalItems,
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
		collapsedMaxHeight?: string;
		showGradient?: boolean;
		onExpandChange?: (expanded: boolean) => void;
		children: Snippet;
	} = $props();

	let expanded = $state(false);

	function open() {
		expanded = true;
		onExpandChange?.(true);
	}

	function close() {
		expanded = false;
		onExpandChange?.(false);
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
		amber: 'bg-amber-100 text-amber-700',
		red: 'bg-red-100 text-red-600',
		green: 'bg-green-100 text-green-700',
		blue: 'bg-blue-100 text-blue-700'
	};

	let badgeClass = $derived(BADGE_STYLES[badgeColor] ?? BADGE_STYLES.amber);
	let expandLabel = $derived(totalItems != null ? `View all ${totalItems} →` : `Expand ↗`);
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && expanded) close();
	}}
/>

<!-- Collapsed view: clips content with CSS, shows gradient fade + expand button -->
<div class="relative">
	<div class="relative overflow-hidden" style="max-height: {collapsedMaxHeight}">
		{@render children()}
		{#if showGradient}
			<div
				class="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FCFAF8] to-transparent"
			></div>
		{/if}
	</div>

	<div class="mt-2.5 flex justify-center">
		<button
			onclick={open}
			class="rounded-full border border-border-light bg-background-secondary-light px-4 py-1.5 text-sm font-medium text-text-secondary-light shadow-sm transition-colors duration-150 hover:border-background-tertiary-light hover:text-background-tertiary-light"
		>
			{expandLabel}
		</button>
	</div>
</div>

<!-- Expanded modal overlay -->
{#if expanded}
	<!-- Backdrop -->
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center sm:p-8"
	>
		<!-- Click-outside-to-close backdrop (aria-hidden so screen readers skip it) -->
		<div class="absolute inset-0" aria-hidden="true" onclick={close}></div>

		<!-- Modal panel -->
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			transition:scale={{ duration: 150, start: 0.95 }}
			class="relative z-10 my-4 w-full max-w-5xl rounded-xl bg-background-primary-light shadow-2xl sm:my-0"
		>
			<!-- Modal header -->
			<div
				class="flex items-start gap-3 rounded-t-xl border-b border-border-light bg-background-primary-light px-6 py-4"
			>
				<div class="flex-1">
					<h2 class="text-lg font-semibold text-text-primary-light">{title}</h2>
					{#if subtitle}
						<p class="mt-0.5 text-sm text-text-secondary-light">{subtitle}</p>
					{/if}
				</div>
				{#if badge}
					<span class="mt-0.5 rounded-full px-2.5 py-0.5 text-sm font-semibold {badgeClass}"
						>{badge}</span
					>
				{/if}
				<button
					onclick={close}
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
					aria-label="Close panel"
				>
					✕
				</button>
			</div>

			<!-- Scrollable modal body -->
			<div class="overflow-y-auto p-6" style="max-height: calc(90vh - 68px)">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
