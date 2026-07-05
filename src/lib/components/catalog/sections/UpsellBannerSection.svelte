<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="rounded-lg border border-background-tertiary-light/20 bg-accent-subtle/10 p-6">
	<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
		<div class="text-center sm:text-left">
			<h3 class="text-lg font-semibold text-text-primary-light">Ready to source smarter?</h3>
			<p class="text-sm text-text-secondary-light">
				Parchment Intelligence compares suppliers and tracks market movement for you. Mallard Studio
				connects the catalog to your own inventory, roasts, and margins.
			</p>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row">
			<button
				onclick={() => goto('/subscription')}
				class="rounded-md bg-background-tertiary-light px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Compare paid products
			</button>
			<button
				onclick={() => goto('/analytics')}
				class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
			>
				Open Market Index
			</button>
		</div>
	</div>
</div>
