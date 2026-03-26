<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>API docs gateway | Purveyors Dashboard</title>
	<meta
		name="description"
		content="Account-aware handoff into the unified Purveyors API and CLI docs."
	/>
</svelte:head>

<div class="space-y-8">
	<header
		class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
	>
		<nav class="mb-4 text-sm text-text-secondary-light">
			<a href="/api-dashboard" class="hover:text-text-primary-light">← Back to dashboard</a>
		</nav>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-background-tertiary-light">
			Docs gateway
		</p>
		<h1 class="mt-3 text-3xl font-bold tracking-tight text-text-primary-light sm:text-4xl">
			Use the public docs, with your account context in mind
		</h1>
		<p class="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary-light sm:text-lg">
			The old dashboard monolith has been replaced with a unified docs tree under /docs. Use this
			page to jump into the right section while keeping API keys, rate limits, and usage context
			nearby.
		</p>
	</header>

	{#if !data.hasApiKeys}
		<div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
			<p class="text-sm font-semibold">No active keys yet</p>
			<p class="mt-2 text-sm leading-relaxed">
				Create your first API key before testing /api/catalog-api. The docs explain the contract,
				but the dashboard is where keys are actually generated and revoked.
			</p>
			<a
				href="/api-dashboard/keys"
				class="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:bg-opacity-90"
			>
				Create an API key
			</a>
		</div>
	{/if}

	<section class="grid gap-6 xl:grid-cols-3">
		<a
			href="/docs/api/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">API overview</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Understand the split between the public API-key feed and the internal session-auth app
				routes.
			</p>
		</a>
		<a
			href="/docs/api/catalog"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">Catalog reference</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Read the exact behavior of GET /api/catalog-api, including row limits, cache behavior, and
				headers.
			</p>
		</a>
		<a
			href="/docs/cli/overview"
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm transition-colors hover:border-background-tertiary-light/40 hover:bg-background-secondary-light"
		>
			<h2 class="text-xl font-semibold text-text-primary-light">CLI overview</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				Use the CLI for terminal workflows, scripting, and agent-safe automation against the same
				domain.
			</p>
		</a>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">Quick start with your account</h2>
			<ol class="mt-5 space-y-4 text-sm leading-relaxed text-text-primary-light sm:text-base">
				<li class="flex gap-3">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary-light text-sm font-semibold text-white"
						>1</span
					>
					<span
						>Create or review keys in <a
							href="/api-dashboard/keys"
							class="font-semibold text-background-tertiary-light hover:underline">API Keys</a
						>.</span
					>
				</li>
				<li class="flex gap-3">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary-light text-sm font-semibold text-white"
						>2</span
					>
					<span
						>Read <a
							href="/docs/api/catalog"
							class="font-semibold text-background-tertiary-light hover:underline">Catalog API</a
						> before wiring your first sync.</span
					>
				</li>
				<li class="flex gap-3">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary-light text-sm font-semibold text-white"
						>3</span
					>
					<span
						>Watch real usage in <a
							href="/api-dashboard/usage"
							class="font-semibold text-background-tertiary-light hover:underline"
							>Usage Analytics</a
						>.</span
					>
				</li>
				<li class="flex gap-3">
					<span
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-tertiary-light text-sm font-semibold text-white"
						>4</span
					>
					<span
						>Use the CLI docs if you want a terminal or agent integration instead of raw HTTP.</span
					>
				</li>
			</ol>
		</div>

		<div
			class="rounded-3xl border border-border-light bg-background-primary-light p-6 shadow-sm sm:p-8"
		>
			<h2 class="text-2xl font-semibold text-text-primary-light">Header example</h2>
			<p class="mt-3 text-sm leading-relaxed text-text-secondary-light">
				This masked example matches the docs format. Replace it with one of your real active keys
				when testing.
			</p>
			<div
				class="mt-5 overflow-hidden rounded-2xl border border-border-light bg-background-secondary-light"
			>
				<div
					class="border-b border-border-light px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary-light"
				>
					Authorization header
				</div>
				<pre
					class="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-text-primary-light sm:text-sm"><code
						>Authorization: Bearer {data.exampleApiKey}</code
					></pre>
			</div>
			<div class="mt-5 space-y-3 text-sm leading-relaxed text-text-secondary-light">
				<p>External catalog access uses Bearer tokens.</p>
				<p>Dashboard pages and internal app APIs still use your web session.</p>
				<p>
					That split is documented in <a
						href="/docs/api/overview"
						class="font-semibold text-background-tertiary-light hover:underline">API overview</a
					>.
				</p>
			</div>
		</div>
	</section>
</div>
