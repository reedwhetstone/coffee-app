<script lang="ts">
	import { defaultBlockTitle, type BlockAction, type CanvasBlock } from '$lib/types/genui';
	import GenUIBlockRenderer from '$lib/components/genui/GenUIBlockRenderer.svelte';
	import { getDetailCompanionBlocks, detailCompanionLabel } from '$lib/services/blockDetail';

	let {
		canvasBlock = null,
		onClose,
		onAction,
		onExecuteAction
	} = $props<{
		/** The canvas block to show in detail, or null when the panel is closed. */
		canvasBlock?: CanvasBlock | null;
		onClose: () => void;
		onAction?: (action: BlockAction) => void;
		onExecuteAction?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
	}>();

	let title = $derived(
		canvasBlock ? (canvasBlock.title ?? defaultBlockTitle(canvasBlock.block.type)) : ''
	);

	// Richer companion content (e.g. full roast charts) for the detail view.
	let companions = $derived(canvasBlock ? getDetailCompanionBlocks(canvasBlock.block) : []);

	function handleKeydown(event: KeyboardEvent) {
		if (canvasBlock && event.key === 'Escape') {
			event.stopPropagation();
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if canvasBlock}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 sm:p-6"
		onclick={onClose}
	>
		<!-- Panel -->
		<div
			class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-background-primary-light shadow-2xl ring-1 ring-border-light"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label={`${title} details`}
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div
				class="flex shrink-0 items-center justify-between gap-3 border-b border-border-light px-4 py-3"
			>
				<div class="min-w-0">
					<h2 class="truncate text-sm font-semibold text-text-primary-light" {title}>
						{title}
					</h2>
					<p class="text-xs text-text-secondary-light">
						{defaultBlockTitle(canvasBlock.block.type)}
					</p>
				</div>
				<button
					onclick={onClose}
					class="rounded-md p-1 text-text-secondary-light transition-colors hover:text-text-primary-light"
					aria-label="Close detail panel"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-auto p-4">
				<GenUIBlockRenderer
					block={canvasBlock.block}
					renderMode="canvas"
					{onAction}
					{onExecuteAction}
				/>

				{#if companions.length > 0}
					<div class="mt-4 space-y-4 border-t border-border-light pt-4">
						{#each companions as companion, i (i)}
							{@const label = detailCompanionLabel(companion)}
							<div>
								{#if label}
									<h3 class="mb-2 text-xs font-medium text-text-secondary-light">{label}</h3>
								{/if}
								<GenUIBlockRenderer block={companion} renderMode="canvas" {onAction} />
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
