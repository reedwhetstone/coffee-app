<script lang="ts">
	// Thin top-of-viewport progress bar for pending SvelteKit navigations.
	// Kept intentionally utilitarian: no card, copy, or decorative animation.
	// `active` is driven by the layout from `$navigating`; exposing it as a prop
	// keeps the component pure and testable without mocking navigation state.
	let { active = false }: { active?: boolean } = $props();
</script>

{#if active}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
		role="progressbar"
		aria-label="Page loading"
		aria-live="polite"
	>
		<div class="nav-progress-bar h-full bg-accent"></div>
	</div>
{/if}

<style>
	.nav-progress-bar {
		width: 100%;
		transform-origin: left center;
		animation: nav-progress 1.2s ease-in-out infinite;
	}

	@keyframes nav-progress {
		0% {
			transform: scaleX(0);
			opacity: 0.6;
		}
		50% {
			transform: scaleX(0.7);
			opacity: 1;
		}
		100% {
			transform: scaleX(1);
			opacity: 0.6;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-progress-bar {
			animation: none;
			opacity: 0.9;
		}
	}
</style>
