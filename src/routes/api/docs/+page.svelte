<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: any } = $props(); // eslint-disable-line @typescript-eslint/no-explicit-any

	onMount(() => {
		document.title = 'Parchment API Documentation';

		// If user is authenticated, redirect directly to docs
		if (data?.session) {
			goto('/api-dashboard/docs');
		}
	});

	function handleLogin() {
		goto('/auth');
	}
</script>

<svelte:head>
	<title>Parchment API Documentation</title>
	<meta
		name="description"
		content="Access comprehensive Parchment API documentation with examples and guides"
	/>
</svelte:head>

{#if !data?.session}
	<div class="min-h-screen bg-background-primary-light">
		<div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
			<div class="text-center">
				<div
					class="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-background-tertiary-light/10"
				>
					<svg
						class="h-8 w-8 text-background-tertiary-light"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>

				<h1 class="mb-4 text-3xl font-bold tracking-tight text-text-primary-light">
					Parchment API Documentation
				</h1>

				<p class="mb-8 text-lg text-text-secondary-light">
					Please login to access the comprehensive API documentation with personalized examples and
					your API keys.
				</p>

				<div class="mb-8 rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
					<h2 class="mb-4 text-lg font-semibold text-text-primary-light">
						What you'll get after logging in:
					</h2>
					<div class="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
						<div class="flex items-start space-x-3">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm font-medium text-text-primary-light">Personalized Examples</p>
								<p class="text-sm text-text-secondary-light">
									Code samples with your actual API keys
								</p>
							</div>
						</div>
						<div class="flex items-start space-x-3">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm font-medium text-text-primary-light">Usage Integration</p>
								<p class="text-sm text-text-secondary-light">Direct links to key management</p>
							</div>
						</div>
						<div class="flex items-start space-x-3">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm font-medium text-text-primary-light">Account Status</p>
								<p class="text-sm text-text-secondary-light">Real-time subscription information</p>
							</div>
						</div>
						<div class="flex items-start space-x-3">
							<div class="flex-shrink-0">
								<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm font-medium text-text-primary-light">Dashboard Integration</p>
								<p class="text-sm text-text-secondary-light">Seamless access to analytics</p>
							</div>
						</div>
					</div>
				</div>

				<div class="flex justify-center space-x-4">
					<button
						onclick={handleLogin}
						class="inline-flex items-center rounded-md bg-background-tertiary-light px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Login to Access Documentation
					</button>
				</div>

				<p class="mt-6 text-sm text-text-secondary-light">
					New to Parchment API? <a
						href="/api"
						class="text-background-tertiary-light hover:underline">Learn more about our API</a
					>
				</p>
			</div>
		</div>
	</div>
{:else}
	<!-- This will never render as authenticated users are redirected in onMount -->
	<div class="flex min-h-screen items-center justify-center bg-background-primary-light">
		<div class="text-center">
			<p class="text-text-secondary-light">Redirecting to documentation...</p>
		</div>
	</div>
{/if}

<style>
	/* Smooth redirects */
</style>
