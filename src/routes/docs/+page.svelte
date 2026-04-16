<script lang="ts">
	import { DOCS_NAV } from '$lib/docs/content';
</script>

<svelte:head>
	<title>Purveyors docs | Parchment API and CLI</title>
	<meta
		name="description"
		content="Unified public documentation for the Parchment API, Parchment Console, and @purveyors/cli. Start with /v1/catalog, then explore platform and automation workflows."
	/>
</svelte:head>

<div class="space-y-8">
	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
	>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
			Purveyors docs
		</p>
		<h1 class="mt-3 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
			Documentation
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary-light sm:text-lg">
			Unified documentation for the stable public catalog endpoint at <code
				class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/v1/catalog</code
			>, the broader platform route layer under
			<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/api/*</code>, the
			Parchment Console, and the CLI. Start with API docs for HTTP integrations, then use the
			platform and CLI docs for product internals, automation workflows, and agent-friendly tooling.
		</p>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		{#each DOCS_NAV as section}
			<div
				class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 class="text-2xl font-semibold text-text-primary-light">{section.title}</h2>
						<p class="mt-3 text-sm leading-relaxed text-text-secondary-light sm:text-base">
							{section.description}
						</p>
					</div>
					<a
						href={`${section.basePath}/${section.items[0]?.slug}`}
						class="shrink-0 rounded-xl bg-background-tertiary-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
					>
						Open
					</a>
				</div>

				<ul class="mt-6 space-y-3">
					{#each section.items as item}
						<li>
							<a
								href={`${section.basePath}/${item.slug}`}
								class="block rounded-2xl border border-border-light bg-background-secondary-light px-4 py-4 transition-colors hover:border-background-tertiary-light/40 hover:bg-background-primary-light"
							>
								<div class="text-sm font-semibold text-text-primary-light">{item.title}</div>
								<p class="mt-1 text-sm leading-relaxed text-text-secondary-light">
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
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">API product page</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Plans, pricing, quick start, and the public-versus-platform contract split.
			</p>
		</a>
		<a
			href="/api-dashboard"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">Parchment Console</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Generate API keys, monitor usage, and manage your account.
			</p>
		</a>
		<a
			href="/catalog"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">Public catalog</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Browse the green coffee marketplace that the API serves.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">Analytics</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Market intelligence: pricing trends, supplier coverage, and origin analysis.
			</p>
		</a>
	</section>
</div>
