<script lang="ts">
	import type { Component } from 'svelte';
	import { loadRouteSkeletonComponent } from './routeSkeletons';

	let { pathname = '/' }: { pathname?: string | null } = $props();

	// Skeleton components are lazy so they stay out of the persistent root
	// chunk. The layout warms the chunk when navigation starts, so by the time
	// the display threshold elapses the module is normally already resolved.
	let SkeletonComponent = $state<Component | null>(null);

	$effect(() => {
		const target = pathname;
		let cancelled = false;
		SkeletonComponent = null;

		void loadRouteSkeletonComponent(target).then((component) => {
			if (cancelled || !component) return;
			SkeletonComponent = component;
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<div aria-busy="true" aria-label="Loading page" data-testid="route-skeleton">
	{#if SkeletonComponent}
		<SkeletonComponent />
	{:else}
		<!-- Inline fallback so the main area is never blank if the destination
		     skeleton chunk is still in flight past the display threshold (slow
		     uncached network) or its import failed. Plain markup only — this
		     ships in the root chunk. -->
		<div class="animate-pulse space-y-6" data-testid="route-skeleton-fallback">
			<div>
				<div class="mb-3 h-8 w-64 max-w-full rounded bg-accent opacity-50"></div>
				<div class="h-4 w-96 max-w-full rounded bg-accent opacity-30"></div>
			</div>
			<div class="space-y-4">
				{#each Array.from({ length: 3 }) as _, index (index)}
					<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
						<div class="mb-3 h-6 w-1/3 rounded bg-accent opacity-50"></div>
						<div class="space-y-2">
							<div class="h-4 w-full rounded bg-accent opacity-25"></div>
							<div class="h-4 w-3/4 rounded bg-accent opacity-25"></div>
							<div class="h-4 w-1/2 rounded bg-accent opacity-25"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
