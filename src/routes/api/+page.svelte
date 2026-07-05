<script lang="ts">
	import { goto } from '$app/navigation';
	import { MAX_CATALOG_PAGE_LIMIT_DISPLAY } from '$lib/constants/catalog';

	const maxCatalogRowsPerRequest = `Up to ${MAX_CATALOG_PAGE_LIMIT_DISPLAY} per request`;

	function openDocs() {
		goto('/docs/api/overview');
	}

	function openDashboard() {
		goto('/api-dashboard');
	}
</script>

<svelte:head>
	<title>Parchment API</title>
	<meta
		name="description"
		content="Stable /v1/catalog access for green coffee market data, with unified docs, the Parchment Console, and clear separation between the public contract and internal app routes."
	/>
</svelte:head>

<div class="space-y-8">
	<section class="rounded-2xl border border-line bg-surface-canvas p-6 shadow-sm sm:p-8 lg:p-10">
		<div class="max-w-4xl">
			<p class="text-xs font-semibold text-accent">Parchment API</p>
			<h1 class="mt-3 font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl">
				Stable green coffee data for sourcing tools, apps, and agents.
			</h1>
			<p class="mt-5 text-lg leading-relaxed text-muted">
				GET /v1/catalog is the stable public contract for normalized pricing, availability, and
				supplier coverage. Browse anonymously to evaluate the feed, then move to API keys in the
				Parchment Console for production usage.
			</p>
		</div>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			<button
				onclick={openDashboard}
				class="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition-opacity hover:bg-opacity-90"
			>
				Get API access
			</button>
			<button
				onclick={openDocs}
				class="rounded-xl border border-accent px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-ink"
			>
				View docs
			</button>
			<a
				href="/catalog"
				class="rounded-xl border border-line px-5 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-surface-panel"
			>
				Explore the catalog
			</a>
		</div>

		<p class="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
			Start with <code class="rounded bg-surface-panel px-1.5 py-0.5 text-xs text-ink"
				>GET /v1/catalog</code
			>
			for the public contract. Treat
			<code class="rounded bg-surface-panel px-1.5 py-0.5 text-xs text-ink">/api/*</code>
			as the internal app layer that powers the web app and Console. Use
			<a href="/docs" class="text-accent hover:underline">/docs</a>
			as the canonical docs entry and
			<a href="/api-dashboard" class="text-accent hover:underline">/api-dashboard</a> for keys, usage,
			and billing.
		</p>
	</section>

	<section class="grid gap-4 lg:grid-cols-4">
		<div class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm">
			<div class="text-3xl font-bold text-accent">40+</div>
			<div class="mt-2 text-sm font-semibold text-ink">US importers</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Every major specialty importer in one normalized schema. Wholesale and retail segmented.
			</p>
		</div>
		<div class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm">
			<div class="text-3xl font-bold text-accent">Daily</div>
			<div class="mt-2 text-sm font-semibold text-ink">Normalized updates</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Arrivals, delistings, and price changes reflected same-day. 90+ days of price history.
			</p>
		</div>
		<div class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm">
			<div class="text-3xl font-bold text-accent">One</div>
			<div class="mt-2 text-sm font-semibold text-ink">Consistent schema</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Origin, process, grade, price, and availability mapped consistently across every supplier.
			</p>
		</div>
		<div class="rounded-2xl border border-line bg-surface-canvas p-5 shadow-sm">
			<div class="text-3xl font-bold text-accent">3</div>
			<div class="mt-2 text-sm font-semibold text-ink">Access tiers</div>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Free evaluation, self-serve production, and enterprise. No scraping infrastructure required.
			</p>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
			<h2 class="text-2xl font-semibold text-ink">What you can build</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-ink sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span>Sync your internal sourcing dashboard with live offer lists from 40+ importers</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span>Flag lots priced below the origin median for immediate buyer review</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Feed agent and procurement workflows with normalized supplier schemas and arrival data</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Surface supplier coverage gaps and new arrivals in customer-facing sourcing tools</span
					>
				</li>
			</ul>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
			<h2 class="text-2xl font-semibold text-ink">Built for</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-ink sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Green coffee buyers who need market-wide pricing and arrival data before placing orders</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Roastery software teams shipping sourcing and procurement features without building
						scrapers</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Procurement analysts benchmarking bids against origin-level price distributions</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent"></span>
					<span
						>Developers embedding live offer lists, arrival feeds, and supplier comparisons into
						internal tools</span
					>
				</li>
			</ul>
		</div>
	</section>

	<section class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm sm:p-8">
		<h2 class="text-2xl font-semibold text-ink">Plans</h2>
		<div class="mt-5 overflow-x-auto rounded-2xl border border-line">
			<table class="min-w-full divide-y divide-line text-sm">
				<thead class="bg-surface-panel text-left text-ink">
					<tr>
						<th class="px-4 py-3 font-semibold">Plan</th>
						<th class="px-4 py-3 font-semibold">Monthly requests</th>
						<th class="px-4 py-3 font-semibold">Rows per call</th>
						<th class="px-4 py-3 font-semibold">Best for</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line bg-surface-canvas text-muted">
					<tr>
						<td class="px-4 py-3 align-top font-medium text-ink">Green</td>
						<td class="px-4 py-3 align-top">200</td>
						<td class="px-4 py-3 align-top">25</td>
						<td class="px-4 py-3 align-top"
							>Evaluate the feed, prototype integrations, validate schema fit</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-ink">Origin</td>
						<td class="px-4 py-3 align-top">10,000</td>
						<td class="px-4 py-3 align-top">{maxCatalogRowsPerRequest}</td>
						<td class="px-4 py-3 align-top"
							>Production sourcing tools, daily sync jobs, and live customer-facing features</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-ink">Enterprise</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">{maxCatalogRowsPerRequest}</td>
						<td class="px-4 py-3 align-top"
							>High-volume deployments, custom data agreements, and dedicated support</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-muted">
			Green gets you into the feed immediately at no cost. Origin is the self-serve tier for
			production integrations with up to {MAX_CATALOG_PAGE_LIMIT_DISPLAY} rows per request and 10,000
			monthly requests. Enterprise keeps the same per-request ceiling while covering unlimited request
			volume, custom data terms, and dedicated support. Manage keys and monitor usage in the
			<a href="/api-dashboard" class="text-accent hover:underline">Parchment Console</a>.
		</p>
	</section>

	<section class="grid gap-6 xl:grid-cols-4">
		<a
			href="/docs/api/overview"
			class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<h2 class="text-xl font-semibold text-ink">API docs</h2>
			<p class="mt-3 text-sm leading-relaxed text-muted">
				Stable /v1/catalog contract, auth modes, limits, migration notes, and production examples.
			</p>
		</a>
		<a
			href="/api-dashboard"
			class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<h2 class="text-xl font-semibold text-ink">Parchment Console</h2>
			<p class="mt-3 text-sm leading-relaxed text-muted">
				Create and deactivate keys, review usage, and manage billing in one place.
			</p>
		</a>
		<a
			href="/catalog"
			class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<h2 class="text-xl font-semibold text-ink">Live catalog</h2>
			<p class="mt-3 text-sm leading-relaxed text-muted">
				See the buyer-facing catalog experience powered by the same core dataset.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-lg border border-line bg-surface-canvas p-6 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-panel"
		>
			<h2 class="text-xl font-semibold text-ink">Market Index</h2>
			<p class="mt-3 text-sm leading-relaxed text-muted">
				Public price and market overview charts, with supplier movement, arrivals, and delistings in
				gated Parchment Intelligence modules.
			</p>
		</a>
	</section>
</div>
