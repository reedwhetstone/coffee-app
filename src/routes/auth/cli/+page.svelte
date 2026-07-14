<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const scopeLabels: Record<string, string> = {
		'catalog:read': 'Browse the coffee catalog',
		'inventory:read': 'Read your inventory',
		'inventory:write': 'Create and update your inventory',
		'roast:read': 'Read your roast records',
		'roast:write': 'Create and update your roast records',
		'sales:read': 'Read your sales records',
		'sales:write': 'Create and update your sales records',
		'tasting:read': 'Read your tasting notes',
		'tasting:write': 'Create and update your tasting notes'
	};

	const expiresAt = $derived(
		data.request
			? new Intl.DateTimeFormat(undefined, {
					hour: 'numeric',
					minute: '2-digit',
					timeZoneName: 'short'
				}).format(new Date(data.request.expiresAt))
			: ''
	);
	const signInUrl = $derived(
		data.requestToken
			? `/auth?next=${encodeURIComponent(`/auth/cli?request=${encodeURIComponent(data.requestToken)}`)}`
			: '/auth'
	);
</script>

<svelte:head>
	<title>Authorize Purveyors CLI</title>
	<meta
		name="description"
		content="Review and approve a Purveyors CLI sign-in request from this device."
	/>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-surface-canvas px-4 py-12 sm:px-6">
	<section
		class="w-full max-w-lg rounded-xl border border-line bg-surface-panel p-6 shadow-md sm:p-8"
	>
		{#if form?.approved}
			<div class="text-center" data-testid="cli-auth-approved">
				<div
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-subtle text-xl text-success-strong"
					aria-hidden="true"
				>
					✓
				</div>
				<h1 class="mt-5 font-serif text-3xl font-medium tracking-tight text-ink">
					CLI access approved
				</h1>
				<p class="mt-3 text-sm leading-6 text-muted">
					Return to your terminal. The CLI will finish signing in automatically.
				</p>
				<p class="mt-6 text-xs text-muted">You can safely close this window.</p>
			</div>
		{:else if data.failure}
			<div data-testid="cli-auth-failure">
				<p class="text-sm font-medium uppercase tracking-wide text-danger">CLI sign-in</p>
				<h1 class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink">
					{data.failure.title}
				</h1>
				<p class="mt-4 text-sm leading-6 text-muted">{data.failure.message}</p>
				<a class="mt-6 inline-flex text-sm font-medium text-ink underline" href="/">
					Return to Purveyors
				</a>
			</div>
		{:else if data.request && data.requestToken}
			<p class="text-sm font-medium uppercase tracking-wide text-muted">Purveyors CLI</p>
			<h1 class="mt-2 font-serif text-3xl font-medium tracking-tight text-ink">
				Authorize this machine?
			</h1>
			<p class="mt-3 text-sm leading-6 text-muted">
				The CLI on <strong class="font-semibold text-ink">{data.request.machineName}</strong> is requesting
				access to your Purveyors account.
			</p>

			<div class="mt-6 rounded-lg border border-line bg-surface-canvas p-4">
				<h2 class="text-sm font-semibold text-ink">This CLI will be able to:</h2>
				<ul class="mt-3 space-y-2">
					{#each data.request.scopes as scope}
						<li class="flex gap-2 text-sm text-muted">
							<span class="text-success-strong" aria-hidden="true">✓</span>
							<span>{scopeLabels[scope] ?? scope} <code class="text-xs">({scope})</code></span>
						</li>
					{/each}
				</ul>
			</div>

			<p class="mt-4 text-xs text-muted">This request expires at {expiresAt}.</p>

			{#if form?.error}
				<div class="mt-5 rounded-lg border border-danger/20 bg-danger-subtle p-4" role="alert">
					<p class="text-sm text-danger">{form.error}</p>
					{#if form.signedOut}
						<a class="mt-2 inline-block text-sm font-medium text-danger underline" href={signInUrl}>
							Sign in again
						</a>
					{/if}
				</div>
			{/if}

			{#if !form?.terminal}
				<form method="POST" action="?/approve" class="mt-6">
					<input type="hidden" name="request" value={data.requestToken} />
					<button
						type="submit"
						class="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-ink shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
					>
						Authorize CLI
					</button>
				</form>
			{/if}

			<p class="mt-4 text-center text-xs leading-5 text-muted">
				Only approve requests you started yourself. Your API key is delivered directly to the CLI
				and is never shown in this browser.
			</p>
		{/if}
	</section>
</main>
