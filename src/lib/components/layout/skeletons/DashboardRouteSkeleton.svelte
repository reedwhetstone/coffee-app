<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
</script>

<div class="animate-pulse space-y-6">
	<div>
		<Skeleton class="mb-3 h-8 w-64 max-w-full opacity-50" />
		<Skeleton class="h-4 w-96 max-w-full opacity-30" />
	</div>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		{#each Array.from({ length: 4 }) as _, index (index)}
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<Skeleton class="mb-2 h-4 w-24 opacity-30" />
				<Skeleton class="mb-1 h-8 w-20 opacity-50" />
				<Skeleton class="h-3 w-32 opacity-25" />
			</div>
		{/each}
	</div>
	<div class="grid gap-4 lg:grid-cols-2">
		<Skeleton class="h-72 w-full opacity-20" rounded="rounded-lg" />
		<Skeleton class="h-72 w-full opacity-20" rounded="rounded-lg" />
	</div>
</div>
