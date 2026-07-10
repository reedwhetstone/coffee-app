<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	const subscriptionCards = [0, 1, 2, 3];
</script>

<div class="animate-pulse space-y-8">
	<div class="mx-auto max-w-4xl text-center">
		<Skeleton class="mx-auto mb-3 h-4 w-32 opacity-30" />
		<Skeleton class="mx-auto mb-3 h-10 w-[32rem] max-w-full opacity-50" />
		<Skeleton class="mx-auto h-4 w-[42rem] max-w-full opacity-25" />
	</div>
	<div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
		{#each subscriptionCards as card (card)}
			<div class="rounded-lg bg-surface-panel p-5 ring-1 ring-line">
				<Skeleton class="mb-3 h-4 w-24 opacity-30" />
				<Skeleton class="mb-3 h-7 w-40 max-w-full opacity-50" />
				<div class="mb-5 space-y-2">
					<Skeleton class="h-3 w-full opacity-25" />
					<Skeleton class="h-3 w-5/6 opacity-25" />
				</div>
				<Skeleton class="mb-4 h-9 w-28 opacity-45" />
				<div class="space-y-2">
					<Skeleton class="h-3 w-full opacity-20" />
					<Skeleton class="h-3 w-11/12 opacity-20" />
					<Skeleton class="h-3 w-3/4 opacity-20" />
				</div>
				<Skeleton class="mt-6 h-10 w-full opacity-25" rounded="rounded-md" />
			</div>
		{/each}
	</div>
</div>
