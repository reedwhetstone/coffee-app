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
		content="Add live green coffee catalog data to your product with one API. Daily updates, clear pricing, and fast onboarding for roasters and coffee software teams."
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
				Bring live green coffee data into your product
			</h1>
			<p class="mt-5 text-lg leading-relaxed text-text-secondary-light">
				Give your team or customers a clean, reliable view of green coffee availability, pricing,
				and supplier coverage. Parchment API delivers daily-updated catalog data from 39+ suppliers
				through one consistent integration.
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
			<div class="text-3xl font-bold text-background-tertiary-light">39+</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Suppliers</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Importers and green coffee sources in one normalized catalog.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">Daily</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Fresh data</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				New listings, removals, and price changes update automatically.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">One</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Consistent feed</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Clean JSON responses that are easier to plug into apps, reports, and internal tools.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">3</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Plans</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Start free, move to production, or talk with us about higher-volume needs.
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
					<span
						>Supplier comparison experiences with pricing, origin, and availability in one place</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span
						>Daily syncs for sourcing systems, planning tools, and customer-facing product features</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Reliable catalog views with a consistent schema across every supplier source</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Usage visibility and API key management through Parchment Console</span>
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
					<span>Roasters building better sourcing, planning, or purchasing workflows</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Coffee software teams adding market data to customer products</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span
						>Operators and analysts who need cleaner visibility into supplier coverage and pricing</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span
						>Teams that want a faster path from raw supplier listings to usable product data</span
					>
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
						<td class="px-4 py-3 align-top">Evaluation, prototypes, and lightweight data pulls</td>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Origin</td>
						<td class="px-4 py-3 align-top">10,000</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>Production products, sync jobs, and recurring customer use</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Enterprise</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>High-volume deployments with custom support and commercial terms</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-text-secondary-light">
			Green is the free way to evaluate the product. Origin is the self-serve plan for live
			integrations. Enterprise is for larger teams that need custom volume, support, or terms.
			Manage your keys and monitor usage in the
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
			<h2 class="text-xl font-semibold text-text-primary-light">Market visibility</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Track pricing trends, supplier movement, and market changes with daily analytics.
			</p>
		</a>
	</section>
</div>
