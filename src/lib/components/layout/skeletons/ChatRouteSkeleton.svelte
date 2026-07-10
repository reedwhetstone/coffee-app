<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	const chatMessageRows = [0, 1, 2];
</script>

<div
	class="grid min-h-[min(720px,calc(100vh-10rem))] animate-pulse gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"
>
	<aside class="hidden rounded-lg bg-surface-panel p-4 ring-1 ring-line lg:block">
		<Skeleton class="mb-4 h-7 w-40 opacity-50" />
		<div class="space-y-3">
			<Skeleton class="h-10 w-full opacity-25" rounded="rounded-md" />
			<Skeleton class="h-10 w-11/12 opacity-25" rounded="rounded-md" />
			<Skeleton class="h-10 w-4/5 opacity-25" rounded="rounded-md" />
		</div>
		<div class="mt-8 space-y-3">
			<Skeleton class="h-4 w-24 opacity-30" />
			<Skeleton class="h-16 w-full opacity-20" rounded="rounded-md" />
			<Skeleton class="h-16 w-full opacity-20" rounded="rounded-md" />
		</div>
	</aside>
	<section class="flex min-h-0 flex-col rounded-lg bg-surface-panel ring-1 ring-line">
		<div class="border-b border-line p-4">
			<Skeleton class="mb-2 h-6 w-56 max-w-full opacity-50" />
			<Skeleton class="h-4 w-80 max-w-full opacity-30" />
		</div>
		<div class="flex-1 space-y-5 p-4">
			{#each chatMessageRows as row (row)}
				<div class="max-w-3xl rounded-lg bg-surface-canvas p-4">
					<Skeleton class="mb-3 h-4 w-28 opacity-30" />
					<Skeleton class="mb-2 h-4 w-full opacity-25" />
					<Skeleton class="h-4 w-2/3 opacity-25" />
				</div>
			{/each}
		</div>
		<div class="border-t border-line p-4">
			<Skeleton class="h-12 w-full opacity-25" rounded="rounded-md" />
		</div>
	</section>
</div>
