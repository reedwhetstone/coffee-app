<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	type ApprovalResult = {
		approved: boolean;
		signedOut: boolean;
		terminal: boolean;
		error?: string;
		redirectTo?: string;
	};

	let approvalResult = $state<ApprovalResult | null>(null);
	let submitting = $state(false);

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

	async function postJson(path: string, body: Record<string, unknown> = {}) {
		const response = await fetch(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		return (await response.json()) as ApprovalResult;
	}

	async function approve() {
		if (!data.requestToken || submitting) return;

		submitting = true;
		try {
			approvalResult = await postJson('/auth/cli/approve', { request: data.requestToken });
		} catch {
			approvalResult = {
				approved: false,
				signedOut: false,
				terminal: false,
				error: 'Purveyors could not approve this request right now. Please try again shortly.'
			};
		} finally {
			submitting = false;
		}
	}

	async function reauthenticate() {
		if (submitting) return;

		submitting = true;
		try {
			const result = await postJson('/auth/cli/reauthenticate');
			if (result.redirectTo) {
				window.location.assign(result.redirectTo);
				return;
			}
			approvalResult = result;
		} catch {
			approvalResult = {
				approved: false,
				signedOut: false,
				terminal: false,
				error: 'Failed to reset your session. Please try again.'
			};
		} finally {
			submitting = false;
		}
	}
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
		{#if approvalResult?.approved}
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

			{#if approvalResult?.error}
				<div class="mt-5 rounded-lg border border-danger/20 bg-danger-subtle p-4" role="alert">
					<p class="text-sm text-danger">{approvalResult.error}</p>
					{#if approvalResult.signedOut}
						<div class="mt-2">
							<button
								type="button"
								onclick={reauthenticate}
								disabled={submitting}
								class="text-sm font-medium text-danger underline disabled:opacity-50"
							>
								Sign in again
							</button>
						</div>
					{/if}
				</div>
			{/if}

			{#if !approvalResult?.terminal}
				<div class="mt-6">
					<button
						type="button"
						onclick={approve}
						disabled={submitting}
						class="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-ink shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
					>
						{submitting ? 'Authorizing…' : 'Authorize CLI'}
					</button>
				</div>
			{/if}

			<p class="mt-4 text-center text-xs leading-5 text-muted">
				Only approve requests you started yourself. Your API key is delivered directly to the CLI
				and is never shown in this browser.
			</p>
		{/if}
	</section>
</main>
