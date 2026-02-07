<script lang="ts">
	import type { UIBlock, BlockAction } from '$lib/types/genui';
	import CoffeeCardsBlock from './blocks/CoffeeCardsBlock.svelte';
	import InventoryTableBlock from './blocks/InventoryTableBlock.svelte';
	import RoastProfilesBlock from './blocks/RoastProfilesBlock.svelte';
	import TastingRadarBlock from './blocks/TastingRadarBlock.svelte';
	import DataTableBlock from './blocks/DataTableBlock.svelte';
	import ErrorBlock from './blocks/ErrorBlock.svelte';

	let { block, onAction } = $props<{
		block: UIBlock;
		onAction?: (action: BlockAction) => void;
	}>();
</script>

<div class="genui-block w-full">
	{#if block.type === 'coffee-cards'}
		<CoffeeCardsBlock {block} />
	{:else if block.type === 'inventory-table'}
		<InventoryTableBlock {block} {onAction} />
	{:else if block.type === 'roast-profiles'}
		<RoastProfilesBlock {block} {onAction} />
	{:else if block.type === 'tasting-radar'}
		<TastingRadarBlock {block} {onAction} />
	{:else if block.type === 'data-table'}
		<DataTableBlock {block} {onAction} />
	{:else if block.type === 'error'}
		<ErrorBlock {block} />
	{/if}
</div>

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
