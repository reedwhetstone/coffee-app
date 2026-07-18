<script lang="ts">
	import { goto } from '$app/navigation';
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
</script>

<div
	class="relative overflow-hidden rounded-lg border border-accent/20 bg-accent-subtle/10 p-6 pl-8"
>
	<AccentSpine />
	<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
		<div class="text-center sm:text-left">
			<h3 class="text-lg font-semibold text-ink">Ready to source smarter?</h3>
			<p class="text-sm text-muted">
				Parchment Intelligence compares suppliers and tracks market movement for you. Mallard Studio
				connects the catalog to your own inventory, roasts, and margins.
			</p>
		</div>
		<div>
			<button
				onclick={() => goto('/subscription')}
				class="rounded-md bg-accent px-6 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
			>
				Compare paid products
			</button>
		</div>
	</div>
</div>
