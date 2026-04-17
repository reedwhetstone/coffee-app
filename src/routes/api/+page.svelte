<script lang="ts">
	import { goto } from '$app/navigation';

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
		content="Green coffee market data as a REST API. Normalized pricing, availability, and supplier coverage across 41+ US specialty importers. Daily updates, one consistent schema."
	/>
</svelte:head>

<div class="space-y-8">
	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8 lg:p-10"
	>
		<div class="max-w-4xl">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
				Parchment API
			</p>
			<h1 class="mt-3 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				41+ importers. One API. Daily updates.
			</h1>
			<p class="mt-5 text-lg leading-relaxed text-text-secondary-light">
				Normalized pricing, availability, and supplier coverage across 41+ US specialty importers.
				Ship sourcing features without scraping anyone yourself.
			</p>
		</div>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			<button
				onclick={openDashboard}
				class="rounded-xl bg-background-tertiary-light px-5 py-3 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
			>
				Get API access
			</button>
			<button
				onclick={openDocs}
				class="rounded-xl border border-background-tertiary-light px-5 py-3 text-sm font-semibold text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
			>
				View docs
			</button>
			<a
				href="/catalog"
				class="rounded-xl border border-border-light px-5 py-3 text-center text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
			>
				Explore the catalog
			</a>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-4">
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">41+</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">US importers</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Every major specialty importer in one normalized schema. Wholesale and retail segmented.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">Daily</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Normalized updates</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Arrivals, delistings, and price changes reflected same-day. 90+ days of price history.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">One</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Consistent schema</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Origin, process, grade, price, and availability mapped consistently across every supplier.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">3</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Access tiers</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Free evaluation, self-serve production, and enterprise. No scraping infrastructure required.
			</p>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">What you can build</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Sync your internal sourcing dashboard with live offer lists from 41+ importers</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Flag lots priced below the origin median for immediate buyer review</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Feed agent and procurement workflows with normalized supplier schemas and arrival data</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Surface supplier coverage gaps and new arrivals in customer-facing sourcing tools</span>
				</li>
			</ul>
		</div>

		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">Built for</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Green coffee buyers who need market-wide pricing and arrival data before placing orders</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Roastery software teams shipping sourcing and procurement features without building scrapers</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Procurement analysts benchmarking bids against origin-level price distributions</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Developers embedding live offer lists, arrival feeds, and supplier comparisons into internal tools</span>
				</li>
			</ul>
		</div>
	</section>

	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
	>
		<h2 class="text-2xl font-semibold text-text-primary-light">Plans</h2>
		<div class="mt-5 overflow-x-auto rounded-2xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light text-sm">
				<thead class="bg-background-secondary-light text-left text-text-primary-light">
					<tr>
						<th class="px-4 py-3 font-semibold">Plan</th>
						<th class="px-4 py-3 font-semibold">Monthly requests</th>
						<th class="px-4 py-3 font-semibold">Rows per call</th>
						<th class="px-4 py-3 font-semibold">Best for</th>
					</tr>
				</thead>
				<tbody
					class="divide-y divide-border-light bg-background-primary-light text-text-secondary-light"
				>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Green</td>
						<td class="px-4 py-3 align-top">200</td>
						<td class="px-4 py-3 align-top">25</td>
						<td class="px-4 py-3 align-top">Evaluate the feed, prototype integrations, validate schema fit</td>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Origin</td>
						<td class="px-4 py-3 align-top">10,000</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>Production sourcing tools, daily sync jobs, and live customer-facing features</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Enterprise</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>High-volume deployments, custom data agreements, and dedicated support</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-text-secondary-light">
			Green gets you into the feed immediately at no cost. Origin is the self-serve tier for
			production integrations with full row access and 10,000 monthly requests. Enterprise covers
			unlimited volume, custom data terms, and dedicated support. Manage keys and monitor usage in
			the
			<a href="/api-dashboard" class="text-background-tertiary-light hover:underline"
				>Parchment Console</a
			>.
		</p>
	</section>

	<section class="grid gap-6 xl:grid-cols-4">
		<a
			href="/docs/api/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">API docs</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Authentication, response format, limits, and code examples for getting started fast.
			</p>
		</a>
		<a
			href="/api-dashboard"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Parchment Console</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Create keys, review usage, and manage access in one place.
			</p>
		</a>
		<a
			href="/catalog"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Live catalog</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				See the buyer-facing catalog experience powered by the same core dataset.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Market intelligence</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Pricing trends, supplier movement, arrivals, and delistings delivered daily.
			</p>
		</a>
	</section>
</div>
