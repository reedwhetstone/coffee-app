<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { API_PUBLIC_PLANS, PUBLIC_PRODUCT_CATALOG } from '$lib/billing/publicCatalog';

	let { data } = $props<{ data: PageData }>();

	function openDocs() {
		goto('/docs/api/overview');
	}

	function openExplorer() {
		goto(data.session?.user ? '/api-dashboard' : '/auth');
	}

	function openSubscription() {
		goto('/subscription');
	}
</script>

<svelte:head>
	<title>Parchment API</title>
	<meta
		name="description"
		content="Start with Explorer, then upgrade to Parchment API for production access. Normalized green coffee data, daily updates, and a sales-led enterprise path."
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
				Green coffee data, normalized and ready to build on
			</h1>
			<p class="mt-5 text-lg leading-relaxed text-text-secondary-light">
				Start with Explorer for free, then upgrade to Parchment API when you need production-ready
				access to normalized green coffee data from 39+ suppliers. The canonical external contract
				is
				<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/v1/catalog</code
				>, while the broader
				<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/api/*</code>
				family powers inventory, roast, chat, billing, and admin workflows.
			</p>
		</div>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
			<button
				onclick={openExplorer}
				class="rounded-xl bg-background-tertiary-light px-5 py-3 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
			>
				Start with Explorer
			</button>
			<button
				onclick={openSubscription}
				class="rounded-xl border border-background-tertiary-light px-5 py-3 text-sm font-semibold text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
			>
				Upgrade to Parchment API
			</button>
			<button
				onclick={openDocs}
				class="rounded-xl border border-border-light px-5 py-3 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
			>
				Read the docs
			</button>
			<a
				href="/contact"
				class="rounded-xl border border-border-light px-5 py-3 text-center text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
			>
				Talk to sales
			</a>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-4">
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">39+</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Suppliers</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Green coffee offerings from importers across the U.S., normalized into a single schema.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">Daily</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Updates</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Catalog data refreshed every day. New arrivals, delistings, and price changes reflected
				automatically.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">REST</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Simple integration</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Stable public contract at /v1/catalog, JSON responses, and documented platform routes when
				you need to understand the first-party app.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">Explorer</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Free to start</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Free baseline for evaluation, self-serve production access at $99/mo, and a contact-sales
				path for larger deployments.
			</p>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">What you get</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span
						>Normalized catalog with origin, processing method, price, and availability for every
						listing</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span
						>Rate-limit headers on API-key responses so you can track usage and manage your
						integration confidently</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Consistent JSON schema across all suppliers, regardless of source format</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Explorer free baseline for evaluation with no credit card required</span>
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
					<span
						>Roasters building sourcing tools, price comparison dashboards, or inventory systems</span
					>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Coffee tech platforms adding green coffee market data to their products</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Developers and AI agents that need structured coffee supply chain data</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-background-tertiary-light"></span>
					<span>Teams evaluating embedded analytics, data products, or custom integrations</span>
				</li>
			</ul>
		</div>
	</section>

	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
	>
		<h2 class="text-2xl font-semibold text-text-primary-light">Plans</h2>
		<p class="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary-light">
			{PUBLIC_PRODUCT_CATALOG.parchmentApi.freeTierName} is the free baseline. The paid self-serve tier
			is {PUBLIC_PRODUCT_CATALOG.parchmentApi.productName} at {PUBLIC_PRODUCT_CATALOG.parchmentApi
				.monthlyPriceLabel}, and enterprise is a contact-sales path only.
		</p>
		<div class="mt-5 overflow-x-auto rounded-2xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light text-sm">
				<thead class="bg-background-secondary-light text-left text-text-primary-light">
					<tr>
						<th class="px-4 py-3 font-semibold">Plan</th>
						<th class="px-4 py-3 font-semibold">Price</th>
						<th class="px-4 py-3 font-semibold">Monthly requests</th>
						<th class="px-4 py-3 font-semibold">Rows per call</th>
						<th class="px-4 py-3 font-semibold">Best for</th>
					</tr>
				</thead>
				<tbody
					class="divide-y divide-border-light bg-background-primary-light text-text-secondary-light"
				>
					{#each API_PUBLIC_PLANS as plan}
						<tr>
							<td class="px-4 py-3 align-top">
								<div class="font-medium text-text-primary-light">{plan.name}</div>
								<div class="mt-1 text-xs text-text-secondary-light">{plan.accessLabel}</div>
							</td>
							<td class="px-4 py-3 align-top font-medium text-text-primary-light"
								>{plan.priceLabel}</td
							>
							<td class="px-4 py-3 align-top">{plan.monthlyRequests}</td>
							<td class="px-4 py-3 align-top">{plan.rowsPerCall}</td>
							<td class="px-4 py-3 align-top">{plan.bestFor}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-text-secondary-light">
			All plans include JSON responses and access to the normalized catalog. API-key requests
			receive rate-limit headers; session and anonymous catalog requests do not. In code and API
			responses, these public plans map to <code
				class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">viewer</code
			>,
			<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">member</code>, and
			<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">enterprise</code>.
			Manage your keys, usage, and Explorer baseline in the
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
			<h2 class="text-xl font-semibold text-text-primary-light">API reference</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Stable public contract, auth modes, response format, rate limits, and code examples.
			</p>
		</a>
		<a
			href="/docs/api/platform"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Platform routes</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Internal route matrix for inventory, roast, chat, workspaces, billing, and admin flows.
			</p>
		</a>
		<a
			href="/docs/cli/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">CLI reference</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Search the catalog, manage inventory, and automate roasting workflows from your terminal.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Market analytics</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				See the free market snapshot, then unlock Parchment Intelligence for deeper supplier and
				pricing analysis.
			</p>
		</a>
	</section>
</div>
