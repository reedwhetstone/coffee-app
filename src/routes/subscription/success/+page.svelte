<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let error = $state('');
	let success = $state(false);
	let debugInfo = $state('');
	let isDirectAccess = $state(false);

	//updated webhook
	onMount(async () => {
		console.log('Success page loaded with data:', data);

		// Check if user is authenticated
		if (!data?.session?.user) {
			console.error('No user session found in success page');
			goto('/');
			return;
		}

		// Check if this is a direct access to the success page
		// A valid access would come from the Stripe checkout with checkout_session_id
		// or via the redirect from the subscription page
		const url = new URL(window.location.href);
		const hasCheckoutSession = url.searchParams.has('checkout_session_id');
		const referrer = document.referrer;
		const hasValidReferrer =
			referrer.includes('checkout.stripe.com') || referrer.includes('/subscription');

		// If accessing directly without checkout_session_id and without valid referrer
		if (!hasCheckoutSession && !hasValidReferrer) {
			isDirectAccess = true;
			console.warn('⚠️ Direct access to success page detected');
			debugInfo = 'Direct access detected. Please complete checkout first.';
			loading = false;
			return;
		}

		try {
			// First check if the user already has a Stripe customer ID
			// Use the data from +page.server.ts which should include stripeCustomerId
			if (data.stripeCustomerId) {
				console.log('✅ User already has a Stripe customer:', data.stripeCustomerId);
				debugInfo = `User already has customer: ${data.stripeCustomerId}`;
				success = true;
				loading = false;
				return;
			}

			// Only create a customer if this is a valid checkout completion
			if (hasCheckoutSession || hasValidReferrer) {
				console.log('Creating Stripe customer for user:', data.session.user.id);

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

				// Get the response in text format first for debugging
				const responseText = await response.text();
				console.log('Create customer response text:', responseText);

				// Parse the response as JSON if possible
				let result;
				try {
					result = JSON.parse(responseText);
				} catch (parseError) {
					console.error('Failed to parse response as JSON:', parseError);
					debugInfo = `Response parsing error: ${(parseError as Error)?.message || 'Unknown'}, Text: ${responseText.substring(0, 100)}...`;
					throw new Error('Invalid response format');
				}

				if (!response.ok) {
					console.error('Error response from create-customer:', result);
					debugInfo = `API error: ${result.error || 'Unknown'}`;
					throw new Error(result.error || 'Failed to create customer');
				}

				console.log('✅ Stripe customer created or retrieved:', result);
				debugInfo = result.existing
					? `Using existing customer: ${result.customerId}`
					: `Created new customer: ${result.customerId}`;
				success = true;
			} else {
				// This should never happen given our earlier check, but just in case
				error = 'Invalid access to success page';
				debugInfo = 'No checkout session or valid referrer found';
			}
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
		{:else if isDirectAccess}
			<div class="text-center">
				<h2 class="mb-4 text-xl font-semibold text-yellow-400">Access Error</h2>
				<p class="text-primary-light mb-6 text-sm">
					This page should only be accessed after completing a subscription purchase.
				</p>
				<button
					onclick={() => goto('/subscription')}
					class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
				>
					Go to Subscription Page
				</button>
			</div>
		{:else if error}
			<div class="text-center">
				<h2 class="mb-4 text-xl font-semibold text-red-400">Something went wrong</h2>
				<p class="text-primary-light mb-6 text-sm">{error}</p>
				{#if debugInfo}
					<p class="mb-4 max-w-xs overflow-hidden text-ellipsis text-xs text-gray-400">
						Debug: {debugInfo}
					</p>
				{/if}
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
				{#if debugInfo}
					<p class="mb-4 max-w-xs overflow-hidden text-ellipsis text-xs text-gray-400">
						Debug: {debugInfo}
					</p>
				{/if}
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
