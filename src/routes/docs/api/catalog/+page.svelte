<svelte:head>
	<title>Catalog API - Purveyors Docs</title>
	<meta
		name="description"
		content="Parchment Catalog API reference: endpoint, query parameters, response schema, and examples."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/api/overview" class="hover:text-text-primary-light">REST API</a>
			<span>/</span>
			<span>Catalog</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">Catalog API</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			The catalog endpoint returns normalized green coffee data aggregated from multiple specialty
			suppliers. Each record includes origin details, pricing, processing method, cupping scores,
			and AI-generated tasting notes.
		</p>
	</header>

	<!-- Endpoint summary -->
	<section>
		<div class="flex items-center gap-3 rounded-lg bg-background-secondary-light p-4">
			<span class="rounded bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">GET</span>
			<code class="text-base font-medium text-text-primary-light">/v1/catalog</code>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			<strong>Authentication required.</strong> Include an API key in the Authorization header. See
			<a href="/docs/api/overview" class="text-background-tertiary-light hover:underline"
				>API Overview</a
			> for key format and tier limits.
		</p>
	</section>

	<!-- Query parameters -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Query Parameters</h2>
		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Parameter</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Type</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Default</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Description</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
					<!-- Pagination -->
					<tr class="bg-blue-50/30">
						<td
							colspan="4"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
							>Pagination</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">page</td>
						<td class="px-4 py-3 text-text-secondary-light">integer</td>
						<td class="px-4 py-3 text-text-secondary-light">1</td>
						<td class="px-4 py-3 text-text-secondary-light">Page number (1-indexed).</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">limit</td>
						<td class="px-4 py-3 text-text-secondary-light">integer</td>
						<td class="px-4 py-3 text-text-secondary-light">15</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Rows per page. Capped to your tier row limit (25 for Explorer).</td
						>
					</tr>
					<!-- Filtering -->
					<tr class="bg-blue-50/30">
						<td
							colspan="4"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
							>Filtering</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">continent</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Filter by continent (e.g. <code>Africa</code>, <code>Americas</code>).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">country</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Filter by country (e.g. <code>Ethiopia</code>, <code>Colombia</code>).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">source</td>
						<td class="px-4 py-3 text-text-secondary-light">string[]</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Repeatable. Filter by supplier slug (e.g. <code>source=sweet_maria</code>).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">processing</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Filter by processing method (e.g. <code>Washed</code>, <code>Natural</code>).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">name</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Partial name search (case-insensitive).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">region</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light">Filter by growing region.</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">score_value_min</td>
						<td class="px-4 py-3 text-text-secondary-light">number</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light">Minimum cupping score (0-100).</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">score_value_max</td>
						<td class="px-4 py-3 text-text-secondary-light">number</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light">Maximum cupping score.</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">price_per_lb_min</td>
						<td class="px-4 py-3 text-text-secondary-light">number</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light">Minimum price per pound (USD).</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">price_per_lb_max</td>
						<td class="px-4 py-3 text-text-secondary-light">number</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light">Maximum price per pound (USD).</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">arrival_date</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Filter to coffees arriving on or after this date (YYYY-MM-DD).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">stocked_date</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Filter to coffees stocked on or after this date (YYYY-MM-DD).</td
						>
					</tr>
					<!-- Sorting -->
					<tr class="bg-blue-50/30">
						<td
							colspan="4"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
							>Sorting</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">sortField</td>
						<td class="px-4 py-3 text-text-secondary-light">string</td>
						<td class="px-4 py-3 text-text-secondary-light">arrival_date</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Field to sort by (e.g. <code>score_value</code>, <code>cost_lb</code>).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">sortDirection</td>
						<td class="px-4 py-3 text-text-secondary-light">asc | desc</td>
						<td class="px-4 py-3 text-text-secondary-light">desc</td>
						<td class="px-4 py-3 text-text-secondary-light">Sort direction.</td>
					</tr>
					<!-- ID lookup -->
					<tr class="bg-blue-50/30">
						<td
							colspan="4"
							class="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-700"
							>ID Lookup</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">ids</td>
						<td class="px-4 py-3 text-text-secondary-light">integer[]</td>
						<td class="px-4 py-3 text-text-secondary-light">-</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Repeatable. Fetch specific coffee IDs. Sorted by name when used.</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Response schema -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Response Schema</h2>
		<p class="mt-3 text-text-secondary-light">
			All successful responses follow the canonical envelope format:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`{
  "data": [ /* array of CatalogItem */ ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1258,
    "totalPages": 51,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "resource": "catalog",
    "namespace": "/v1/catalog",
    "version": "v1",
    "auth": {
      "kind": "api-key",        // "anonymous" | "session" | "api-key"
      "role": "api-member",
      "apiPlan": "api-member"   // "viewer" | "api-member" | "api-enterprise"
    },
    "access": {
      "publicOnly": true,
      "showWholesale": false,
      "wholesaleOnly": false,
      "rowLimit": null,          // null = unlimited, integer = capped
      "limited": false,
      "totalAvailable": 1258
    },
    "cache": { "hit": false, "timestamp": null }
  }
}`}</code
				></pre>
		</div>

		<div class="mt-6">
			<h3 class="text-base font-semibold text-text-primary-light">CatalogItem fields</h3>
			<div class="mt-3 overflow-x-auto rounded-xl border border-border-light">
				<table class="min-w-full divide-y divide-border-light">
					<thead class="bg-background-secondary-light">
						<tr>
							<th
								class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
								>Field</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
								>Type</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
								>Description</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">id</td>
							<td class="px-4 py-3 text-text-secondary-light">integer</td>
							<td class="px-4 py-3 text-text-secondary-light">Stable unique identifier.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">name</td>
							<td class="px-4 py-3 text-text-secondary-light">string</td>
							<td class="px-4 py-3 text-text-secondary-light">Normalized coffee lot name.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">score_value</td>
							<td class="px-4 py-3 text-text-secondary-light">number | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Cupping score (0-100). Null if not scored.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">arrival_date</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">ISO 8601 date (YYYY-MM-DD).</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">region</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Growing region within the country.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">processing</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Processing method (Washed, Natural, Honey, etc.).</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">drying_method</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Drying method (Raised bed, Patio, etc.).</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">roast_recs</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Supplier roast recommendations.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">lot_size</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Total lot size (e.g. "320 bags").</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">bag_size</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Individual bag size (e.g. "60kg").</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">packaging</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Packaging type (GrainPro, Jute, etc.).</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">cultivar_detail</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Cultivar or variety detail.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">grade</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Official grade (e.g. "Grade 1").</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">appearance</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Screen size / defect count (e.g. "15/17").</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">type</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Species (Arabica, Robusta).</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">link</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Supplier product URL.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">cost_lb</td>
							<td class="px-4 py-3 text-text-secondary-light">number | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Base cost per pound (USD). Use <code>price_tiers</code> for tiered pricing.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">price_tiers</td>
							<td class="px-4 py-3 text-text-secondary-light">array | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Tiered pricing: <code>[{'{'}min_lbs: 1, price: 7.50{'}'}, ...]</code>.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">source</td>
							<td class="px-4 py-3 text-text-secondary-light">string</td>
							<td class="px-4 py-3 text-text-secondary-light">Supplier slug identifier.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">stocked</td>
							<td class="px-4 py-3 text-text-secondary-light">boolean</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Current availability (updated daily).</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">stocked_date</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Date last confirmed in stock.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">wholesale</td>
							<td class="px-4 py-3 text-text-secondary-light">boolean</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>True if minimum purchase is greater than 5 lb.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">ai_description</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>AI-generated factual description (bias toward technical detail).</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">ai_tasting_notes</td>
							<td class="px-4 py-3 text-text-secondary-light">object | null</td>
							<td class="px-4 py-3 text-text-secondary-light"
								>Normalized taste profile matrix with category scores (0-10): fruity, floral, nutty,
								chocolatey, etc.</td
							>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">country</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Origin country.</td>
						</tr>
						<tr>
							<td class="px-4 py-3 font-mono text-text-primary-light">continent</td>
							<td class="px-4 py-3 text-text-secondary-light">string | null</td>
							<td class="px-4 py-3 text-text-secondary-light">Origin continent.</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</section>

	<!-- Rate limit headers -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Rate Limit Response Headers</h2>
		<p class="mt-3 text-text-secondary-light">
			Every API key request includes these headers in the response:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9987
X-RateLimit-Reset: 1745100800   # Unix timestamp of reset (start of next month)`}</code
				></pre>
		</div>
	</section>

	<!-- Legacy aliases -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Legacy Aliases</h2>
		<p class="mt-3 text-text-secondary-light">
			Two legacy endpoints remain available and route to the same underlying catalog logic:
		</p>
		<ul class="mt-3 space-y-2 text-sm text-text-secondary-light">
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>GET /api/catalog-api</code
				>
				- External API key auth path. Returns a flat array plus metadata. Use
				<code>/v1/catalog</code>
				for the canonical paginated envelope.
			</li>
			<li>
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>GET /api/catalog</code
				>
				- Internal session auth path. Used by the web app UI. Not suitable for external API consumers.
			</li>
		</ul>
		<p class="mt-3 text-sm text-text-secondary-light">
			Responses from legacy paths include the header
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>X-Purveyors-Canonical-Resource: /v1/catalog</code
			>
			to signal the preferred endpoint.
		</p>
	</section>

	<!-- Examples -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Examples</h2>

		<div class="mt-4 space-y-4">
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-sm font-medium text-text-primary-light">
					Fetch washed Ethiopians sorted by score
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`GET /v1/catalog?country=Ethiopia&processing=Washed&sortField=score_value&sortDirection=desc&page=1&limit=10`}</code
					></pre>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-sm font-medium text-text-primary-light">
					Coffees between $5 and $8/lb stocked this year
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`GET /v1/catalog?price_per_lb_min=5&price_per_lb_max=8&stocked_date=2026-01-01`}</code
					></pre>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-sm font-medium text-text-primary-light">
					Fetch specific coffees by ID
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`GET /v1/catalog?ids=101&ids=245&ids=389`}</code
					></pre>
			</div>
		</div>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/overview" class="text-background-tertiary-light hover:underline"
				>← API Overview</a
			>
			<a href="/docs/api/errors" class="text-background-tertiary-light hover:underline"
				>Errors and Rate Limits →</a
			>
		</div>
	</div>
</article>
