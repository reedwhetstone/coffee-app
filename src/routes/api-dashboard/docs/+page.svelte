<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	onMount(() => {
		document.title = 'API Documentation - Purveyors Dashboard';
	});
</script>

<svelte:head>
	<title>API Documentation - Purveyors Dashboard</title>
	<meta name="description" content="API documentation personalized for your Purveyors account" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-12">
			<nav class="mb-4">
				<a
					href="/api-dashboard"
					class="text-sm text-text-secondary-light hover:text-text-primary-light"
				>
					← Back to Dashboard
				</a>
			</nav>
			<h1 class="text-4xl font-bold tracking-tight text-text-primary-light">API Documentation</h1>
			<p class="mt-4 text-lg text-text-secondary-light">
				Complete reference for the Purveyors.io Green Coffee Catalog API
			</p>
			{#if !data.hasApiKeys}
				<div class="mt-4 rounded-md bg-yellow-50 p-4 ring-1 ring-yellow-200">
					<p class="text-sm text-yellow-800">
						<strong>Note:</strong> You haven't created any API keys yet.
						<a href="/api-dashboard/keys" class="font-medium underline hover:no-underline">
							Create your first API key
						</a> to start using the API.
					</p>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
			<!-- Table of Contents -->
			<div class="lg:col-span-1">
				<nav class="sticky top-8">
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Contents</h3>
						<ul class="space-y-2 text-sm">
							<li>
								<a
									href="#overview"
									class="text-background-tertiary-light hover:text-text-primary-light">Overview</a
								>
							</li>
							<li>
								<a
									href="#authentication"
									class="text-background-tertiary-light hover:text-text-primary-light"
									>Authentication</a
								>
							</li>
							<li>
								<a
									href="#endpoints"
									class="text-background-tertiary-light hover:text-text-primary-light">Endpoints</a
								>
							</li>
							<li>
								<a
									href="#data-structure"
									class="text-background-tertiary-light hover:text-text-primary-light"
									>Data Structure</a
								>
							</li>
							<li>
								<a
									href="#examples"
									class="text-background-tertiary-light hover:text-text-primary-light">Examples</a
								>
							</li>
							<li>
								<a
									href="#rate-limits"
									class="text-background-tertiary-light hover:text-text-primary-light"
									>Rate Limits</a
								>
							</li>
							<li>
								<a
									href="#error-handling"
									class="text-background-tertiary-light hover:text-text-primary-light"
									>Error Handling</a
								>
							</li>
						</ul>
					</div>
				</nav>
			</div>

			<!-- Main Content -->
			<div class="space-y-12 lg:col-span-3">
				<!-- Overview -->
				<section id="overview">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Overview</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="mb-4 text-text-secondary-light">
							The Purveyors.io Catalog API provides access to normalized, AI-enhanced green coffee
							data from multiple specialty coffee suppliers. This paid service requires member-level
							authentication and delivers real-time inventory data with standardized formatting.
						</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<h4 class="font-medium text-text-primary-light">Base URL</h4>
								<code class="text-sm text-background-tertiary-light">https://purveyors.io/api</code>
							</div>
							<div>
								<h4 class="font-medium text-text-primary-light">API Version</h4>
								<code class="text-sm text-background-tertiary-light">1.0</code>
							</div>
						</div>
						<div class="mt-4">
							<h4 class="font-medium text-text-primary-light">Full Endpoint</h4>
							<code class="text-sm text-background-tertiary-light"
								>https://purveyors.io/api/catalog-api</code
							>
						</div>
					</div>
				</section>

				<!-- Authentication -->
				<section id="authentication">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Authentication</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="mb-4 text-text-secondary-light">
							All API requests require authentication using Bearer token authentication with a valid
							API key.
						</p>
						<div class="space-y-4">
							<div>
								<h4 class="mb-2 font-medium text-text-primary-light">Authentication Method</h4>
								<div class="mb-3 rounded-md bg-background-primary-light p-4">
									<pre class="text-sm"><code>Authorization: Bearer {data.exampleApiKey}</code></pre>
								</div>
								<ul class="list-inside list-disc space-y-1 text-text-secondary-light">
									<li>Include the Authorization header in all API requests</li>
									<li>API keys are provided upon subscription activation</li>
									<li>Keys are tied to your subscription plan and rate limits</li>
									<li>API keys can be regenerated from your account dashboard</li>
								</ul>
							</div>
							<div>
								<h4 class="mb-2 font-medium text-text-primary-light">Authentication Errors</h4>
								<div class="rounded-md bg-background-primary-light p-4">
									<pre class="text-sm"><code
											>{`// 401 Unauthorized - Missing or invalid API key
{
  "error": "Authentication required",
  "message": "Valid API key required for access"
}

// 403 Forbidden - Valid key but insufficient permissions
{
  "error": "Insufficient permissions",
  "message": "API key does not have access to this resource"
}

// 429 Too Many Requests - Rate limit exceeded
{
  "error": "Rate limit exceeded",
  "message": "API rate limit exceeded for your subscription plan"
}`}</code
										></pre>
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- Endpoints -->
				<section id="endpoints">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Endpoints</h2>
					<div class="space-y-6">
						<!-- Catalog API Endpoint -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<div class="mb-4 flex items-center gap-3">
								<span class="rounded bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
									>GET</span
								>
								<code class="text-lg text-text-primary-light">/api/catalog-api</code>
							</div>
							<p class="mb-4 text-text-secondary-light">
								Retrieves the complete catalog of public green coffee offerings with normalized data
								structure.
							</p>

							<h4 class="mb-2 font-medium text-text-primary-light">Response Format</h4>
							<div class="rounded-md bg-background-primary-light p-4">
								<pre class="text-sm"><code
										>{`{
  "data": [
    {
      "id": 1,
      "name": "Ethiopia Sidamo Grade 1",
      "score_value": 87.5,
      "arrival_date": "2024-01-15",
      "region": "Sidamo",
      "processing": "Washed",
      "drying_method": "Patio",
      "roast_recs": "City to City+",
      "lot_size": "320 bags",
      "bag_size": "60kg",
      "packaging": "GrainPro",
      "cultivar_detail": "Heirloom varieties",
      "grade": "Grade 1",
      "appearance": "15/17",
      "type": "Arabica",
      "link": "https://supplier.com/product/123",
      "cost_lb": 7.50,
      "last_updated": "2024-01-20",
      "source": "sweet_maria",
      "stocked": true,
      "unstocked_date": null,
      "stocked_date": "2024-01-15",
      "ai_description": "Clean, bright coffee with floral notes...",
      "ai_tasting_notes": {
        "fruity": 8,
        "floral": 7,
        "nutty": 3,
        "chocolatey": 4
      },
      "country": "Ethiopia",
      "continent": "Africa"
    }
  ],
  "total": 1,
  "cached": false,
  "last_updated": "2024-01-20T10:30:00Z",
  "api_version": "1.0"
}`}</code
									></pre>
							</div>
						</div>
					</div>
				</section>

				<!-- Data Structure -->
				<section id="data-structure">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Data Structure</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="mb-6 text-text-secondary-light">
							Each coffee record includes the following standardized fields:
						</p>
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-border-light">
								<thead>
									<tr class="bg-background-primary-light">
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light"
											>Field</th
										>
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light"
											>Type</th
										>
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light"
											>Description</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-border-light">
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">id</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">integer</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">Unique identifier</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">name</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">string</td
										><td class="px-4 py-3 text-sm text-text-secondary-light"
											>Coffee lot name (normalized)</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">score_value</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">number</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">Cupping score (0-100)</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light"
											>arrival_date</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td
											class="px-4 py-3 text-sm text-text-secondary-light"
											>Arrival date (YYYY-MM-DD)</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">region</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">string</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">Growing region</td></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">processing</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">Processing method</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">cost_lb</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">number</td
										><td class="px-4 py-3 text-sm text-text-secondary-light"
											>Cost per pound (USD)</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">stocked</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">boolean</td
										><td class="px-4 py-3 text-sm text-text-secondary-light"
											>Current availability status</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light"
											>ai_tasting_notes</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">object</td><td
											class="px-4 py-3 text-sm text-text-secondary-light"
											>AI-generated taste profile matrix</td
										></tr
									>
									<tr
										><td class="px-4 py-3 font-mono text-sm text-text-primary-light">source</td><td
											class="px-4 py-3 text-sm text-text-secondary-light">string</td
										><td class="px-4 py-3 text-sm text-text-secondary-light">Supplier identifier</td
										></tr
									>
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<!-- Examples -->
				<section id="examples">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Examples</h2>
					<div class="space-y-6">
						<!-- JavaScript Example -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<h3 class="mb-3 text-lg font-semibold text-text-primary-light">JavaScript (Fetch)</h3>
							<div class="rounded-md bg-background-primary-light p-4">
								<pre class="text-sm"><code
										>{`// Fetch catalog data
const response = await fetch('https://purveyors.io/api/catalog-api', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer {data.exampleApiKey}',
    'Content-Type': 'application/json'
  }
});

if (response.ok) {
  const data = await response.json();
  console.log('Total coffees:', data.total);
  console.log('Coffees:', data.data);
} else {
  const error = await response.json();
  console.error('API Error:', error.message);
}`}</code
									></pre>
							</div>
						</div>

						<!-- cURL Example -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<h3 class="mb-3 text-lg font-semibold text-text-primary-light">cURL</h3>
							<div class="rounded-md bg-background-primary-light p-4">
								<pre class="text-sm"><code
										>{`curl -X GET "https://purveyors.io/api/catalog-api" \\
  -H "Authorization: Bearer {data.exampleApiKey}" \\
  -H "Content-Type: application/json"`}</code
									></pre>
							</div>
						</div>
					</div>
				</section>

				<!-- Rate Limits -->
				<section id="rate-limits">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Rate Limits</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="mb-4 text-text-secondary-light">
							API rate limits are based on your subscription plan:
						</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="rounded-md bg-background-primary-light p-4">
								<h4 class="font-medium text-text-primary-light">Developer</h4>
								<p class="text-text-secondary-light">1,000 calls/month</p>
							</div>
							<div class="rounded-md bg-background-primary-light p-4">
								<h4 class="font-medium text-text-primary-light">Growth</h4>
								<p class="text-text-secondary-light">10,000 calls/month</p>
							</div>
							<div class="rounded-md bg-background-primary-light p-4">
								<h4 class="font-medium text-text-primary-light">Enterprise</h4>
								<p class="text-text-secondary-light">100,000 calls/month</p>
							</div>
						</div>
						<p class="mt-4 text-text-secondary-light">
							Data is cached for 1 hour to optimize performance and reduce API calls.
						</p>
					</div>
				</section>

				<!-- Error Handling -->
				<section id="error-handling">
					<h2 class="mb-4 text-2xl font-bold text-text-primary-light">Error Handling</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="mb-4 text-text-secondary-light">
							The API uses standard HTTP status codes and returns structured error responses:
						</p>
						<div class="space-y-4">
							<div>
								<h4 class="font-medium text-text-primary-light">Status Codes</h4>
								<div class="mt-2 rounded-md bg-background-primary-light p-4">
									<pre class="text-sm"><code
											>{`200 OK          - Success
401 Unauthorized - Authentication required
403 Forbidden    - Insufficient permissions  
500 Server Error - Internal server error`}</code
										></pre>
								</div>
							</div>
							<div>
								<h4 class="font-medium text-text-primary-light">Error Response Format</h4>
								<div class="mt-2 rounded-md bg-background-primary-light p-4">
									<pre class="text-sm"><code
											>{`{
  "error": "Error type",
  "message": "Human-readable error description"
}`}</code
										></pre>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	</div>
</div>

<style>
	/* Smooth scrolling for anchor links */
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
