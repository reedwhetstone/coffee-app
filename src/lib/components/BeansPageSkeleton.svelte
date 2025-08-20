<script lang="ts">
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<div class="mb-2 h-8 w-48 rounded bg-background-tertiary-light opacity-50"></div>
		<div class="h-4 w-96 rounded bg-background-tertiary-light opacity-30"></div>
	</div>

	<!-- Dashboard Cards Section -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
		{#each Array(5) as _}
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<div class="mb-2 h-4 w-20 rounded bg-background-tertiary-light opacity-30"></div>
				<div class="mb-1 h-6 w-16 rounded bg-background-tertiary-light opacity-50"></div>
				<div class="h-3 w-24 rounded bg-background-tertiary-light opacity-30"></div>
			</div>
		{/each}
	</div>

	<!-- Quick Actions -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div class="h-4 w-32 rounded bg-background-tertiary-light opacity-30"></div>
		<div class="flex gap-2">
			<div class="h-9 w-24 rounded bg-background-tertiary-light opacity-30"></div>
			<div class="h-9 w-32 rounded bg-background-tertiary-light opacity-30"></div>
		</div>
	</div>

	<!-- Coffee Cards Grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each Array(9) as _}
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<div class="flex items-start justify-between">
					<!-- Left side content -->
					<div class="flex-1">
						<div class="mb-2 h-5 w-48 rounded bg-background-tertiary-light opacity-50"></div>
						<div class="mb-3 h-4 w-32 rounded bg-background-tertiary-light opacity-30"></div>
						<div class="mb-4 space-y-2">
							<div class="h-3 w-full rounded bg-background-tertiary-light opacity-20"></div>
							<div class="h-3 w-3/4 rounded bg-background-tertiary-light opacity-20"></div>
						</div>
						
						<!-- Details grid -->
						<div class="space-y-1">
							{#each Array(4) as _}
								<div class="h-3 w-40 rounded bg-background-tertiary-light opacity-20"></div>
							{/each}
						</div>
					</div>
					
					<!-- Right side - price and chart area -->
					<div class="ml-4 flex flex-col items-end">
						<div class="mb-2 h-5 w-16 rounded bg-background-tertiary-light opacity-50"></div>
						<div class="h-20 w-20 rounded bg-background-tertiary-light opacity-20"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>