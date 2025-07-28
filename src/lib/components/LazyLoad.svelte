<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		threshold?: number;
		rootMargin?: string;
		once?: boolean;
		children?: import('svelte').Snippet;
	};

	let { threshold = 0.1, rootMargin = '50px', once = true, children }: Props = $props();

	let isVisible = $state(false);
	let element: HTMLElement;

	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					isVisible = true;
					if (once) {
						observer.unobserve(element);
					}
				} else if (!once) {
					isVisible = false;
				}
			},
			{
				threshold,
				rootMargin
			}
		);

		if (element) {
			observer.observe(element);
		}

		return () => {
			if (element) {
				observer.unobserve(element);
			}
		};
	});
</script>

<div bind:this={element} class="lazy-load-container">
	{#if isVisible}
		{@render children?.()}
	{:else}
		<!-- Loading placeholder -->
		<div class="min-h-[200px] animate-pulse bg-background-secondary-light/50 rounded-lg">
			<div class="flex items-center justify-center h-full">
				<div class="text-text-secondary-light text-sm">Loading...</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.lazy-load-container {
		min-height: 1px; /* Ensure element has height for intersection observer */
	}
</style>

