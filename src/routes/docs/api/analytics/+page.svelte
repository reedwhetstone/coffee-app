<svelte:head>
	<title>Analytics - Purveyors Docs</title>
	<meta name="description" content="Analytics endpoints for the Parchment API." />
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/api/overview" class="hover:text-text-primary-light">REST API</a>
			<span>/</span>
			<span>Analytics</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Analytics</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Market-level analytics and pricing intelligence for green coffee.
		</p>
	</header>

	<div class="rounded-xl border border-border-light bg-background-secondary-light p-6">
		<div class="flex items-start gap-4">
			<div class="flex-shrink-0 rounded-full bg-yellow-100 p-2 text-yellow-700">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<div>
				<h2 class="font-semibold text-text-primary-light">External analytics API coming soon</h2>
				<p class="mt-2 text-sm text-text-secondary-light">
					Market analytics data (price trends, origin distribution, inventory flow) is currently
					surfaced in the <a
						href="/analytics"
						class="text-background-tertiary-light hover:underline">/analytics</a
					>
					web page for authenticated members. A versioned external endpoint is planned for a future release.
				</p>
				<p class="mt-2 text-sm text-text-secondary-light">
					For now, the catalog endpoint at
					<a href="/docs/api/catalog" class="text-background-tertiary-light hover:underline"
						>/v1/catalog</a
					>
					provides the underlying data you can use to build your own analytics.
				</p>
			</div>
		</div>
	</div>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">What's Available Today</h2>
		<p class="mt-3 text-text-secondary-light">
			The catalog response includes fields that support market analysis without a dedicated
			analytics endpoint:
		</p>
		<ul class="mt-3 space-y-2 text-sm text-text-secondary-light">
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">cost_lb</code> and
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">price_tiers</code>
				for pricing trends across origins and suppliers.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">stocked</code> and
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">stocked_date</code>
				for availability tracking.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">arrival_date</code>
				for lot freshness and seasonal patterns.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">score_value</code>
				for quality distribution by origin or supplier.
			</li>
		</ul>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/catalog" class="text-background-tertiary-light hover:underline"
				>← Catalog API</a
			>
			<a href="/docs/api/roast-profiles" class="text-background-tertiary-light hover:underline"
				>Roast Profiles →</a
			>
		</div>
	</div>
</article>
