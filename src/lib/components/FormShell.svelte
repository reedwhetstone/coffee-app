<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		title,
		subtitle = '',
		mode = 'card',
		maxWidth = 'max-w-4xl',
		onClose,
		children,
		footer
	}: {
		title: string;
		subtitle?: string;
		mode?: 'modal' | 'card';
		maxWidth?: string;
		onClose?: () => void;
		children: Snippet;
		footer: Snippet;
	} = $props();
</script>

{#if mode === 'modal'}
	<!-- Full-screen modal overlay with pinned header/footer -->
	<div class="fixed inset-0 z-50" role="dialog" aria-modal="true">
		<button
			type="button"
			class="fixed inset-0 bg-black/50"
			onclick={onClose}
			onkeydown={(e) => e.key === 'Escape' && onClose?.()}
			aria-label="Close modal"
		></button>
		<div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
			<div
				class="relative flex max-h-full w-full {maxWidth} flex-col rounded-lg bg-background-secondary-light shadow-xl"
				role="dialog"
				aria-modal="true"
			>
				<!-- Header (pinned) -->
				<div class="shrink-0 border-b border-background-tertiary-light/20 p-4 sm:p-6">
					<h2 class="text-2xl font-bold text-text-primary-light">{title}</h2>
					{#if subtitle}
						<p class="mt-2 text-text-secondary-light">{subtitle}</p>
					{/if}
				</div>

				<!-- Scrollable body -->
				<div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
					{@render children()}
				</div>

				<!-- Footer (pinned) -->
				<div class="shrink-0 border-t border-background-tertiary-light/20 p-4 sm:p-6">
					{@render footer()}
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Inline card form -->
	<div class="rounded-lg bg-background-secondary-light p-4 shadow-sm sm:p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-2xl font-bold text-text-primary-light">{title}</h2>
			{#if subtitle}
				<p class="mt-2 text-text-secondary-light">{subtitle}</p>
			{/if}
		</div>

		<!-- Scrollable body -->
		<div class="max-h-[70vh] overflow-y-auto pr-1">
			{@render children()}
		</div>

		<!-- Footer -->
		<div class="mt-6 border-t border-background-tertiary-light/20 pt-4">
			{@render footer()}
		</div>
	</div>
{/if}
