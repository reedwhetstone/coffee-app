<script lang="ts">
	import { onMount } from 'svelte';

	let callbackUrl = $state('');
	let copied = $state(false);
	let error = $state('');

	onMount(() => {
		// Supabase puts tokens in the URL fragment (#access_token=...)
		const hash = window.location.hash;
		if (!hash || !hash.includes('access_token')) {
			error = 'No authentication tokens found. Please try the login flow again.';
			return;
		}

		// Build the full callback URL for the user to copy
		callbackUrl = window.location.href;
	});

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(callbackUrl);
			copied = true;
			setTimeout(() => (copied = false), 3000);
		} catch {
			// Fallback: select the text
			const input = document.querySelector('input');
			if (input) {
				input.select();
			}
		}
	}
</script>

<svelte:head>
	<title>CLI Login - Purveyors</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-surface-canvas p-4">
	<div class="w-full max-w-lg rounded-xl bg-surface-raised p-8 shadow-lg ring-1 ring-line">
		<h1 class="mb-2 font-serif text-2xl font-medium text-ink">CLI login successful</h1>

		{#if error}
			<div class="mt-4 rounded-lg bg-danger-subtle p-4 text-danger-strong">
				<p>{error}</p>
				<p class="mt-2 text-sm">
					Run <code class="rounded bg-danger-subtle px-1">purvey auth login --headless</code> to try
					again.
				</p>
			</div>
		{:else}
			<p class="mb-6 text-muted">
				Copy this URL and paste it back into your terminal to complete login.
			</p>

			<div class="flex gap-2">
				<input
					type="text"
					readonly
					value={callbackUrl}
					class="flex-1 rounded-lg border border-line bg-surface-panel px-3 py-2 font-mono text-xs text-ink"
					onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
				/>
				<button
					onclick={copyToClipboard}
					class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent/85"
				>
					{copied ? '✓ Copied' : 'Copy'}
				</button>
			</div>

			<p class="mt-6 text-sm text-muted">
				You can close this tab after pasting the URL into your terminal.
			</p>
		{/if}
	</div>
</div>
