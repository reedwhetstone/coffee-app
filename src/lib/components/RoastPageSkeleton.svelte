<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	// No props needed - pure skeleton structure
</script>

<div class="motion-safe:animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<Skeleton class="mb-2 h-8 w-56 opacity-50" />
		<Skeleton class="h-4 w-80 opacity-30" />
	</div>

	<!-- Quick Actions -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<Skeleton class="h-4 w-40 opacity-30" />
		<div class="flex gap-2">
			<Skeleton class="h-9 w-32 opacity-30" />
			<Skeleton class="h-9 w-28 opacity-30" />
		</div>
	</div>

	<!-- Main roasting interface -->
	<div class="mb-6 rounded-lg bg-surface-panel p-4">
		<Skeleton class="mb-4 h-6 w-40 opacity-50" />
		<!-- Chart skeleton -->
		<div class="relative h-96 w-full rounded bg-accent opacity-20">
			<!-- Y-axis labels -->
			<div class="absolute left-0 top-0 flex h-full flex-col justify-between p-4">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(6) as _}
					<Skeleton class="h-3 w-8 opacity-40" />
				{/each}
			</div>

			<!-- Chart content area -->
			<div class="ml-12 h-full p-4">
				<!-- Simulated chart lines -->
				<div class="relative h-full w-full">
					<div class="absolute inset-0">
						<div class="absolute h-0.5 w-full bg-accent opacity-40" style="top: 20%"></div>
						<div class="absolute h-0.5 w-full bg-accent opacity-40" style="top: 40%"></div>
						<div class="absolute h-0.5 w-full bg-accent opacity-40" style="top: 60%"></div>
						<div class="absolute h-0.5 w-full bg-accent opacity-40" style="top: 80%"></div>
					</div>
				</div>
			</div>

			<!-- X-axis labels -->
			<div class="absolute bottom-0 left-12 right-4 flex justify-between p-2">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(8) as _}
					<Skeleton class="h-3 w-6 opacity-40" />
				{/each}
			</div>
		</div>

		<!-- Controls skeleton -->
		<div class="mt-4 flex justify-center gap-4">
			<Skeleton class="h-10 w-20 opacity-30" />
			<Skeleton class="h-10 w-20 opacity-30" />
			<Skeleton class="h-10 w-24 opacity-30" />
		</div>
	</div>

	<!-- Roast History Table -->
	<div class="rounded-lg bg-surface-panel p-4">
		<Skeleton class="mb-4 h-6 w-32 opacity-50" />

		<!-- Table header -->
		<div class="mb-2 grid grid-cols-6 gap-4 border-b border-line pb-2">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array(6) as _}
				<Skeleton class="h-4 w-16 opacity-30" />
			{/each}
		</div>

		<!-- Table rows -->
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(8) as _}
			<div class="grid grid-cols-6 gap-4 border-b border-line py-2">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(6) as _}
					<Skeleton class="h-4 w-12 opacity-20" />
				{/each}
			</div>
		{/each}
	</div>
</div>
