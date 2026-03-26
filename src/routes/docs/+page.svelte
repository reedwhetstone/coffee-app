<script lang="ts">
	import { DOCS_NAV } from '$lib/docs/content';
</script>

<svelte:head>
	<title>Documentation | Purveyors</title>
	<meta
		name="description"
		content="Unified Purveyors documentation for the API platform, CLI, analytics, and agent integration workflows."
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
			Unified documentation for the platform, API, and CLI
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary-light sm:text-lg">
			This docs tree replaces the old split between marketing copy, dashboard-only API pages, and
			stale monoliths. Start with the API docs if you are integrating over HTTP, or the CLI docs if
			you want terminal and agent workflows.
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
				Public positioning, plans, and a clean handoff into the docs.
			</p>
		</a>
		<a
			href="/api-dashboard"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">API dashboard</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Generate keys, inspect usage, and connect docs to account state.
			</p>
		</a>
		<a
			href="/catalog"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">Public catalog</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				See the public marketplace surface that shares domain data with the API and CLI.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<div class="text-sm font-semibold text-text-primary-light">Analytics</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Explore the live market intelligence product and its gating model.
			</p>
		</a>
	</section>
</div>
