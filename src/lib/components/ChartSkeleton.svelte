<script lang="ts">
	let { height = '400px', title = 'Loading chart...' } = $props<{
		height?: string;
		title?: string;
	}>();
</script>

<div class="animate-pulse rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light" style="height: {height}">
	<div class="mb-4 h-6 w-1/3 rounded bg-background-tertiary-light opacity-50"></div>
	
	<!-- Chart area skeleton -->
	<div class="relative h-full">
		<!-- Y-axis labels -->
		<div class="absolute left-0 top-0 flex h-full flex-col justify-between">
			{#each Array(5) as _}
				<div class="h-4 w-8 rounded bg-background-tertiary-light opacity-30"></div>
			{/each}
		</div>
		
		<!-- Chart content -->
		<div class="ml-12 h-full">
			<!-- Chart lines -->
			<div class="relative h-full w-full rounded bg-background-tertiary-light opacity-20">
				<!-- Simulated chart lines -->
				<div class="absolute inset-4">
					<div class="h-0.5 w-full bg-background-tertiary-light opacity-40" style="top: 25%"></div>
					<div class="h-0.5 w-full bg-background-tertiary-light opacity-40" style="top: 50%"></div>
					<div class="h-0.5 w-full bg-background-tertiary-light opacity-40" style="top: 75%"></div>
				</div>
			</div>
			
			<!-- X-axis labels -->
			<div class="mt-2 flex justify-between">
				{#each Array(6) as _}
					<div class="h-4 w-8 rounded bg-background-tertiary-light opacity-30"></div>
				{/each}
			</div>
		</div>
	</div>
	
	<!-- Loading text -->
	<div class="mt-4 text-center text-sm text-text-secondary-light">
		{title}
	</div>
</div>