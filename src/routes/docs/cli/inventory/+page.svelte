<svelte:head>
	<title>CLI: Inventory - Purveyors Docs</title>
	<meta
		name="description"
		content="purvey inventory commands: view and manage your green coffee purchases."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/cli/overview" class="hover:text-text-primary-light">CLI</a>
			<span>/</span>
			<span>Inventory</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">CLI: Inventory</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			View and manage your green coffee inventory from the command line.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Commands</h2>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light"
					>purvey inventory list [--json]</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">
					List all green coffee inventory items for your account.
				</p>
			</div>
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light"
					>purvey inventory get &lt;id&gt; [--json]</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">Fetch a single inventory item by ID.</p>
			</div>
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light"
					>purvey inventory add --catalog-id &lt;id&gt; --weight &lt;lbs&gt; --price &lt;usd&gt;</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">
					Add a green coffee purchase. Links to a catalog entry by ID.
				</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Examples</h2>
		<div class="mt-4 space-y-3">
			<div class="rounded-lg bg-background-secondary-light p-4">
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey inventory list --json | jq '.[] | select(.stocked == true)'</code
					></pre>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4">
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey inventory add --catalog-id 245 --weight 22 --price 7.50</code
					></pre>
			</div>
		</div>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/cli/catalog" class="text-background-tertiary-light hover:underline"
				>← CLI: Catalog</a
			>
			<a href="/docs/cli/roast" class="text-background-tertiary-light hover:underline"
				>CLI: Roast →</a
			>
		</div>
	</div>
</article>
