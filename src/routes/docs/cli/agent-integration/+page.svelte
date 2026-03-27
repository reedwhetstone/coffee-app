<svelte:head>
	<title>CLI: Agent Integration - Purveyors Docs</title>
	<meta
		name="description"
		content="Integrate @purveyors/cli into AI agents and automation pipelines: headless auth, JSON output, and direct library usage."
	/>
</svelte:head>

<article class="space-y-10">
	<header>
		<div class="mb-2 flex items-center gap-2 text-sm text-text-secondary-light">
			<a href="/docs" class="hover:text-text-primary-light">Docs</a>
			<span>/</span>
			<a href="/docs/cli/overview" class="hover:text-text-primary-light">CLI</a>
			<span>/</span>
			<span>Agent Integration</span>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">
			CLI: Agent Integration
		</h1>
		<p class="mt-3 text-lg text-text-secondary-light">
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-sm">@purveyors/cli</code>
			is designed as a first-class tool for AI agents and automation pipelines. The web app's AI chat
			endpoint imports CLI library functions directly; external agents can use the same functions or
			invoke the CLI as a subprocess.
		</p>
	</header>

	<!-- Headless auth -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Headless Authentication</h2>
		<p class="mt-3 text-text-secondary-light">
			For agents running without a browser, authenticate once using headless mode:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`# CLI prints an OAuth URL; agent pastes the callback URL back
purvey auth login --headless`}</code
				></pre>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			Credentials persist at
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
				>~/.config/purvey/credentials.json</code
			>. Subsequent CLI calls do not require re-authentication until the session expires.
		</p>
	</section>

	<!-- Subprocess pattern -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Subprocess Pattern</h2>
		<p class="mt-3 text-text-secondary-light">
			Invoke the CLI from any agent via subprocess. Always pass
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">--json</code> for machine-readable
			output:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`import { execSync } from 'child_process';

const raw = execSync('purvey catalog search --country Ethiopia --json', {
  encoding: 'utf8'
});
const { data } = JSON.parse(raw);
// data is an array of CatalogItem`}</code
				></pre>
		</div>
	</section>

	<!-- Library pattern -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Direct Library Usage</h2>
		<p class="mt-3 text-text-secondary-light">
			For Node.js projects, import CLI library functions directly to avoid the subprocess overhead:
		</p>
		<div class="mt-4 rounded-lg bg-background-secondary-light p-4">
			<pre class="overflow-x-auto text-sm"><code class="text-text-primary-light"
					>{`import { searchCatalog } from '@purveyors/cli';

const result = await searchCatalog({
  country: 'Ethiopia',
  processing: 'Washed',
  limit: 10
});

console.log(result.data);  // CatalogItem[]`}</code
				></pre>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			This is the same pattern used by the Purveyors web app chat endpoint. The
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">tools.ts</code>
			service in the app imports
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">searchCatalog</code>
			from
			<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs">@purveyors/cli</code>
			directly, which means any improvement to the CLI library automatically improves the AI chat tool
			loop.
		</p>
	</section>

	<!-- Available library exports -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Key Library Exports</h2>
		<div class="mt-4 overflow-x-auto rounded-xl border border-border-light">
			<table class="min-w-full divide-y divide-border-light">
				<thead class="bg-background-secondary-light">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Function</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-semibold uppercase text-text-secondary-light"
							>Description</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-light bg-background-primary-light text-sm">
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">searchCatalog(opts)</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Query the catalog with filters and pagination. Returns
							<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
								>{'{'}data, pagination, meta{'}'}</code
							>.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">getInventory()</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Returns all green coffee inventory for the authenticated user.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">getRoastProfiles()</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Returns all roast sessions for the authenticated user.</td
						>
					</tr>
					<tr>
						<td class="px-4 py-3 font-mono text-text-primary-light">getTastingNotes(opts)</td>
						<td class="px-4 py-3 text-text-secondary-light"
							>Returns tasting notes, optionally scoped to a roast or inventory item.</td
						>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-sm text-text-secondary-light">
			See the
			<a
				href="https://github.com/reedwhetstone/purveyors-cli"
				class="text-background-tertiary-light hover:underline"
				target="_blank"
				rel="noopener noreferrer">purveyors-cli GitHub repo</a
			>
			for the full export list and type definitions.
		</p>
	</section>

	<!-- Best practices -->
	<section>
		<h2 class="text-xl font-bold text-text-primary-light">Agent Best Practices</h2>
		<ul class="mt-3 space-y-3 text-sm text-text-secondary-light">
			<li>
				<strong class="text-text-primary-light">Always use --json.</strong> Human-readable table output
				is not stable across versions. JSON output follows the documented schema.
			</li>
			<li>
				<strong class="text-text-primary-light">Check credentials before long-running jobs.</strong>
				Run
				<code class="rounded bg-background-secondary-light px-1 py-0.5 text-xs"
					>purvey auth status</code
				>
				at the start of a job to confirm the session is valid.
			</li>
			<li>
				<strong class="text-text-primary-light"
					>Prefer library imports over subprocess in Node.js.</strong
				>
				Library calls avoid shell startup overhead and give you TypeScript types.
			</li>
			<li>
				<strong class="text-text-primary-light">Respect rate limits.</strong> The CLI calls the same
				API endpoints as direct HTTP. Your API key's monthly quota applies. See
				<a href="/docs/api/errors" class="text-background-tertiary-light hover:underline"
					>Errors and Rate Limits</a
				>.
			</li>
			<li>
				<strong class="text-text-primary-light">Report friction.</strong> The CLI is the primary interface
				for agentic work. If you encounter a missing command, poor error message, or unhelpful help text,
				open a GitHub issue. Every CLI improvement feeds back into the web app chat.
			</li>
		</ul>
	</section>

	<div class="border-t border-border-light pt-6">
		<div class="flex items-center justify-between text-sm">
			<a href="/docs/cli/tasting" class="text-background-tertiary-light hover:underline"
				>← CLI: Tasting</a
			>
			<a href="/docs" class="text-background-tertiary-light hover:underline">Back to Docs Index →</a
			>
		</div>
	</div>
</article>
