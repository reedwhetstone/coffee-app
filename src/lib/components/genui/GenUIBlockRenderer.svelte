<script lang="ts">
	import type { UIBlock, BlockAction } from '$lib/types/genui';
	// Full block components (canvas mode)
	import CoffeeCardsBlock from './blocks/CoffeeCardsBlock.svelte';
	import InventoryTableBlock from './blocks/InventoryTableBlock.svelte';
	import RoastProfilesBlock from './blocks/RoastProfilesBlock.svelte';
	import TastingRadarBlock from './blocks/TastingRadarBlock.svelte';
	import DataTableBlock from './blocks/DataTableBlock.svelte';
	import ErrorBlock from './blocks/ErrorBlock.svelte';
	import RoastChartBlock from './blocks/RoastChartBlock.svelte';
	import ActionCardBlock from './blocks/ActionCardBlock.svelte';
	// Preview components (chat mode)
	import CoffeeCardPreview from './previews/CoffeeCardPreview.svelte';
	import InventoryPreview from './previews/InventoryPreview.svelte';
	import RoastProfilesPreview from './previews/RoastProfilesPreview.svelte';
	import TastingRadarPreview from './previews/TastingRadarPreview.svelte';
	import DataTablePreview from './previews/DataTablePreview.svelte';
	import ErrorPreview from './previews/ErrorPreview.svelte';
	import RoastChartPreview from './previews/RoastChartPreview.svelte';
	import ActionCardPreview from './previews/ActionCardPreview.svelte';

	let { block, onAction, onExecuteAction, renderMode = 'canvas', canvasBlockId } = $props<{
		block: UIBlock;
		onAction?: (action: BlockAction) => void;
		onExecuteAction?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
		renderMode?: 'chat' | 'canvas';
		canvasBlockId?: string;
	}>();
</script>

{#if renderMode === 'chat'}
	<!-- Chat inline previews: compact styled links -->
	<span class="genui-preview inline-block">
		{#if block.type === 'coffee-cards'}
			<CoffeeCardPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'inventory-table'}
			<InventoryPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'roast-profiles'}
			<RoastProfilesPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'tasting-radar'}
			<TastingRadarPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'roast-chart'}
			<RoastChartPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'action-card'}
			<ActionCardPreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'data-table'}
			<DataTablePreview {block} {onAction} {canvasBlockId} />
		{:else if block.type === 'error'}
			<ErrorPreview {block} />
		{/if}
	</span>
{:else}
	<!-- Canvas full blocks -->
	<div class="genui-block w-full">
		{#if block.type === 'coffee-cards'}
			<CoffeeCardsBlock {block} />
		{:else if block.type === 'inventory-table'}
			<InventoryTableBlock {block} {onAction} />
		{:else if block.type === 'roast-profiles'}
			<RoastProfilesBlock {block} {onAction} />
		{:else if block.type === 'roast-chart'}
			<RoastChartBlock {block} />
		{:else if block.type === 'action-card'}
			<ActionCardBlock {block} {onAction} onExecute={onExecuteAction} />
		{:else if block.type === 'tasting-radar'}
			<TastingRadarBlock {block} {onAction} />
		{:else if block.type === 'data-table'}
			<DataTableBlock {block} {onAction} />
		{:else if block.type === 'error'}
			<ErrorBlock {block} />
		{/if}
	</div>
{/if}

<style>
	.genui-block {
		animation: blockFadeIn 0.3s ease-out;
	}

	@keyframes blockFadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
