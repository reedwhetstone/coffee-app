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
		content="Access normalized green coffee data from 39+ suppliers through a simple REST API. Daily updates, tiered pricing, built for roasters and coffee tech platforms."
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
				One stable public API for green coffee catalog data from 39+ suppliers, plus a documented
				platform route layer behind the Purveyors web app. The canonical external contract is
				<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/v1/catalog</code
				>; the broader
				<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-sm">/api/*</code> family
				powers inventory, roast, chat, billing, and admin workflows.
			</p>
		</div>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			<button
				onclick={openDashboard}
				class="rounded-xl bg-background-tertiary-light px-5 py-3 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
			>
				Open Parchment Console
			</button>
			<button
				onclick={openDocs}
				class="rounded-xl border border-background-tertiary-light px-5 py-3 text-sm font-semibold text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
			>
				Read the docs
			</button>
			<a
				href="/catalog"
				class="rounded-xl border border-border-light px-5 py-3 text-center text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
			>
				See it in action
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
			<div class="text-3xl font-bold text-background-tertiary-light">3</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Flexible tiers</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				From free exploration to production API access, with enterprise contact-sales support when
				you need it.
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
					<span>Free Green tier for evaluation with no credit card required</span>
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
					<span>Analysts tracking sourcing trends, supplier coverage, and pricing dynamics</span>
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
						<th class="px-4 py-3 font-semibold">Tier</th>
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
						<td class="px-4 py-3 align-top">Evaluation, prototypes, lightweight catalog pulls</td>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Parchment API</td>
						<td class="px-4 py-3 align-top">10,000</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>Production integrations and regular sync jobs with self-serve API access</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Enterprise</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>High-volume sync, internal platforms, and custom support via contact sales</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-text-secondary-light">
			Green is the free evaluation tier. Origin is the self-serve paid Parchment API tier for
			production integrations. Enterprise is a contact-sales path for custom volume, support, and
			commercial terms. API-key requests receive rate-limit headers; session and anonymous catalog
			requests do not. In code and API responses, these marketed plans map to <code
				class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">viewer</code
			>, <code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">member</code>,
			and
			<code class="rounded bg-background-secondary-light px-1.5 py-0.5 text-xs">enterprise</code>.
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
				Live market intelligence: pricing trends, supplier coverage, origin analysis, and more.
			</p>
		</a>
	</section>
</div>
