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
	{/if}
</div>
