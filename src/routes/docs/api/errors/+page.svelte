<svelte:head>
	<title>Errors and Rate Limits - Purveyors Docs</title>
	<meta
		name="description"
		content="HTTP status codes, error response format, rate limit headers, and retry guidance for the Parchment API."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/api/overview" class="hover:text-text-primary-light">REST API</a>
			<span>/</span>
			<span>Errors and Rate Limits</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">
			Errors and Rate Limits
		</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			The Parchment API uses standard HTTP status codes. All error responses follow a consistent
			JSON envelope.
		</p>
	</header>

	<!-- HTTP status codes -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">HTTP Status Codes</h2>
		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Status</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Meaning</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>When it occurs</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
								>200 OK</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Success</td>
						<td class="px-4 py-3 text-text-secondary-light">Request succeeded.</td>
					</tr>
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
								>400 Bad Request</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Invalid request</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Malformed parameters (e.g. non-numeric page value).</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
								>401 Unauthorized</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Authentication required</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Authorization header missing, malformed, or key not found.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
								>403 Forbidden</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Insufficient permissions</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Valid key but plan does not include access to the requested resource or scope.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800"
								>429 Too Many Requests</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Rate limit exceeded</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Monthly call quota exhausted. See Retry-After header.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3">
							<span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
								>500 Server Error</span
							>
						</td>
						<td class="px-4 py-3 text-text-secondary-light">Internal server error</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Unexpected server failure. Retry with backoff.</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Error envelope -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Error Response Format</h2>
		<p class="mt-3 text-text-secondary-light">
			All error responses return a JSON object with <code
				class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">error</code
			>
			and <code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">message</code> fields:
		</p>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">401</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`{
  "error": "Authentication required",
  "message": "Valid API key required for access"
}`}</code
					></pre>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">403</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`{
  "error": "Insufficient permissions",
  "message": "API key does not have access to this resource"
}`}</code
					></pre>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">429</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>{`{
  "error": "Rate limit exceeded",
  "message": "API rate limit exceeded for your subscription plan",
  "limit": 200,
  "remaining": 0,
  "resetTime": "2026-04-01T00:00:00.000Z"
}`}</code
					></pre>
			</div>
		</div>
	</section>

	<!-- Rate limit headers -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Rate Limit Headers</h2>
		<p class="mt-3 text-text-secondary-light">
			Every API key response includes rate limit state headers regardless of success or failure:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`X-RateLimit-Limit: 10000         # Total calls allowed this month
X-RateLimit-Remaining: 9871      # Calls remaining this month
X-RateLimit-Reset: 1745100800    # Unix timestamp when limit resets`}</code
				></pre>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			When a 429 is returned, an additional <code
				class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">Retry-After</code
			> header is included with the number of seconds until the monthly window resets.
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`Retry-After: 312847   # Seconds until next month starts`}</code
				></pre>
		</div>
	</section>

	<!-- Rate windows -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Rate Limit Windows</h2>
		<p class="mt-3 text-text-secondary-light">
			Limits are counted on a <strong>calendar month</strong> basis, resetting at midnight UTC on the
			first of each month. Enterprise plans have no monthly cap.
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
							>Monthly calls</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Rows per request</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
					<tr>
						<td class="px-4 py-3 font-medium text-text-primary-light">Explorer (Free)</td>
						<td class="px-4 py-3 text-text-secondary-light">200</td>
						<td class="px-4 py-3 text-text-secondary-light">25</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium text-text-primary-light">Roaster+</td>
						<td class="px-4 py-3 text-text-secondary-light">10,000</td>
						<td class="px-4 py-3 text-text-secondary-light">Unlimited</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-medium text-text-primary-light">Enterprise</td>
						<td class="px-4 py-3 text-text-secondary-light">Unlimited</td>
						<td class="px-4 py-3 text-text-secondary-light">Unlimited</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Retry guidance -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Retry Guidance</h2>
		<ul class="mt-3 space-y-3 text-sm text-text-secondary-light">
			<li>
				<strong class="text-text-primary-light">429 Too Many Requests:</strong> Wait until the
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">Retry-After</code>
				seconds have elapsed (start of next month). Upgrading your plan increases your monthly limit
				immediately.
			</li>
			<li>
				<strong class="text-text-primary-light">500 Server Error:</strong> Retry with exponential
				backoff starting at 1 second. If errors persist, contact
				<a href="mailto:contact@purveyors.io" class="text-background-tertiary-light hover:underline"
					>contact@purveyors.io</a
				>.
			</li>
			<li>
				<strong class="text-text-primary-light">401 / 403:</strong> Do not retry without fixing the
				auth issue. Check that the key is active in your
				<a href="/api-dashboard/keys" class="text-background-tertiary-light hover:underline"
					>dashboard</a
				> and that the key belongs to a plan that grants the required scope.
			</li>
		</ul>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/catalog" class="text-background-tertiary-light hover:underline"
				>← Catalog API</a
			>
			<a href="/docs/cli/overview" class="text-background-tertiary-light hover:underline"
				>CLI Overview →</a
			>
		</div>
	</div>
</article>
