<script lang="ts">
	import type { Component } from 'svelte';
	import type { TastingRadarBlock, BlockAction } from '$lib/types/genui';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';

	let { block, onAction: _onAction } = $props<{
		block: TastingRadarBlock;
		onAction?: (action: BlockAction) => void;
	}>();

	let TastingNotesRadar = $state<Component | null>(null);
	let loading = $state(true);

	$effect(() => {
		setTimeout(async () => {
			try {
				const module = await import('$lib/components/TastingNotesRadar.svelte');
				TastingNotesRadar = module.default;
				loading = false;
			} catch (error) {
				console.error('Failed to load radar component:', error);
				loading = false;
			}
		}, 100);
	});

	const sourceLabel = $derived(
		block.data.source === 'user'
			? 'User Cupping'
			: block.data.source === 'supplier'
				? 'Supplier Notes'
				: 'Combined Notes'
	);
</script>

<div class="my-4">
	<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		<div class="mb-2">
			<h3 class="font-semibold text-ink">{block.data.beanName}</h3>
			<p class="text-xs text-muted">{sourceLabel}</p>
		</div>
		<div class="flex justify-center">
			{#if loading}
				<ChartSkeleton height="250px" title="Loading tasting profile..." />
			{:else if TastingNotesRadar}
				<TastingNotesRadar
					tastingNotes={block.data.notes}
					size={250}
					responsive={false}
					lazy={false}
				/>
			{:else}
				<p class="text-sm text-muted">Unable to load tasting chart</p>
			{/if}
		</div>
	</div>
</div>
