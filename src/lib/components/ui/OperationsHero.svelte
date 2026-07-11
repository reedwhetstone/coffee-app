<script lang="ts">
	let {
		kicker,
		title,
		description,
		contextLabel = '',
		contextValue = '',
		primaryLabel = '',
		primaryHref = '',
		secondaryLabel = '',
		secondaryHref = ''
	} = $props<{
		kicker: string;
		title: string;
		description: string;
		contextLabel?: string;
		contextValue?: string;
		primaryLabel?: string;
		primaryHref?: string;
		secondaryLabel?: string;
		secondaryHref?: string;
	}>();
</script>

<section class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm sm:p-6">
	<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
		<div class="max-w-3xl">
			<p class="text-xs font-semibold uppercase tracking-wide text-organic-rust">{kicker}</p>
			<h1 class="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
				{title}
			</h1>
			<p class="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
				{description}
			</p>
		</div>

		{#if contextLabel || primaryLabel || secondaryLabel}
			<div
				class="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end"
			>
				{#if contextLabel}
					<div class="rounded-lg border border-line bg-surface-canvas/80 px-4 py-3 shadow-sm">
						<p class="text-xs font-medium text-muted">{contextLabel}</p>
						<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
							{contextValue}
						</p>
					</div>
				{/if}
				<div class="flex flex-wrap gap-2">
					{#if primaryLabel && primaryHref}
						<a
							href={primaryHref}
							class="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85"
						>
							{primaryLabel}
						</a>
					{/if}
					{#if secondaryLabel && secondaryHref}
						<a
							href={secondaryHref}
							class="inline-flex items-center justify-center rounded-md border border-line bg-surface-canvas px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
						>
							{secondaryLabel}
						</a>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</section>
