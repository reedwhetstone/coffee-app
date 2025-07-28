<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		document.title = 'Purveyors.io Catalog API Documentation';
	});
</script>

<svelte:head>
	<title>Purveyors.io Catalog API Documentation</title>
	<meta name="description" content="Complete documentation for the Purveyors.io Green Coffee Catalog API" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-12">
			<h1 class="text-4xl font-bold tracking-tight text-text-primary-light">
				Catalog API Documentation
			</h1>
			<p class="mt-4 text-lg text-text-secondary-light">
				Complete reference for the Purveyors.io Green Coffee Catalog API
			</p>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
			<!-- Table of Contents -->
			<div class="lg:col-span-1">
				<nav class="sticky top-8">
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<h3 class="text-lg font-semibold text-text-primary-light mb-4">Contents</h3>
						<ul class="space-y-2 text-sm">
							<li><a href="#overview" class="text-background-tertiary-light hover:text-text-primary-light">Overview</a></li>
							<li><a href="#authentication" class="text-background-tertiary-light hover:text-text-primary-light">Authentication</a></li>
							<li><a href="#endpoints" class="text-background-tertiary-light hover:text-text-primary-light">Endpoints</a></li>
							<li><a href="#data-structure" class="text-background-tertiary-light hover:text-text-primary-light">Data Structure</a></li>
							<li><a href="#examples" class="text-background-tertiary-light hover:text-text-primary-light">Examples</a></li>
							<li><a href="#rate-limits" class="text-background-tertiary-light hover:text-text-primary-light">Rate Limits</a></li>
							<li><a href="#error-handling" class="text-background-tertiary-light hover:text-text-primary-light">Error Handling</a></li>
						</ul>
					</div>
				</nav>
			</div>

			<!-- Main Content -->
			<div class="lg:col-span-3 space-y-12">
				<!-- Overview -->
				<section id="overview">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Overview</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="text-text-secondary-light mb-4">
							The Purveyors.io Catalog API provides access to normalized, AI-enhanced green coffee data 
							from multiple specialty coffee suppliers. This paid service requires member-level authentication 
							and delivers real-time inventory data with standardized formatting.
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
							<code class="text-sm text-background-tertiary-light">https://purveyors.io/api/catalog-api</code>
						</div>
					</div>
				</section>

				<!-- Authentication -->
				<section id="authentication">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Authentication</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="text-text-secondary-light mb-4">
							All API requests require authentication using Bearer token authentication with a valid API key.
						</p>
						<div class="space-y-4">
							<div>
								<h4 class="font-medium text-text-primary-light mb-2">Authentication Method</h4>
								<div class="bg-background-primary-light p-4 rounded-md mb-3">
									<pre class="text-sm"><code>Authorization: Bearer your_api_key</code></pre>
								</div>
								<ul class="list-disc list-inside text-text-secondary-light space-y-1">
									<li>Include the Authorization header in all API requests</li>
									<li>API keys are provided upon subscription activation</li>
									<li>Keys are tied to your subscription plan and rate limits</li>
									<li>API keys can be regenerated from your account dashboard</li>
								</ul>
							</div>
							<div>
								<h4 class="font-medium text-text-primary-light mb-2">Authentication Errors</h4>
								<div class="bg-background-primary-light p-4 rounded-md">
									<pre class="text-sm"><code>{`// 401 Unauthorized - Missing or invalid API key
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
}`}</code></pre>
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- Endpoints -->
				<section id="endpoints">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Endpoints</h2>
					<div class="space-y-6">
						<!-- Catalog API Endpoint -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<div class="flex items-center gap-3 mb-4">
								<span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">GET</span>
								<code class="text-lg text-text-primary-light">/api/catalog-api</code>
							</div>
							<p class="text-text-secondary-light mb-4">
								Retrieves the complete catalog of public green coffee offerings with normalized data structure.
							</p>
							
							<h4 class="font-medium text-text-primary-light mb-2">Response Format</h4>
							<div class="bg-background-primary-light p-4 rounded-md">
								<pre class="text-sm"><code>{`{
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
}`}</code></pre>
							</div>
						</div>
					</div>
				</section>

				<!-- Data Structure -->
				<section id="data-structure">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Data Structure</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="text-text-secondary-light mb-6">
							Each coffee record includes the following standardized fields:
						</p>
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-border-light">
								<thead>
									<tr class="bg-background-primary-light">
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light">Field</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light">Type</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-text-primary-light">Description</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-border-light">
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">id</td><td class="px-4 py-3 text-sm text-text-secondary-light">integer</td><td class="px-4 py-3 text-sm text-text-secondary-light">Unique identifier</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">name</td><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td class="px-4 py-3 text-sm text-text-secondary-light">Coffee lot name (normalized)</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">score_value</td><td class="px-4 py-3 text-sm text-text-secondary-light">number</td><td class="px-4 py-3 text-sm text-text-secondary-light">Cupping score (0-100)</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">arrival_date</td><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td class="px-4 py-3 text-sm text-text-secondary-light">Arrival date (YYYY-MM-DD)</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">region</td><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td class="px-4 py-3 text-sm text-text-secondary-light">Growing region</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">processing</td><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td class="px-4 py-3 text-sm text-text-secondary-light">Processing method</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">cost_lb</td><td class="px-4 py-3 text-sm text-text-secondary-light">number</td><td class="px-4 py-3 text-sm text-text-secondary-light">Cost per pound (USD)</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">stocked</td><td class="px-4 py-3 text-sm text-text-secondary-light">boolean</td><td class="px-4 py-3 text-sm text-text-secondary-light">Current availability status</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">ai_tasting_notes</td><td class="px-4 py-3 text-sm text-text-secondary-light">object</td><td class="px-4 py-3 text-sm text-text-secondary-light">AI-generated taste profile matrix</td></tr>
									<tr><td class="px-4 py-3 text-sm text-text-primary-light font-mono">source</td><td class="px-4 py-3 text-sm text-text-secondary-light">string</td><td class="px-4 py-3 text-sm text-text-secondary-light">Supplier identifier</td></tr>
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<!-- Examples -->
				<section id="examples">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Examples</h2>
					<div class="space-y-6">
						<!-- JavaScript Example -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<h3 class="text-lg font-semibold text-text-primary-light mb-3">JavaScript (Fetch)</h3>
							<div class="bg-background-primary-light p-4 rounded-md">
								<pre class="text-sm"><code>{`// Fetch catalog data
const response = await fetch('https://purveyors.io/api/catalog-api', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_api_key',
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
}`}</code></pre>
							</div>
						</div>

						<!-- cURL Example -->
						<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
							<h3 class="text-lg font-semibold text-text-primary-light mb-3">cURL</h3>
							<div class="bg-background-primary-light p-4 rounded-md">
								<pre class="text-sm"><code>{`curl -X GET "https://purveyors.io/api/catalog-api" \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: application/json"`}</code></pre>
							</div>
						</div>
					</div>
				</section>

				<!-- Rate Limits -->
				<section id="rate-limits">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Rate Limits</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="text-text-secondary-light mb-4">
							API rate limits are based on your subscription plan:
						</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="bg-background-primary-light p-4 rounded-md">
								<h4 class="font-medium text-text-primary-light">Developer</h4>
								<p class="text-text-secondary-light">1,000 calls/month</p>
							</div>
							<div class="bg-background-primary-light p-4 rounded-md">
								<h4 class="font-medium text-text-primary-light">Growth</h4>
								<p class="text-text-secondary-light">10,000 calls/month</p>
							</div>
							<div class="bg-background-primary-light p-4 rounded-md">
								<h4 class="font-medium text-text-primary-light">Enterprise</h4>
								<p class="text-text-secondary-light">100,000 calls/month</p>
							</div>
						</div>
						<p class="text-text-secondary-light mt-4">
							Data is cached for 1 hour to optimize performance and reduce API calls.
						</p>
					</div>
				</section>

				<!-- Error Handling -->
				<section id="error-handling">
					<h2 class="text-2xl font-bold text-text-primary-light mb-4">Error Handling</h2>
					<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
						<p class="text-text-secondary-light mb-4">
							The API uses standard HTTP status codes and returns structured error responses:
						</p>
						<div class="space-y-4">
							<div>
								<h4 class="font-medium text-text-primary-light">Status Codes</h4>
								<div class="bg-background-primary-light p-4 rounded-md mt-2">
									<pre class="text-sm"><code>{`200 OK          - Success
401 Unauthorized - Authentication required
403 Forbidden    - Insufficient permissions  
500 Server Error - Internal server error`}</code></pre>
								</div>
							</div>
							<div>
								<h4 class="font-medium text-text-primary-light">Error Response Format</h4>
								<div class="bg-background-primary-light p-4 rounded-md mt-2">
									<pre class="text-sm"><code>{`{
  "error": "Error type",
  "message": "Human-readable error description"
}`}</code></pre>
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