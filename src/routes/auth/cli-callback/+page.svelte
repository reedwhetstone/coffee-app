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

<div class="flex min-h-screen items-center justify-center bg-stone-50 p-4">
	<div class="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
		<h1 class="mb-2 text-2xl font-bold text-stone-900">CLI Login Successful</h1>

		{#if error}
			<div class="mt-4 rounded-lg bg-red-50 p-4 text-red-800">
				<p>{error}</p>
				<p class="mt-2 text-sm">
					Run <code class="rounded bg-red-100 px-1">purvey auth login --headless</code> to try again.
				</p>
			</div>
		{:else}
			<p class="mb-6 text-stone-600">
				Copy this URL and paste it back into your terminal to complete login.
			</p>

			<div class="flex gap-2">
				<input
					type="text"
					readonly
					value={callbackUrl}
					class="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-700"
					onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
				/>
				<button
					onclick={copyToClipboard}
					class="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
				>
					{copied ? '✓ Copied' : 'Copy'}
				</button>
			</div>

			<p class="mt-6 text-sm text-stone-500">
				You can close this tab after pasting the URL into your terminal.
			</p>
		{/if}
	</div>
</div>
