<script lang="ts">
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<div class="mb-2 h-8 w-48 rounded bg-background-tertiary-light opacity-50"></div>
		<div class="h-4 w-80 rounded bg-background-tertiary-light opacity-30"></div>
	</div>

	<!-- KPI Cards -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each Array(4) as _}
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<div class="mb-2 h-4 w-24 rounded bg-background-tertiary-light opacity-30"></div>
				<div class="mb-1 h-8 w-20 rounded bg-background-tertiary-light opacity-50"></div>
				<div class="h-3 w-32 rounded bg-background-tertiary-light opacity-30"></div>
			</div>
		{/each}
	</div>

	<!-- Chart Section -->
	<div class="mb-6 rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
		<div class="mb-4 h-6 w-32 rounded bg-background-tertiary-light opacity-50"></div>
		
		<!-- Chart area -->
		<div class="relative h-64 w-full rounded bg-background-tertiary-light opacity-20">
			<!-- Chart bars -->
			<div class="absolute inset-4 flex items-end justify-between">
				{#each Array(12) as _, i}
					<div 
						class="w-4 rounded-t bg-background-tertiary-light opacity-40"
						style="height: {Math.random() * 80 + 20}%"
					></div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Sales Table -->
	<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
		<div class="mb-4 flex items-center justify-between">
			<div class="h-6 w-24 rounded bg-background-tertiary-light opacity-50"></div>
			<div class="h-9 w-28 rounded bg-background-tertiary-light opacity-30"></div>
		</div>
		
		<!-- Table header -->
		<div class="mb-2 grid grid-cols-5 gap-4 border-b border-border-light pb-2">
			{#each Array(5) as _}
				<div class="h-4 w-16 rounded bg-background-tertiary-light opacity-30"></div>
			{/each}
		</div>
		
		<!-- Table rows -->
		{#each Array(8) as _}
			<div class="grid grid-cols-5 gap-4 border-b border-border-light py-2">
				{#each Array(5) as _}
					<div class="h-4 w-12 rounded bg-background-tertiary-light opacity-20"></div>
				{/each}
			</div>
		{/each}
	</div>
</div>