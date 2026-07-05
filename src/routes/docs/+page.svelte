<script lang="ts">
	import { DOCS_NAV } from '$lib/docs/content';
</script>

<svelte:head>
	<title>Purveyors docs | Parchment API and CLI</title>
	<meta
		name="description"
		content="Purveyors documentation for product context and CLI workflows. Generated Parchment API docs live at api.purveyors.io/docs."
	/>
</svelte:head>

<div class="space-y-8">
	<section class="rounded-2xl border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
		<p class="text-xs font-semibold text-accent">Purveyors docs</p>
		<h1 class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
			Documentation
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
			Product context, catalog methodology, and CLI workflows live here. The API contract is now
			generated from Parchment OpenAPI and served from
			<a href="https://api.purveyors.io/docs" class="text-accent hover:underline"
				>api.purveyors.io/docs</a
			>, so the reference stays tied to the deployed API.
		</p>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		{#each DOCS_NAV as section}
			<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 class="text-2xl font-semibold text-ink">{section.title}</h2>
						<p class="mt-3 text-sm leading-relaxed text-muted sm:text-base">
							{section.description}
						</p>
					</div>
					{#if section.key === 'api'}
						<a
							href="https://api.purveyors.io/docs"
							class="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
						>
							Open
						</a>
					{:else}
						<a
							href={`${section.basePath}/${section.items[0]?.slug}`}
							class="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
						>
							Open
						</a>
					{/if}
				</div>

				{#if section.key === 'api'}
					<a
						href="https://api.purveyors.io/docs"
						class="mt-6 block rounded-2xl border border-line bg-surface-panel px-4 py-4 transition-colors hover:border-accent/40 hover:bg-surface-canvas"
					>
						<div class="text-sm font-semibold text-ink">Generated OpenAPI reference</div>
						<p class="mt-1 text-sm leading-relaxed text-muted">
							Live Scalar docs generated from the deployed Parchment API contract.
						</p>
					</a>
				{:else}
					<ul class="mt-6 space-y-3">
						{#each section.items as item}
							<li>
								<a
									href={`${section.basePath}/${item.slug}`}
									class="block rounded-2xl border border-line bg-surface-panel px-4 py-4 transition-colors hover:border-accent/40 hover:bg-surface-canvas"
								>
									<div class="text-sm font-semibold text-ink">{item.title}</div>
									<p class="mt-1 text-sm leading-relaxed text-muted">
										{item.summary}
									</p>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>

	<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<a
			href="https://api.purveyors.io/docs"
			class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<div class="text-sm font-semibold text-ink">Generated API docs</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Live OpenAPI reference served by Parchment.
			</p>
		</a>
		<a
			href="/api-dashboard"
			class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<div class="text-sm font-semibold text-ink">Parchment Console</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Generate API keys, monitor usage, and manage your account.
			</p>
		</a>
		<a
			href="/catalog"
			class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<div class="text-sm font-semibold text-ink">Public catalog</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Browse the green coffee marketplace that the API serves.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<div class="text-sm font-semibold text-ink">Market Index</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Market intelligence: pricing trends, supplier coverage, and origin analysis.
			</p>
		</a>
	</section>
</div>
