<svelte:head>
	<title>Inventory API - Purveyors Docs</title>
	<meta
		name="description"
		content="Green coffee inventory internal API reference for the Purveyors app."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/api/overview" class="hover:text-text-primary-light">REST API</a>
			<span>/</span>
			<span>Inventory</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Inventory</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Green coffee inventory (beans) management for authenticated app users. Tracks purchased lots,
			remaining weight, cost basis, and stocked status.
		</p>
	</header>

	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
		<strong>Internal endpoint.</strong> Requires an active Supabase session cookie (member role or higher).
		Not accessible with API keys.
	</div>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Endpoint</h2>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2 flex items-center gap-3">
					<span class="rounded bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">GET</span>
					<code class="text-sm font-medium text-text-primary-light">/api/beans</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					List all green coffee inventory items for the authenticated user. Each record links to a
					<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">catalog_id</code>
					in the catalog, along with purchase weight, cost, and stocked status.
				</p>
			</div>

			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2 flex items-center gap-3">
					<span class="rounded bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">POST</span>
					<code class="text-sm font-medium text-text-primary-light">/api/beans</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					Add a green coffee purchase to inventory. Supply <code
						class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">catalog_id</code
					>,
					<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
						>purchase_weight_lbs</code
					>, and
					<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
						>purchase_price</code
					>.
				</p>
			</div>

			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2 flex items-center gap-3">
					<span class="rounded bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800"
						>PATCH</span
					>
					<code class="text-sm font-medium text-text-primary-light">/api/beans</code>
				</div>
				<p class="text-sm text-text-secondary-light">Update an existing inventory item by ID.</p>
			</div>

			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2 flex items-center gap-3">
					<span class="rounded bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">DELETE</span>
					<code class="text-sm font-medium text-text-primary-light">/api/beans</code>
				</div>
				<p class="text-sm text-text-secondary-light">Delete one or more inventory items by ID.</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Stocked Status</h2>
		<p class="mt-3 text-text-secondary-light">
			Stocked status on inventory items is automatically recalculated by
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>POST /api/update-stocked-status</code
			>
			after roast sessions consume inventory. The stocked flag is set to false when the remaining estimated
			weight drops below the minimum roast batch size.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">CLI Alternative</h2>
		<p class="mt-3 text-text-secondary-light">
			The
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">@purveyors/cli</code>
			provides inventory commands. See
			<a href="/docs/cli/inventory" class="text-background-tertiary-light hover:underline"
				>CLI: Inventory</a
			>.
		</p>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/roast-profiles" class="text-background-tertiary-light hover:underline"
				>← Roast Profiles</a
			>
			<a href="/docs/api/errors" class="text-background-tertiary-light hover:underline"
				>Errors and Rate Limits →</a
			>
		</div>
	</div>
</article>
