<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import StripeCheckout from './StripeCheckout.svelte';

	let { data } = $props<{ data: PageData }>();
	const siteUrl =
		typeof window !== 'undefined'
			? window.location.origin.includes('localhost')
				? 'http://localhost:5173'
				: 'https://www.purveyors.io'
			: 'https://www.purveyors.io';

	let showCheckout = $state(false);
	let selectedPriceId = $state('');
	let selectedPlanName = $state('');

	// Available subscription plans
	const plans = [
		{
			id: 'price_1R3q5OKwI9NkGqAnQfBhW83g',
			name: 'Monthly Subscription',
			price: '$5.00',
			interval: 'month',
			description: 'Full access to all premium features'
		}
	];

	const handlePlanSelect = (plan: (typeof plans)[0]) => {
		selectedPriceId = plan.id;
		selectedPlanName = plan.name;
		showCheckout = true;
	};

	const handleCheckoutSuccess = () => {
		goto('/subscription/success');
	};

	const handleCheckoutCancel = () => {
		showCheckout = false;
	};

	// Check if user is authenticated when component mounts
	onMount(() => {
		if (!data?.session?.user) {
			// Redirect to home page if not authenticated
			goto('/');
		}

		// Alternative approach: check URL for Stripe session ID
		const url = new URL(window.location.href);
		if (url.searchParams.has('session_id')) {
			// Redirect to success page with the session ID
			goto('/subscription/success');
		}
	});
</script>

<svelte:head>
	<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
</svelte:head>

<div class="min-h-[calc(100vh-80px)] px-4 py-10 md:px-6">
	<div class="mx-auto max-w-3xl">
		<div
			class="rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-6 shadow-md"
		>
			{#if data?.session?.user}
				{#if data.role === 'member' || data.role === 'admin'}
					<!-- Show message for users who are already members -->
					<div class="flex flex-col items-center rounded-lg p-6 text-center">
						<h3 class="text-primary-light mb-2 text-xl font-semibold">You're a Member!</h3>
						<p class="text-primary-light mb-4 text-sm">
							You already have an active subscription. Thank you for your support!
						</p>
						<button
							onclick={() => goto('/')}
							class="rounded bg-blue-500/10 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20"
						>
							Return to Homepage
						</button>
					</div>
				{:else if showCheckout && selectedPriceId}
					<!-- Checkout Form (replaces plan selection when a plan is selected) -->
					<div>
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-primary-light text-xl font-semibold">
								Subscribe to {selectedPlanName}
							</h2>
							<button
								onclick={handleCheckoutCancel}
								class="text-primary-light/70 hover:text-primary-light rounded-full p-1"
								aria-label="Back to plan selection"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
						<StripeCheckout
							priceId={selectedPriceId}
							clientReferenceId={data.session.user.id}
							customerEmail={data.session.user.email}
							onSuccess={handleCheckoutSuccess}
							onCancel={handleCheckoutCancel}
						/>
					</div>
				{:else}
					<!-- Plan Selection UI -->
					<div class="flex flex-col items-center">
						<div class="mb-4">
							<h2 class="text-primary-light mb-2 text-xl font-semibold">Choose Your Plan</h2>
							<p class="text-primary-light text-sm">
								Select the plan that works best for you. All plans include a 30 day free trial.
							</p>
						</div>

						<!-- Plan Selection Cards -->
						<div class="flex flex-col items-center">
							{#each plans as plan}
								<div
									class="flex flex-col rounded-lg border border-background-tertiary-light p-4 shadow-md hover:border-blue-400"
								>
									<h3 class="text-primary-light mb-1 text-lg font-semibold">{plan.name}</h3>
									<div class="text-primary-light mb-2 flex items-end">
										<span class="text-2xl font-bold">{plan.price}</span>
										<span class="ml-1 text-sm">/{plan.interval}</span>
									</div>
									<p class="text-primary-light mb-4 text-sm">{plan.description}</p>
									<button
										onclick={() => handlePlanSelect(plan)}
										class="mt-auto rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
									>
										Select Plan
									</button>
								</div>
							{/each}
						</div>
					</div>
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
	/* Add any custom styling for the checkout page here */
</style>
