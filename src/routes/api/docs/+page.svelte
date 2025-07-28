<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		document.title = 'API Documentation - Redirecting...';
		// Redirect to dashboard docs after a short delay to show the message
		setTimeout(() => {
			goto('/api-dashboard/docs');
		}, 2000);
	});
</script>

<svelte:head>
	<title>API Documentation - Redirecting</title>
	<meta name="description" content="Redirecting to the new API documentation location" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
		<div class="text-center">
			<div class="mx-auto mb-8 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
				<svg class="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			
			<h1 class="text-3xl font-bold tracking-tight text-text-primary-light mb-4">
				API Documentation Has Moved
			</h1>
			
			<p class="text-lg text-text-secondary-light mb-8">
				Our API documentation is now part of the personalized dashboard experience.
				<br />
				You'll be redirected automatically in a moment.
			</p>

			<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light mb-8">
				<h2 class="text-lg font-semibold text-text-primary-light mb-4">
					Enhanced Documentation Features
				</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
					<div class="flex items-start space-x-3">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
							</svg>
						</div>
						<div>
							<p class="text-sm font-medium text-text-primary-light">Personalized Examples</p>
							<p class="text-sm text-text-secondary-light">Code samples with your actual API keys</p>
						</div>
					</div>
					<div class="flex items-start space-x-3">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
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
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
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
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
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
				<a
					href="/api-dashboard/docs"
					class="inline-flex items-center rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Go to Documentation
				</a>
				<a
					href="/api-dashboard"
					class="inline-flex items-center rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					API Dashboard
				</a>
			</div>

			<p class="mt-6 text-sm text-text-secondary-light">
				Need to sign in? <a href="/" class="text-background-tertiary-light hover:underline">Return to home page</a>
			</p>
		</div>
	</div>
</div>

<style>
	/* Smooth redirects */
</style>