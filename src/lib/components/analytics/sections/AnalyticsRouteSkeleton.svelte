<script lang="ts">
	let { isParchmentIntelligence } = $props<{
		isParchmentIntelligence: boolean;
	}>();
</script>

<section
	aria-busy="true"
	aria-label="Loading Market Index details"
	class="route-skeleton space-y-6"
>
	<section class="rounded-lg border border-accent/20 bg-surface-panel p-5 shadow-sm">
		<div class="flex items-start gap-3">
			<span class="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-accent"></span>
			<div class="flex-1">
				<div class="h-4 w-40 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-surface-canvas"></div>
			</div>
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each Array.from({ length: 4 }) as _}
			<div class="rounded-lg border border-line bg-surface-panel p-4 shadow-sm">
				<div class="h-3 w-28 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-4 h-8 w-20 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-4 h-3 w-full animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-2 h-3 w-3/4 animate-pulse rounded bg-surface-canvas"></div>
			</div>
		{/each}
	</section>

	<section class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
		<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
			<div class="h-5 w-36 animate-pulse rounded bg-surface-canvas"></div>
			<div class="mt-4 h-72 animate-pulse rounded-md bg-surface-canvas"></div>
		</div>
		<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
			<div class="h-5 w-40 animate-pulse rounded bg-surface-canvas"></div>
			<div class="mt-4 space-y-3">
				{#each Array.from({ length: 5 }) as _}
					<div class="h-10 animate-pulse rounded bg-surface-canvas"></div>
				{/each}
			</div>
		</div>
	</section>

	{#if isParchmentIntelligence}
		<section class="grid gap-5 lg:grid-cols-2">
			{#each Array.from({ length: 2 }) as _}
				<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
					<div class="h-5 w-44 animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-4 h-56 animate-pulse rounded-md bg-surface-canvas"></div>
				</div>
			{/each}
		</section>
	{/if}
</section>

<style>
	@media (prefers-reduced-motion: reduce) {
		.route-skeleton :global(.animate-pulse) {
			animation: none;
		}
	}
</style>
