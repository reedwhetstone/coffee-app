<svelte:head>
	<title>Purveyors Platform Docs</title>
	<meta
		name="description"
		content="Purveyors platform documentation: REST API reference, CLI guide, authentication, and agent integration."
	/>
</svelte:head>

<div class="prose max-w-none">
	<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Platform Documentation</h1>

	<p class="mt-4 text-lg text-text-secondary-light">
		Purveyors provides two primary integration surfaces: the Parchment REST API and the
		<code class="rounded bg-background-secondary-light px-1 py-0.5 text-sm">@purveyors/cli</code>
		command-line client. Both surfaces expose normalized, daily-updated green coffee data and authenticated
		roasting workflow operations.
	</p>

	<div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
		<!-- REST API card -->
		<a
			href="/docs/api/overview"
			class="group rounded-xl border border-border-light bg-background-secondary-light p-6 transition-shadow duration-200 hover:shadow-md"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light/10"
			>
				<svg
					class="h-5 w-5 text-background-tertiary-light"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h2
				class="text-lg font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
			>
				REST API
			</h2>
			<p class="mt-2 text-sm text-text-secondary-light">
				Parchment API: authenticate with API keys, query the catalog, and read analytics. Paginated,
				schema-validated JSON responses.
			</p>
			<span
				class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-background-tertiary-light"
			>
				Read the API docs
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</span>
		</a>

		<!-- CLI card -->
		<a
			href="/docs/cli/overview"
			class="group rounded-xl border border-border-light bg-background-secondary-light p-6 transition-shadow duration-200 hover:shadow-md"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background-tertiary-light/10"
			>
				<svg
					class="h-5 w-5 text-background-tertiary-light"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
					/>
				</svg>
			</div>
			<h2
				class="text-lg font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
			>
				CLI
			</h2>
			<p class="mt-2 text-sm text-text-secondary-light">
				<code class="rounded bg-background-primary-light px-1 py-0.5 text-xs">@purveyors/cli</code>:
				a Node.js command-line client for catalog queries, inventory management, roast logging, and
				agent-based automation.
			</p>
			<span
				class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-background-tertiary-light"
			>
				Read the CLI docs
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</span>
		</a>
	</div>

	<!-- Quick reference -->
	<div class="mt-12 rounded-xl border border-border-light bg-background-secondary-light p-6">
		<h2 class="text-lg font-semibold text-text-primary-light">Quick Reference</h2>
		<dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<dt class="text-sm font-medium text-text-primary-light">Base URL</dt>
				<dd>
					<code class="text-sm text-background-tertiary-light">https://purveyors.io/v1</code>
				</dd>
			</div>
			<div>
				<dt class="text-sm font-medium text-text-primary-light">Canonical catalog endpoint</dt>
				<dd>
					<code class="text-sm text-background-tertiary-light">GET /v1/catalog</code>
				</dd>
			</div>
			<div>
				<dt class="text-sm font-medium text-text-primary-light">Authentication</dt>
				<dd class="text-sm text-text-secondary-light">
					Bearer token: <code class="rounded bg-background-primary-light px-1 py-0.5 text-xs"
						>Authorization: Bearer pk_live_...</code
					>
				</dd>
			</div>
			<div>
				<dt class="text-sm font-medium text-text-primary-light">API key prefix</dt>
				<dd>
					<code class="text-sm text-background-tertiary-light">pk_live_</code>
				</dd>
			</div>
			<div>
				<dt class="text-sm font-medium text-text-primary-light">Free tier rate limit</dt>
				<dd class="text-sm text-text-secondary-light">200 calls/month, 25 rows/request</dd>
			</div>
			<div>
				<dt class="text-sm font-medium text-text-primary-light">Paid tier rate limit</dt>
				<dd class="text-sm text-text-secondary-light">10,000 calls/month, unlimited rows</dd>
			</div>
		</dl>
	</div>

	<!-- Endpoint overview table -->
	<div class="mt-12">
		<h2 class="text-xl font-bold text-text-primary-light">Route Overview</h2>
		<p class="mt-2 text-sm text-text-secondary-light">
			All server routes grouped by access level and purpose.
		</p>

		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Route</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Auth</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Purpose</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light">
					<!-- Public / External API -->
					<tr class="bg-green-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-green-700"
							>Public / External API</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light">GET /v1/catalog</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">API key (Bearer)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Canonical catalog endpoint. Paginated, filterable. Tier-gated row limits.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light">GET /v1</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">None</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>API discovery: version and resource index.</td
						>
					</tr>

					<!-- Legacy API aliases -->
					<tr class="bg-yellow-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-yellow-700"
							>Legacy Aliases (deprecated)</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>GET /api/catalog-api</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">API key</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Legacy external catalog. Mirrors /v1/catalog. Use /v1/catalog instead.</td
						>
					</tr>

					<!-- Internal App API -->
					<tr class="bg-blue-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
							>Internal App API (session auth)</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST/PATCH/DELETE /api/catalog</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session cookie</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Internal catalog queries for the app UI. Supports dropdown mode and filters.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET /api/catalog/filters</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session cookie</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Available filter values for catalog UI.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST/PATCH/DELETE /api/beans</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Green coffee inventory management.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST/PATCH/DELETE /api/roast-profiles</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Roast session CRUD. Supports Artisan batch import.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light">GET /api/profit</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Sales and profit analytics data.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET /api/roast-chart-data</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Roast curve data for D3 chart visualization.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST /api/roast-chart-settings</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Per-user roast chart display preferences.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/artisan-import</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Import Artisan .alog roast files (CSV format).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/update-stocked-status</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Recalculate inventory stocked status after a roast.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/clear-roast</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Clear a roast session and recalculate inventory.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light">GET /api/share</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Generate shareable links for roast sessions.</td
						>
					</tr>

					<!-- AI / GenUI -->
					<tr class="bg-purple-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-purple-700"
							>AI / GenUI</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light">POST /api/chat</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Streaming AI chat via OpenRouter and Vercel AI SDK. Returns SSE.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/chat/execute-action</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Execute a structured action card returned by the AI (buy, add to roast, etc.).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/ai/classify-roast</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>AI classification of a roast profile for notes and quality scoring.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST/DELETE /api/workspaces</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Chat workspace CRUD.</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/POST /api/workspaces/[id]/messages</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Message history for a workspace.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>POST /api/workspaces/[id]/summarize</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Compress older conversation turns to manage context length.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-primary-light"
							>GET/PATCH /api/workspaces/[id]/canvas</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Persistent canvas pane state for a workspace.</td
						>
					</tr>

					<!-- Tool endpoints -->
					<tr class="bg-orange-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-orange-700"
							>AI Tool Endpoints (internal use)</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/tools/coffee-catalog</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Deprecated. Use @purveyors/cli searchCatalog() instead.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/tools/green-coffee-inv</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Inventory query tool for AI chat.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/tools/roast-profiles</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Roast profiles query tool for AI chat.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/tools/bean-tasting</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Bean tasting notes query tool for AI chat.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/tools/coffee-chunks</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (member)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Vector chunk retrieval for RAG-based catalog search.</td
						>
					</tr>

					<!-- Payments -->
					<tr class="bg-pink-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-pink-700"
							>Payments</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light">/api/stripe/*</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session / Stripe sig</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Checkout session, subscription lifecycle, webhook handler.</td
						>
					</tr>

					<!-- Admin -->
					<tr class="bg-red-50/30">
						<td
							colspan="3"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-700"
							>Admin (admin role only)</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>POST /api/admin/backfill-milestones</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (admin)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Backfill milestone metadata for existing catalog rows.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-sm text-text-secondary-light"
							>GET /api/admin/stripe-role-discrepancies</td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Session (admin)</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light"
							>Audit tool: find users whose Stripe subscription does not match their app role.</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</div>
