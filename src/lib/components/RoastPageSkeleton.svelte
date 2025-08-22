<script lang="ts">
	// No props needed - pure skeleton structure
</script>

<div class="animate-pulse">
	<!-- Header Section -->
	<div class="mb-6">
		<div class="mb-2 h-8 w-56 rounded bg-background-tertiary-light opacity-50"></div>
		<div class="h-4 w-80 rounded bg-background-tertiary-light opacity-30"></div>
	</div>

	<!-- Quick Actions -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div class="h-4 w-40 rounded bg-background-tertiary-light opacity-30"></div>
		<div class="flex gap-2">
			<div class="h-9 w-32 rounded bg-background-tertiary-light opacity-30"></div>
			<div class="h-9 w-28 rounded bg-background-tertiary-light opacity-30"></div>
		</div>
	</div>

	<!-- Main roasting interface -->
	<div class="mb-6 rounded-lg bg-background-secondary-light p-4">
		<div class="mb-4 h-6 w-40 rounded bg-background-tertiary-light opacity-50"></div>
		<!-- Chart skeleton -->
		<div class="relative h-96 w-full rounded bg-background-tertiary-light opacity-20">
			<!-- Y-axis labels -->
			<div class="absolute left-0 top-0 flex h-full flex-col justify-between p-4">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(6) as _}
					<div class="h-3 w-8 rounded bg-background-tertiary-light opacity-40"></div>
				{/each}
			</div>

			<!-- Chart content area -->
			<div class="ml-12 h-full p-4">
				<!-- Simulated chart lines -->
				<div class="relative h-full w-full">
					<div class="absolute inset-0">
						<div
							class="absolute h-0.5 w-full bg-background-tertiary-light opacity-40"
							style="top: 20%"
						></div>
						<div
							class="absolute h-0.5 w-full bg-background-tertiary-light opacity-40"
							style="top: 40%"
						></div>
						<div
							class="absolute h-0.5 w-full bg-background-tertiary-light opacity-40"
							style="top: 60%"
						></div>
						<div
							class="absolute h-0.5 w-full bg-background-tertiary-light opacity-40"
							style="top: 80%"
						></div>
					</div>
				</div>
			</div>

			<!-- X-axis labels -->
			<div class="absolute bottom-0 left-12 right-4 flex justify-between p-2">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(8) as _}
					<div class="h-3 w-6 rounded bg-background-tertiary-light opacity-40"></div>
				{/each}
			</div>
		</div>

		<!-- Controls skeleton -->
		<div class="mt-4 flex justify-center gap-4">
			<div class="h-10 w-20 rounded bg-background-tertiary-light opacity-30"></div>
			<div class="h-10 w-20 rounded bg-background-tertiary-light opacity-30"></div>
			<div class="h-10 w-24 rounded bg-background-tertiary-light opacity-30"></div>
		</div>
	</div>

	<!-- Roast History Table -->
	<div class="rounded-lg bg-background-secondary-light p-4">
		<div class="mb-4 h-6 w-32 rounded bg-background-tertiary-light opacity-50"></div>

		<!-- Table header -->
		<div class="mb-2 grid grid-cols-6 gap-4 border-b border-border-light pb-2">
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each Array(6) as _}
				<div class="h-4 w-16 rounded bg-background-tertiary-light opacity-30"></div>
			{/each}
		</div>

		<!-- Table rows -->
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(8) as _}
			<div class="grid grid-cols-6 gap-4 border-b border-border-light py-2">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each Array(6) as _}
					<div class="h-4 w-12 rounded bg-background-tertiary-light opacity-20"></div>
				{/each}
			</div>
		{/each}
	</div>
</div>
