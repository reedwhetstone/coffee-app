<svelte:head>
	<title>CLI: Sales - Purveyors Docs</title>
	<meta
		name="description"
		content="purvey sales commands: record sales and view profit analytics."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/cli/overview" class="hover:text-text-primary-light">CLI</a>
			<span>/</span>
			<span>Sales</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">CLI: Sales</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			Record coffee sales and view profit analytics from the command line.
		</p>
	</header>

	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Commands</h2>
		<div class="mt-4 space-y-4">
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light">purvey sales list [--json]</code>
				<p class="mt-2 text-sm text-text-secondary-light">
					List recorded sales transactions for your account.
				</p>
			</div>
			<div class="rounded-lg border border-border-light p-5">
				<code class="text-sm font-medium text-text-primary-light">purvey sales profit [--json]</code
				>
				<p class="mt-2 text-sm text-text-secondary-light">
					View profit summary: revenue, cost, profit, and margin grouped by coffee and time period.
					Pulls from
					<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">/api/profit</code
					>.
				</p>
			</div>
		</div>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/cli/roast" class="text-background-tertiary-light hover:underline"
				>← CLI: Roast</a
			>
			<a href="/docs/cli/tasting" class="text-background-tertiary-light hover:underline"
				>CLI: Tasting →</a
			>
		</div>
	</div>
</article>
