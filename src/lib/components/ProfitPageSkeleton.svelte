<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<Skeleton class="mb-2 h-8 w-48 opacity-50" />
		<Skeleton class="h-4 w-80 opacity-30" />
	</div>

	<!-- KPI Cards -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(4) as _}
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<Skeleton class="mb-2 h-4 w-24 opacity-30" />
				<Skeleton class="mb-1 h-8 w-20 opacity-50" />
				<Skeleton class="h-3 w-32 opacity-30" />
			</div>
		{/each}
	</div>

	<!-- Chart Section -->
	<div class="mb-6 rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		<Skeleton class="mb-4 h-6 w-32 opacity-50" />

		<!-- Chart area -->
		<div class="relative h-64 w-full rounded bg-accent opacity-20">
			<!-- Chart bars -->
			<div class="absolute inset-4 flex items-end justify-between">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(12) as _}
					<div
						class="w-4 rounded-t bg-accent opacity-40"
						style="height: {Math.random() * 80 + 20}%"
					></div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Sales Table -->
	<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		<div class="mb-4 flex items-center justify-between">
			<Skeleton class="h-6 w-24 opacity-50" />
			<Skeleton class="h-9 w-28 opacity-30" />
		</div>

		<!-- Table header -->
		<div class="mb-2 grid grid-cols-5 gap-4 border-b border-line pb-2">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array(5) as _}
				<Skeleton class="h-4 w-16 opacity-30" />
			{/each}
		</div>

		<!-- Table rows -->
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(8) as _}
			<div class="grid grid-cols-5 gap-4 border-b border-line py-2">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(5) as _}
					<Skeleton class="h-4 w-12 opacity-20" />
				{/each}
			</div>
		{/each}
	</div>
</div>
