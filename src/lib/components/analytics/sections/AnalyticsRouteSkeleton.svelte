<script lang="ts">
	let {
		isParchmentIntelligence,
		isSignedIn,
		showSummary = true
	} = $props<{
		isParchmentIntelligence: boolean;
		isSignedIn: boolean;
		showSummary?: boolean;
	}>();

	let navItems = $derived(
		isSignedIn
			? ['Read', 'Signals', 'Market Index', 'Disclosure Index']
			: ['Read', 'Signals', 'Market Index']
	);
</script>

<section aria-busy="true" aria-label="Loading Market Index" class="space-y-6">
	{#if showSummary}
		<section class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
			<div class="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div class="min-w-0 flex-1">
					<div class="h-3 w-24 animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-3 h-7 w-full max-w-xl animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-2 h-4 w-2/3 max-w-lg animate-pulse rounded bg-surface-canvas"></div>
				</div>
				<div class="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
					<div class="h-10 animate-pulse rounded-md bg-surface-canvas"></div>
					<div class="h-10 animate-pulse rounded-md bg-surface-canvas"></div>
					<div class="h-10 animate-pulse rounded-md bg-surface-canvas"></div>
				</div>
			</div>
			<div class="grid gap-3 md:grid-cols-3">
				{#each Array.from({ length: 3 }) as _}
					<div class="rounded-md border border-line bg-surface-canvas p-4">
						<div class="h-3 w-24 animate-pulse rounded bg-surface-panel"></div>
						<div class="mt-3 h-8 w-20 animate-pulse rounded bg-surface-panel"></div>
						<div class="mt-3 h-3 w-full animate-pulse rounded bg-surface-panel"></div>
					</div>
				{/each}
			</div>
		</section>

		<nav class="hidden overflow-x-auto border-y border-line bg-surface-canvas/95 py-2 md:block">
			<div class="flex min-w-max items-center gap-2">
				{#each navItems as item}
					<div class="h-8 w-24 animate-pulse rounded-full bg-surface-panel" aria-label={item}></div>
				{/each}
			</div>
		</nav>
	{/if}

	<section class="rounded-lg border border-accent/20 bg-surface-panel p-5 shadow-sm">
		<div class="flex items-start gap-3">
			<span class="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-accent"></span>
			<div class="flex-1">
				<div class="h-4 w-40 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-surface-canvas"></div>
			</div>
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
		{#each Array.from({ length: 4 }) as _}
			<div class="rounded-lg border border-line bg-surface-panel p-4 shadow-sm">
				<div class="h-3 w-28 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-4 h-8 w-20 animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-4 h-3 w-full animate-pulse rounded bg-surface-canvas"></div>
				<div class="mt-2 h-3 w-3/4 animate-pulse rounded bg-surface-canvas"></div>
			</div>
		{/each}
	</section>

	<section class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
		<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
			<div class="h-5 w-36 animate-pulse rounded bg-surface-canvas"></div>
			<div class="mt-4 h-72 animate-pulse rounded-md bg-surface-canvas"></div>
		</div>
		<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
			<div class="h-5 w-40 animate-pulse rounded bg-surface-canvas"></div>
			<div class="mt-4 space-y-3">
				{#each Array.from({ length: 5 }) as _}
					<div class="h-10 animate-pulse rounded bg-surface-canvas"></div>
				{/each}
			</div>
		</div>
	</section>

	{#if isParchmentIntelligence}
		<section class="grid gap-5 lg:grid-cols-2">
			{#each Array.from({ length: 2 }) as _}
				<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
					<div class="h-5 w-44 animate-pulse rounded bg-surface-canvas"></div>
					<div class="mt-4 h-56 animate-pulse rounded-md bg-surface-canvas"></div>
				</div>
			{/each}
		</section>
	{/if}
</section>
