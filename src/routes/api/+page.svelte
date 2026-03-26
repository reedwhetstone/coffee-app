<script lang="ts">
	import { goto } from '$app/navigation';

	function openDocs() {
		goto('/docs/api/overview');
	}

	function openDashboard() {
		goto('/api-dashboard');
	}

	function openAuth() {
		goto('/auth');
	}
</script>

<svelte:head>
	<title>Purveyors API</title>
	<meta
		name="description"
		content="Normalized green coffee catalog access, market intelligence, and a clean handoff into Purveyors API and CLI docs."
	/>
</svelte:head>

<div class="space-y-8">
	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8 lg:p-10"
	>
		<div class="max-w-4xl">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
				Purveyors API
			</p>
			<h1 class="mt-3 text-4xl font-bold tracking-tight text-text-primary-light sm:text-5xl">
				Normalized green coffee data for software, operators, and agents
			</h1>
			<p class="mt-5 text-lg leading-relaxed text-text-secondary-light">
				Purveyors combines a public catalog feed, live market analytics, and a first-party app for
				inventory, roasting, sales, and AI workflows. The public API contract today is the catalog
				feed; the broader platform surfaces that same domain model through the web app and CLI.
			</p>
		</div>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			<button
				onclick={openDocs}
				class="rounded-xl bg-background-tertiary-light px-5 py-3 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
			>
				Read the docs
			</button>
			<button
				onclick={openDashboard}
				class="rounded-xl border border-background-tertiary-light px-5 py-3 text-sm font-semibold text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
			>
				Open API dashboard
			</button>
			<button
				onclick={openAuth}
				class="rounded-xl border border-border-light px-5 py-3 text-sm font-semibold text-text-primary-light transition-colors hover:bg-background-secondary-light"
			>
				Sign in
			</button>
		</div>
	</section>

	<section class="grid gap-4 lg:grid-cols-4">
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">1</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Public API feed</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				API-key access to public catalog rows through /api/catalog-api.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">39+</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Suppliers in analytics</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				Daily market intelligence powers the public /analytics experience.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">1h</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Catalog cache window</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				The external feed serves from a one-hour in-memory cache before falling back to the
				database.
			</p>
		</div>
		<div class="rounded-2xl border border-border-light bg-background-primary-light p-5 shadow-sm">
			<div class="text-3xl font-bold text-background-tertiary-light">CLI</div>
			<div class="mt-2 text-sm font-semibold text-text-primary-light">Shared domain contract</div>
			<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
				The web app imports @purveyors/cli modules directly for chat and automation flows.
			</p>
		</div>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">What is public today</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>GET /api/catalog-api for the stable external catalog feed</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>/catalog for public marketplace browsing</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>/analytics for public market intelligence with deeper authenticated views</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>/docs for unified API and CLI documentation</span>
				</li>
			</ul>
		</div>

		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">What stays internal</h2>
			<ul class="mt-5 space-y-3 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>Inventory, roast, profit, chat, workspaces, and Stripe routes under /api/*</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>Session-auth and member-gated routes used by the first-party app</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span>CLI-backed chat tools and action-card execution flows</span>
				</li>
				<li class="flex gap-3">
					<span class="mt-1 h-2.5 w-2.5 rounded-full bg-background-tertiary-light"></span>
					<span
						>These are documented so contributors understand them, but they are not public HTTP
						promises.</span
					>
				</li>
			</ul>
		</div>
	</section>

	<section
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
	>
		<h2 class="text-2xl font-semibold text-text-primary-light">Plans and limits</h2>
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
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Explorer</td>
						<td class="px-4 py-3 align-top">200</td>
						<td class="px-4 py-3 align-top">25</td>
						<td class="px-4 py-3 align-top">Evaluation, prototypes, lightweight catalog pulls</td>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Roaster+</td>
						<td class="px-4 py-3 align-top">10,000</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">Production integrations and regular sync jobs</td>
					</tr>
					<tr>
						<td class="px-4 py-3 align-top font-medium text-text-primary-light">Enterprise</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top">Unlimited</td>
						<td class="px-4 py-3 align-top"
							>High-volume sync, internal platforms, premium support</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-4 text-sm leading-relaxed text-text-secondary-light">
			The dashboard shows your current tier, active keys, monthly usage, and rate-limit warnings.
			The docs detail which routes are public and which remain app-internal.
		</p>
	</section>

	<section class="grid gap-6 xl:grid-cols-3">
		<a
			href="/docs/api/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">API docs</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Public catalog reference, internal route map, analytics notes, and auth behavior.
			</p>
		</a>
		<a
			href="/docs/cli/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">CLI docs</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Terminal workflows, auth, inventory, roast imports, and agent integration patterns.
			</p>
		</a>
		<a
			href="/analytics"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Market analytics</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				See the public market-intelligence product that makes the catalog and API more useful.
			</p>
		</a>
	</section>
</div>
