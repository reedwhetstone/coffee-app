<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	// No props needed - pure skeleton structure
</script>

<div class="motion-safe:animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<Skeleton class="mb-2 h-8 w-64 opacity-50" />
		<Skeleton class="h-4 w-96 opacity-30" />
	</div>

	<!-- Search and filters -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<Skeleton class="h-10 w-64 opacity-30" />
		<div class="flex gap-2">
			<Skeleton class="h-10 w-24 opacity-30" />
			<Skeleton class="h-10 w-32 opacity-30" />
		</div>
	</div>

	<!-- Load more button area -->
	<div class="mb-6 text-center">
		<Skeleton class="mx-auto h-4 w-48 opacity-30" />
	</div>

	<!-- Coffee Cards Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(12) as _}
			<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
				<div class="flex items-start justify-between">
					<!-- Left side content -->
					<div class="flex-1">
						<Skeleton class="mb-2 h-6 w-48 opacity-50" />
						<Skeleton class="mb-3 h-4 w-32 opacity-30" />

						<!-- Description area -->
						<div class="mb-4 space-y-2">
							<Skeleton class="h-3 w-full opacity-20" />
							<Skeleton class="h-3 w-5/6 opacity-20" />
							<Skeleton class="h-3 w-4/6 opacity-20" />
						</div>

						<!-- Mobile chart area -->
						<div class="mb-4 sm:hidden">
							<Skeleton class="h-32 w-full opacity-20" />
						</div>

						<!-- Details grid -->
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each Array(6) as _}
								<Skeleton class="h-3 w-24 opacity-20" />
							{/each}
						</div>
					</div>

					<!-- Right side - price and chart (desktop) -->
					<div class="ml-4 hidden flex-col items-end sm:flex">
						<Skeleton class="mb-2 h-6 w-20 opacity-50" />
						<Skeleton class="h-32 w-32 opacity-20" />
					</div>
				</div>

				<!-- Action button area -->
				<div class="mt-3 flex items-center justify-end">
					<Skeleton class="h-4 w-4 opacity-30" />
				</div>
			</div>
		{/each}
	</div>

	<!-- Load More Button -->
	<div class="mt-8 text-center">
		<Skeleton class="mx-auto h-10 w-32 opacity-30" />
	</div>
</div>
