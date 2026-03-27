<svelte:head>
	<title>CLI: Catalog - Purveyors Docs</title>
	<meta
		name="description"
		content="purvey catalog commands: search, filter, and view green coffee data."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/cli/overview" class="hover:text-text-primary-light">CLI</a>
			<span>/</span>
			<span>Catalog</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">CLI: Catalog</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Search and browse the normalized green coffee catalog from the command line.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Commands</h2>

		<div class="mt-4 space-y-6">
			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2">
					<code class="text-sm font-medium text-text-primary-light"
						>purvey catalog search [options]</code
					>
				</div>
				<p class="text-sm text-text-secondary-light">Search the catalog with filters.</p>
				<div class="mt-3 rounded-lg bg-background-secondary-light p-3">
					<pre class="overflow-x-auto text-xs"><code class="text-text-primary-light"
							>{`Options:
  --country <country>         Filter by origin country
  --continent <continent>     Filter by continent
  --processing <method>       Filter by processing method
  --supplier <slug>           Filter by supplier slug
  --name <query>              Partial name search
  --score-min <num>           Minimum cupping score
  --score-max <num>           Maximum cupping score
  --price-min <num>           Minimum price per lb (USD)
  --price-max <num>           Maximum price per lb (USD)
  --ids <id,...>              Fetch specific IDs
  --limit <num>               Results per page (default: 15)
  --page <num>                Page number (default: 1)
  --sort <field>              Sort field (default: arrival_date)
  --sort-dir <asc|desc>       Sort direction (default: desc)
  --json                      Output as JSON`}</code
						></pre>
				</div>
			</div>

			<div class="rounded-lg border border-border-light p-5">
				<div class="mb-2">
					<code class="text-sm font-medium text-text-primary-light"
						>purvey catalog get &lt;id&gt;</code
					>
				</div>
				<p class="text-sm text-text-secondary-light">Fetch a single catalog item by ID.</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Examples</h2>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">
					Washed Ethiopians with high scores
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey catalog search --country Ethiopia --processing Washed --score-min 87</code
					></pre>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">
					Export to JSON for scripting
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey catalog search --country Colombia --limit 50 --json > colombia.json</code
					></pre>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4">
				<div class="mb-2 text-xs font-semibold uppercase text-text-secondary-light">
					Find naturals under $7/lb
				</div>
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey catalog search --processing Natural --price-max 7</code
					></pre>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Related API Endpoint</h2>
		<p class="mt-3 text-text-secondary-light">
			The CLI catalog commands map to
			<a href="/docs/api/catalog" class="text-background-tertiary-light hover:underline"
				>GET /v1/catalog</a
			>. Refer to the API docs for the complete field reference.
		</p>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/cli/overview" class="text-background-tertiary-light hover:underline"
				>← CLI Overview</a
			>
			<a href="/docs/cli/inventory" class="text-background-tertiary-light hover:underline"
				>CLI: Inventory →</a
			>
		</div>
	</div>
</article>
