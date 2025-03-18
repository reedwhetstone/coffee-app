<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let error = $state('');
	let success = $state(false);
	//updated webhook
	onMount(async () => {
		// Check if user is authenticated
		if (!data?.session?.user) {
			goto('/');
			return;
		}

		try {
			// Create a Stripe customer and link it to the user
			const response = await fetch('/api/stripe/create-customer', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: data.session.user.email,
					name: data.session.user.user_metadata?.full_name || ''
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to create customer');
			}

			console.log('✅ Stripe customer created:', result.customerId);
			success = true;
		} catch (e) {
			console.error('❌ Error creating Stripe customer:', e);
			error = e instanceof Error ? e.message : 'An unknown error occurred';
		} finally {
			loading = false;
		}
	});
</script>

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-10">
	<div
		class="max-w-md rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-8 shadow-md"
	>
		{#if loading}
			<div class="text-center">
				<h2 class="text-primary-light mb-4 text-xl font-semibold">Processing Subscription</h2>
				<p class="text-primary-light mb-4 text-sm">Please wait while we set up your account...</p>
				<div class="flex justify-center">
					<div
						class="h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent"
					></div>
				</div>
			</div>
		{:else if error}
			<div class="text-center">
				<h2 class="mb-4 text-xl font-semibold text-red-400">Something went wrong</h2>
				<p class="text-primary-light mb-6 text-sm">{error}</p>
				<button
					onclick={() => goto('/subscription')}
					class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
				>
					Return to Subscription Page
				</button>
			</div>
		{:else}
			<div class="text-center">
				<h2 class="mb-4 text-xl font-semibold text-green-400">Subscription Successful!</h2>
				<p class="text-primary-light mb-6 text-sm">
					Thank you for subscribing! Your account has been upgraded to Member status.
				</p>
				<div class="flex flex-col gap-3">
					<button
						onclick={() => goto('/')}
						class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
					>
						Go to Homepage
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
