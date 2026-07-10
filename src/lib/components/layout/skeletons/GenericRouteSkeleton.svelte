<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
</script>

<div class="animate-pulse space-y-6">
	<div>
		<Skeleton class="mb-3 h-8 w-64 max-w-full opacity-50" />
		<Skeleton class="h-4 w-96 max-w-full opacity-30" />
	</div>
	<div class="space-y-4">
		{#each Array.from({ length: 3 }) as _, index (index)}
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<Skeleton class="mb-3 h-6 w-1/3 opacity-50" />
				<div class="space-y-2">
					<Skeleton class="h-4 w-full opacity-25" />
					<Skeleton class="h-4 w-3/4 opacity-25" />
					<Skeleton class="h-4 w-1/2 opacity-25" />
				</div>
			</div>
		{/each}
	</div>
</div>
