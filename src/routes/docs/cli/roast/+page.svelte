<svelte:head>
	<title>CLI: Roast - Purveyors Docs</title>
	<meta
		name="description"
		content="purvey roast commands: list roast sessions and import Artisan .alog files."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/cli/overview" class="hover:text-text-primary-light">CLI</a>
			<span>/</span>
			<span>Roast</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">CLI: Roast</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Manage roast sessions and import Artisan roast logs from the command line.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Commands</h2>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light">purvey roast list [--json]</code>
				<p class="mt-2 text-sm text-text-secondary-light">
					List all roast sessions for your account.
				</p>
			</div>
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light"
					>purvey roast get &lt;id&gt; [--json]</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">
					Fetch a single roast session by ID, including temperature curve data.
				</p>
			</div>
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light"
					>purvey roast import --file &lt;path.alog&gt; --inventory-id &lt;id&gt;</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">
					Import an Artisan <code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
						>.alog</code
					> file. Links the imported roast to the specified inventory item. Creates roast profile and
					temperature records.
				</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Artisan .alog Format</h2>
		<p class="mt-3 text-text-secondary-light">
			Artisan exports roast sessions as CSV files with a
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">.alog</code>
			extension. The file contains time-series temperature readings plus metadata like bean charge weight,
			development time, and drop temperature. The CLI uses PapaParse to read the CSV and creates the
			corresponding records in Purveyors.
		</p>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Related API Endpoint</h2>
		<p class="mt-3 text-text-secondary-light">
			CLI roast commands call the internal
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>/api/roast-profiles</code
			>
			and
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>/api/artisan-import</code
			>
			endpoints. See
			<a href="/docs/api/roast-profiles" class="text-background-tertiary-light hover:underline"
				>API: Roast Profiles</a
			>.
		</p>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/cli/inventory" class="text-background-tertiary-light hover:underline"
				>← CLI: Inventory</a
			>
			<a href="/docs/cli/sales" class="text-background-tertiary-light hover:underline"
				>CLI: Sales →</a
			>
		</div>
	</div>
</article>
