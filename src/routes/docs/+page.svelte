<script lang="ts">
	import { DOCS_NAV } from '$lib/docs/content';
</script>

<svelte:head>
	<title>Purveyors docs | Parchment API and CLI</title>
	<meta
		name="description"
		content="Unified public documentation for the Parchment API, Parchment Console, and @purveyors/cli. Start with /v1/catalog, then explore internal routes and automation workflows."
	/>
</svelte:head>

<div class="space-y-8">
	<section class="rounded-2xl border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
		<p class="text-xs font-semibold text-accent">Purveyors docs</p>
		<h1 class="mt-3 font-serif text-3xl font-medium tracking-tight text-ink sm:text-4xl">
			Documentation
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
			Unified documentation for the stable public catalog endpoint at <code
				class="rounded bg-surface-panel px-1.5 py-0.5 text-sm">/v1/catalog</code
			>, the broader internal route layer under
			<code class="rounded bg-surface-panel px-1.5 py-0.5 text-sm">/api/*</code>, the Parchment
			Console, and the CLI. Start with API docs for HTTP integrations, then use the app and CLI docs
			for product internals, automation workflows, and agent-friendly tooling.
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
					<a
						href={`${section.basePath}/${section.items[0]?.slug}`}
						class="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
					>
						Open
					</a>
				</div>

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
			</div>
		{/each}
	</section>

	<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<a
			href="/api"
			class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<div class="text-sm font-semibold text-ink">API product page</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Plans, pricing, quick start, and the public-versus-internal contract split.
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
