<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<Skeleton class="mb-2 h-8 w-48 opacity-50" />
		<Skeleton class="h-4 w-96 opacity-30" />
	</div>

	<!-- Dashboard Cards Section -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(5) as _}
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<Skeleton class="mb-2 h-4 w-20 opacity-30" />
				<Skeleton class="mb-1 h-6 w-16 opacity-50" />
				<Skeleton class="h-3 w-24 opacity-30" />
			</div>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<Skeleton class="h-4 w-32 opacity-30" />
		<div class="flex gap-2">
			<Skeleton class="h-9 w-24 opacity-30" />
			<Skeleton class="h-9 w-32 opacity-30" />
		</div>
	</div>

	<!-- Coffee Cards Grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(9) as _}
			<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
				<div class="flex items-start justify-between">
					<!-- Left side content -->
					<div class="flex-1">
						<Skeleton class="mb-2 h-5 w-48 opacity-50" />
						<Skeleton class="mb-3 h-4 w-32 opacity-30" />
						<div class="mb-4 space-y-2">
							<Skeleton class="h-3 w-full opacity-20" />
							<Skeleton class="h-3 w-3/4 opacity-20" />
						</div>

						<!-- Details grid -->
						<div class="space-y-1">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each Array(4) as _}
								<Skeleton class="h-3 w-40 opacity-20" />
							{/each}
						</div>
					</div>

					<!-- Right side - price and chart area -->
					<div class="ml-4 flex flex-col items-end">
						<Skeleton class="mb-2 h-5 w-16 opacity-50" />
						<Skeleton class="h-20 w-20 opacity-20" />
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
