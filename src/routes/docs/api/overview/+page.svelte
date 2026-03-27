<svelte:head>
	<title>API Overview - Purveyors Docs</title>
	<meta
		name="description"
		content="Parchment REST API overview: authentication, versioning, base URLs, and quick start."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<span>REST API</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">API Overview</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			The Parchment REST API is the canonical programmatic interface to Purveyors green coffee data.
			It delivers normalized, daily-updated inventory from multiple specialty suppliers in a single
			consistent schema.
		</p>
	</header>

	<!-- Base URL and version -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Base URL</h2>
		<div class="mt-3 rounded-lg bg-background-secondary-light p-4">
			<code class="text-sm text-background-tertiary-light">https://purveyors.io/v1</code>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			The current version is <strong>v1</strong>. All versioned endpoints are stable; breaking
			changes are only introduced in new major versions. Legacy aliases at
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">/api/catalog-api</code
			>
			and
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">/api/catalog</code>
			remain available for backward compatibility but route to the same underlying logic. Prefer
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">/v1/catalog</code>.
		</p>
	</section>

	<!-- Authentication -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Authentication</h2>
		<p class="mt-3 text-text-secondary-light">
			All external API requests require a Bearer token API key. Keys are generated per user account
			at
			<a href="/api-dashboard/keys" class="text-background-tertiary-light hover:underline"
				>/api-dashboard/keys</a
			>.
		</p>

		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="text-sm"><code class="text-text-primary-light"
					>Authorization: Bearer pk_live_&lt;your-key&gt;</code
				></pre>
		</div>

		<div class="mt-4 space-y-3">
			<h3 class="text-base font-semibold text-text-primary-light">Key format</h3>
			<ul class="space-y-2 text-sm text-text-secondary-light">
				<li>
					All keys begin with the prefix <code
						class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">pk_live_</code
					> followed by 64 random hex characters.
				</li>
				<li>
					Keys are hashed with bcrypt before storage. The plaintext value is shown only once at
					creation.
				</li>
				<li>Deactivating a key takes effect immediately for all future requests.</li>
				<li>A single user account can hold multiple keys (useful for per-integration scoping).</li>
			</ul>
		</div>

		<div class="mt-4 rounded-lg border border-border-light bg-background-primary-light p-4">
			<h3 class="text-sm font-semibold text-text-primary-light">Two auth paths</h3>
			<p class="mt-2 text-sm text-text-secondary-light">
				The platform accepts two kinds of Bearer tokens. If the value starts with
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">pk_live_</code>, it
				is treated as an API key and resolved against the
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">api_keys</code> table.
				Any other Bearer value is treated as a Supabase session JWT and validated against the auth service.
				Session JWTs are intended for use by the web app, not external API consumers.
			</p>
		</div>
	</section>

	<!-- Subscription tiers -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Subscription Tiers</h2>
		<p class="mt-3 text-text-secondary-light">
			Rate limits and row limits are determined by your subscription plan.
		</p>
		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Plan</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Role</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Monthly calls</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Rows per request</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light">
					<tr>
						<td class="px-4 py-3 text-sm font-medium text-text-primary-light">Explorer (Free)</td>
						<td
							><code
								class="rounded bg-background-secondary-light px-1 py-0.5 text-xs text-text-primary-light"
								>viewer</code
							></td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">200</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">25</td>
					</tr>
					<tr>
						<td class="px-4 py-3 text-sm font-medium text-text-primary-light">Roaster+</td>
						<td
							><code
								class="rounded bg-background-secondary-light px-1 py-0.5 text-xs text-text-primary-light"
								>api-member</code
							></td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">10,000</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Unlimited</td>
					</tr>
					<tr>
						<td class="px-4 py-3 text-sm font-medium text-text-primary-light">Enterprise</td>
						<td
							><code
								class="rounded bg-background-secondary-light px-1 py-0.5 text-xs text-text-primary-light"
								>api-enterprise</code
							></td
						>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Unlimited</td>
						<td class="px-4 py-3 text-sm text-text-secondary-light">Unlimited</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			Monthly limits reset at the start of each calendar month (UTC). Rate limit headers are
			included in every API response. See
			<a href="/docs/api/errors" class="text-background-tertiary-light hover:underline"
				>Errors and Rate Limits</a
			> for response format and retry guidance.
		</p>
	</section>

	<!-- Quick start -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Quick Start</h2>
		<p class="mt-3 text-text-secondary-light">
			Retrieve the first page of the green coffee catalog:
		</p>

		<div class="mt-4 space-y-4">
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">cURL</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`curl -G "https://purveyors.io/v1/catalog" \\
  -H "Authorization: Bearer pk_live_your_key_here" \\
  --data-urlencode "page=1" \\
  --data-urlencode "limit=25"`}</code
					></pre>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">JavaScript</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`const res = await fetch(
  'https://purveyors.io/v1/catalog?page=1&limit=25',
  { headers: { Authorization: 'Bearer pk_live_your_key_here' } }
);
const { data, pagination, meta } = await res.json();`}</code
					></pre>
			</div>

			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">Python</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`import requests

resp = requests.get(
    "https://purveyors.io/v1/catalog",
    params={"page": 1, "limit": 25},
    headers={"Authorization": "Bearer pk_live_your_key_here"},
)
resp.raise_for_status()
payload = resp.json()
coffees = payload["data"]`}</code
					></pre>
			</div>
		</div>
	</section>

	<!-- API discovery -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">API Discovery</h2>
		<p class="mt-3 text-text-secondary-light">
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">GET /v1</code>
			returns a machine-readable index of available resources. No authentication required.
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`{
  "product": "Parchment Platform",
  "namespace": "/v1",
  "version": "v1",
  "auth": { "session": true, "apiKey": true },
  "resources": {
    "catalog": {
      "href": "/v1/catalog",
      "status": "live",
      "legacyAliases": ["/api/catalog", "/api/catalog-api"]
    }
  }
}`}</code
				></pre>
		</div>
	</section>

	<!-- Next steps -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Next Steps</h2>
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			<a
				href="/docs/api/catalog"
				class="rounded-lg border border-border-light p-4 transition-shadow duration-200 hover:shadow-md"
			>
				<div class="font-medium text-text-primary-light">Catalog API</div>
				<div class="mt-1 text-sm text-text-secondary-light">
					Full endpoint reference, query parameters, and response schema.
				</div>
			</a>
			<a
				href="/docs/api/errors"
				class="rounded-lg border border-border-light p-4 transition-shadow duration-200 hover:shadow-md"
			>
				<div class="font-medium text-text-primary-light">Errors and Rate Limits</div>
				<div class="mt-1 text-sm text-text-secondary-light">
					HTTP status codes, error envelope format, and rate limit headers.
				</div>
			</a>
			<a
				href="/api-dashboard/keys"
				class="rounded-lg border border-border-light p-4 transition-shadow duration-200 hover:shadow-md"
			>
				<div class="font-medium text-text-primary-light">Generate an API Key</div>
				<div class="mt-1 text-sm text-text-secondary-light">
					Create and manage your API keys from the dashboard.
				</div>
			</a>
			<a
				href="/docs/cli/overview"
				class="rounded-lg border border-border-light p-4 transition-shadow duration-200 hover:shadow-md"
			>
				<div class="font-medium text-text-primary-light">CLI Overview</div>
				<div class="mt-1 text-sm text-text-secondary-light">
					Use the @purveyors/cli client for catalog queries and roast workflows.
				</div>
			</a>
		</div>
	</section>
</article>
