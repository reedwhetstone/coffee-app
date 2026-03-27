<svelte:head>
	<title>Roast Profiles API - Purveyors Docs</title>
	<meta
		name="description"
		content="Roast profiles internal API reference for authenticated app consumers."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/api/overview" class="hover:text-text-primary-light">REST API</a>
			<span>/</span>
			<span>Roast Profiles</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Roast Profiles</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Roast session management for authenticated app users. These endpoints power the Maillard
			Studio roast tracker and are not exposed through the external Parchment API.
		</p>
	</header>

	<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
		<strong>Internal endpoint.</strong> Requires an active Supabase session cookie (member role or higher).
		Not accessible with API keys.
	</div>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Endpoints</h2>

		<div class="mt-4 space-y-6">
			<!-- GET -->
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-3 flex items-center gap-3">
					<span class="rounded bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">GET</span>
					<code class="text-sm font-medium text-text-primary-light">/api/roast-profiles</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					Returns all roast sessions for the authenticated user. Each record includes the linked
					green coffee inventory item (<code
						class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">coffee_id</code
					>), batch and charge weights, drop temperature, and any Artisan-imported curve data.
				</p>
			</div>

			<!-- POST -->
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-3 flex items-center gap-3">
					<span class="rounded bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">POST</span>
					<code class="text-sm font-medium text-text-primary-light">/api/roast-profiles</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					Create one or more roast sessions. Accepts a single session object or a batch array with
					<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">batch_beans</code>
					for multi-bean roasts. After creation, stocked status is automatically recalculated for all
					affected inventory items.
				</p>
			</div>

			<!-- PATCH -->
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-3 flex items-center gap-3">
					<span class="rounded bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800"
						>PATCH</span
					>
					<code class="text-sm font-medium text-text-primary-light">/api/roast-profiles</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					Update one or more roast sessions by ID. Only fields provided in the request body are
					updated.
				</p>
			</div>

			<!-- DELETE -->
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-3 flex items-center gap-3">
					<span class="rounded bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">DELETE</span>
					<code class="text-sm font-medium text-text-primary-light">/api/roast-profiles</code>
				</div>
				<p class="text-sm text-text-secondary-light">
					Delete one or more roast sessions. Accepts a single ID or an array of IDs. Stocked status
					is recalculated after deletion.
				</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Related Endpoints</h2>
		<ul class="mt-3 space-y-2 text-sm text-text-secondary-light">
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>GET /api/roast-chart-data</code
				>
				- Time-series temperature data for the D3 roast chart.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>GET|POST /api/roast-chart-settings</code
				>
				- Per-user chart display preferences.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>POST /api/artisan-import</code
				>
				- Import Artisan .alog roast files. Parses CSV, creates roast profile records, and links to inventory.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>POST /api/ai/classify-roast</code
				>
				- Run AI classification on a roast profile to generate tasting notes and quality score.
			</li>
		</ul>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">CLI Alternative</h2>
		<p class="mt-3 text-text-secondary-light">
			The
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">@purveyors/cli</code>
			provides roast commands for non-browser consumers. See
			<a href="/docs/cli/roast" class="text-background-tertiary-light hover:underline">CLI: Roast</a
			>
			for usage.
		</p>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/analytics" class="text-background-tertiary-light hover:underline"
				>← Analytics</a
			>
			<a href="/docs/api/inventory" class="text-background-tertiary-light hover:underline"
				>Inventory →</a
			>
		</div>
	</div>
</article>
