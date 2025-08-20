<script lang="ts">
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<div class="mb-2 h-8 w-64 rounded bg-background-tertiary-light opacity-50"></div>
		<div class="h-4 w-96 rounded bg-background-tertiary-light opacity-30"></div>
	</div>

	<!-- Search and filters -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div class="h-10 w-64 rounded bg-background-tertiary-light opacity-30"></div>
		<div class="flex gap-2">
			<div class="h-10 w-24 rounded bg-background-tertiary-light opacity-30"></div>
			<div class="h-10 w-32 rounded bg-background-tertiary-light opacity-30"></div>
		</div>
	</div>

	<!-- Load more button area -->
	<div class="mb-6 text-center">
		<div class="mx-auto h-4 w-48 rounded bg-background-tertiary-light opacity-30"></div>
	</div>

	<!-- Coffee Cards Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each Array(12) as _}
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<div class="flex items-start justify-between">
					<!-- Left side content -->
					<div class="flex-1">
						<div class="mb-2 h-6 w-48 rounded bg-background-tertiary-light opacity-50"></div>
						<div class="mb-3 h-4 w-32 rounded bg-background-tertiary-light opacity-30"></div>
						
						<!-- Description area -->
						<div class="mb-4 space-y-2">
							<div class="h-3 w-full rounded bg-background-tertiary-light opacity-20"></div>
							<div class="h-3 w-5/6 rounded bg-background-tertiary-light opacity-20"></div>
							<div class="h-3 w-4/6 rounded bg-background-tertiary-light opacity-20"></div>
						</div>
						
						<!-- Mobile chart area -->
						<div class="mb-4 sm:hidden">
							<div class="h-32 w-full rounded bg-background-tertiary-light opacity-20"></div>
						</div>
						
						<!-- Details grid -->
						<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
							{#each Array(6) as _}
								<div class="h-3 w-24 rounded bg-background-tertiary-light opacity-20"></div>
							{/each}
						</div>
					</div>
					
					<!-- Right side - price and chart (desktop) -->
					<div class="ml-4 hidden flex-col items-end sm:flex">
						<div class="mb-2 h-6 w-20 rounded bg-background-tertiary-light opacity-50"></div>
						<div class="h-32 w-32 rounded bg-background-tertiary-light opacity-20"></div>
					</div>
				</div>
				
				<!-- Action button area -->
				<div class="mt-3 flex items-center justify-end">
					<div class="h-4 w-4 rounded bg-background-tertiary-light opacity-30"></div>
				</div>
			</div>
		{/each}
	</div>
	
	<!-- Load More Button -->
	<div class="mt-8 text-center">
		<div class="mx-auto h-10 w-32 rounded bg-background-tertiary-light opacity-30"></div>
	</div>
</div>