<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: PageData }>();
	const siteUrl =
		typeof window !== 'undefined'
			? window.location.origin.includes('localhost')
				? 'http://localhost:5173'
				: 'https://www.purveyors.io'
			: 'https://www.purveyors.io';

	// Check if user is authenticated when component mounts
	onMount(() => {
		if (!data?.session?.user) {
			// Redirect to home page if not authenticated
			goto('/');
		}

		// Alternative approach: check URL for Stripe session ID
		const url = new URL(window.location.href);
		if (url.searchParams.has('checkout_session_id')) {
			// Redirect to success page with the session ID
			goto('/subscription/success');
		}
	});
</script>

<svelte:head>
	<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
</svelte:head>

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-10">
	<!-- Subscription Content -->
	<div
		class="rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-6 shadow-md"
	>
		<div class="mb-4">
			<h2 class="text-primary-light mb-2 text-xl font-semibold">Choose Your Plan</h2>
			<p class="text-primary-light text-sm">
				Select the plan that works best for you. All plans include a 30 day free trial.
			</p>
		</div>

		<!-- Stripe Pricing Table -->
		<div class="stripe-container mt-6">
			{#if data?.session?.user}
				{#if data.role === 'member' || data.role === 'admin'}
					<!-- Show message for users who are already members -->
					<div class="rounded-lg bg-green-500/10 p-6 text-center">
						<h3 class="mb-3 text-lg font-medium text-green-400">You're a Member!</h3>
						<p class="text-primary-light mb-6 text-sm">
							You already have an active subscription. Thank you for your support!
						</p>
						<button
							onclick={() => goto('/')}
							class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
						>
							Return to Homepage
						</button>
					</div>
				{:else}
					<!-- Show pricing table for logged-in users who are not members -->
					<stripe-pricing-table
						pricing-table-id="prctbl_1R3q5qKwI9NkGqAnQSER8dSB"
						publishable-key="pk_test_51R3ltgKwI9NkGqAnh6PER9cKR2gXZuBKEIb8oIQpSbOQ6qo13ivw2694cCoGWNvqUu2hG5z91rLBsupkwz92kAfY00arRRkkIc"
						client-reference-id={data.session.user.id}
						customer-email={data.session.user.email}
						success-url={`${siteUrl}/subscription/success?checkout_session_id={CHECKOUT_SESSION_ID}`}
						cancel-url={`${siteUrl}/subscription`}
					>
					</stripe-pricing-table>
				{/if}
			{:else}
				<!-- Loading or redirect state -->
				<div class="rounded-lg bg-background-tertiary-light p-6 text-center">
					<p class="text-primary-light mb-4">Please sign in to view subscription options</p>
					<button
						onclick={() => goto('/')}
						class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
					>
						Return to Home
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(stripe-pricing-table) {
		/* Add any custom styling for the pricing table here */
		width: 100%;
		--ptable-border-radius: 0.5rem;
		--ptable-feature-color: var(--text-primary-light);
	}
</style>
