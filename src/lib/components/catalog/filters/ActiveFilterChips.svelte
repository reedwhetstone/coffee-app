<script lang="ts">
	import type { ActiveCatalogFilter } from '$lib/catalog/filterModel';

	interface Props {
		filters: ActiveCatalogFilter[];
		resultCount: number;
		isRefetching?: boolean;
		onRemove: (filter: ActiveCatalogFilter) => void;
		onClearAll: () => void;
	}

	let { filters, resultCount, isRefetching = false, onRemove, onClearAll }: Props = $props();
</script>

{#if filters.length > 0}
	<div class="flex flex-wrap items-center gap-2" aria-label="Active filters">
		<p class="text-sm text-muted" aria-live="polite">
			<span class="font-semibold text-ink">{resultCount.toLocaleString()}</span>
			{resultCount === 1 ? 'coffee' : 'coffees'}
			{isRefetching ? '· updating' : ''}
		</p>
		<ul class="flex flex-wrap items-center gap-1.5">
			{#each filters as filter (filter.id)}
				<li>
					<button
						type="button"
						onclick={() => onRemove(filter)}
						aria-label={`Remove filter: ${filter.label}`}
						class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-panel py-1 pl-3 pr-2 text-sm text-ink transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<span>{filter.label}</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="h-3.5 w-3.5 text-muted"
							aria-hidden="true"
						>
							<path
								d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
							/>
						</svg>
					</button>
				</li>
			{/each}
		</ul>
		<button type="button" onclick={onClearAll} class="text-sm text-link hover:text-accent">
			Clear all
		</button>
	</div>
{/if}
