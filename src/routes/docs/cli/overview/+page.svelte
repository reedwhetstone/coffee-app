<svelte:head>
	<title>CLI Overview - Purveyors Docs</title>
	<meta
		name="description"
		content="@purveyors/cli: install, authenticate, and start querying the Purveyors platform from the command line."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<span>CLI</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">CLI Overview</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-sm">@purveyors/cli</code>
			is a Node.js command-line client for the Purveyors platform. It is designed for both human operators
			and AI agents. Every data operation available in the web app is accessible from the CLI, and the
			AI chat tool loop within the app imports CLI library functions directly.
		</p>
	</header>

	<!-- Install -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Installation</h2>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>npm install -g @purveyors/cli</code
				></pre>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			Requires Node.js 18 or higher. After installation, verify with:
		</p>
		<div class="mt-2 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>purvey --version</code
				></pre>
		</div>
	</section>

	<!-- Authentication -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Authentication</h2>
		<p class="mt-3 text-text-secondary-light">
			The CLI authenticates with your Purveyors account via OAuth. Run the login command and follow
			the prompt:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>purvey auth login</code
				></pre>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			This opens a browser window. After authorizing, credentials are stored at
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>~/.config/purvey/credentials.json</code
			>.
		</p>

		<div class="mt-4">
			<h3 class="text-base font-semibold text-text-primary-light">Headless / agent login</h3>
			<p class="mt-2 text-sm text-text-secondary-light">
				For CI or agent environments without a browser, use headless mode. The CLI prints an OAuth
				URL; paste the callback URL back when prompted:
			</p>
			<div class="mt-2 rounded-lg bg-background-secondary-light p-4">
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey auth login --headless</code
					></pre>
			</div>
		</div>

		<div class="mt-4">
			<h3 class="text-base font-semibold text-text-primary-light">Check auth status</h3>
			<div class="mt-2 rounded-lg bg-background-secondary-light p-4">
				<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
						>purvey auth status</code
					></pre>
			</div>
		</div>
	</section>

	<!-- Command groups -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Command Groups</h2>
		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Command</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Purpose</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey catalog</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Search and browse the green coffee catalog.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey inventory</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>View and manage your green coffee inventory.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey roast</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>List and manage roast sessions, import Artisan files.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey sales</td>
						<td class="px-4 py-3 text-text-secondary-light">Record sales and view profit data.</td>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey tasting</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Log tasting notes and view flavor profiles.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">purvey auth</td>
						<td class="px-4 py-3 text-text-secondary-light">Authenticate and manage credentials.</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			Run <code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>purvey --help</code
			>
			or
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>purvey &lt;command&gt; --help</code
			>
			for inline documentation.
		</p>
	</section>

	<!-- Output formats -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Output Formats</h2>
		<p class="mt-3 text-text-secondary-light">
			Most commands default to a table view. Append
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">--json</code> for machine-readable
			output:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>purvey catalog search --country Ethiopia --json | jq '.data[0]'</code
				></pre>
		</div>
	</section>

	<!-- Agent integration note -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Agent Integration</h2>
		<p class="mt-3 text-text-secondary-light">
			The CLI is designed to be called by AI agents and automation scripts. See
			<a href="/docs/cli/agent-integration" class="text-background-tertiary-light hover:underline"
				>Agent Integration</a
			>
			for patterns including headless auth, structured output, and using the CLI library directly in
			Node.js without the subprocess layer.
		</p>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/api/errors" class="text-background-tertiary-light hover:underline"
				>← Errors and Rate Limits</a
			>
			<a href="/docs/cli/catalog" class="text-background-tertiary-light hover:underline"
				>CLI: Catalog →</a
			>
		</div>
	</div>
</article>
