<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		displayCount: number;
	}

	let { displayCount }: Props = $props();
</script>

<div
	class="mb-4 flex flex-col gap-2 rounded-lg border border-accent/25 bg-accent-subtle/10 p-4 sm:flex-row sm:items-center sm:justify-between"
	aria-label="Tracked lots filter"
>
	<p class="text-sm text-ink">
		<span class="font-semibold">Watchlist view:</span>
		showing only your {displayCount} tracked
		{displayCount === 1 ? 'lot' : 'lots'}, including delisted ones.
	</p>
	<button
		onclick={() => goto('/catalog')}
		class="rounded-md border border-accent px-4 py-1.5 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
	>
		Show full catalog
	</button>
</div>
