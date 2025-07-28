<script lang="ts">
	import { onMount, tick } from 'svelte';

	let {
		items = [],
		itemHeight = 200,
		containerHeight = 600,
		overscan = 5,
		getKey = (item: any, index: number) => item.id || index
	} = $props<{
		items: any[];
		itemHeight?: number;
		containerHeight?: number;
		overscan?: number;
		getKey?: (item: any, index: number) => string | number;
	}>();

	let scrollContainer: HTMLElement;
	let scrollTop = $state(0);
	let containerEl: HTMLElement;

	// Calculate visible range
	let visibleRange = $derived(() => {
		const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const visibleCount = Math.ceil(containerHeight / itemHeight);
		const end = Math.min(items.length, start + visibleCount + overscan * 2);
		return { start, end };
	});

	let visibleItems = $derived(() => {
		const { start, end } = visibleRange();
		return items.slice(start, end).map((item: any, index: number) => ({
			item,
			index: start + index,
			key: getKey(item, start + index)
		}));
	});

	let totalHeight = $derived(items.length * itemHeight);
	let offsetY = $derived(visibleRange().start * itemHeight);

	function handleScroll() {
		if (scrollContainer) {
			scrollTop = scrollContainer.scrollTop;
		}
	}

	onMount(() => {
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
			return () => scrollContainer.removeEventListener('scroll', handleScroll);
		}
	});
</script>

<div
	bind:this={scrollContainer}
	class="virtual-scroll-container overflow-auto"
	style="height: {containerHeight}px;"
>
	<div class="virtual-scroll-spacer" style="height: {totalHeight}px; position: relative;">
		<div
			class="virtual-scroll-content"
			style="transform: translateY({offsetY}px); position: absolute; top: 0; left: 0; right: 0;"
		>
			{#each visibleItems() as { item, index, key } (key)}
				<div class="virtual-scroll-item" style="height: {itemHeight}px;">
					{@render children({ item, index })}
				</div>
			{/each}
		</div>
	</div>
</div>

{#snippet children({ item, index }: { item: any; index: number })}
	<!-- Default content - should be overridden -->
	<div class="border-b p-4">Item {index}</div>
{/snippet}

<style>
	.virtual-scroll-container {
		width: 100%;
	}

	.virtual-scroll-item {
		width: 100%;
	}
</style>
